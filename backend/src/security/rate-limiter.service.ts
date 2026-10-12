import { Injectable, BadRequestException, TooManyRequestsException } from '@nestjs/common';
import { RedisService } from '../cache/redis.service';
import { Logger } from 'pino';

export type RateLimitStrategy = 'fixed-window' | 'sliding-window' | 'token-bucket' | 'leaky-bucket';

export interface RateLimitConfig {
  windowMs: number; // Window duration in ms
  maxRequests: number; // Max requests per window
  strategy: RateLimitStrategy;
  keyPrefix?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (key: string, attempts: number) => Promise<void>;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  current: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

interface TokenBucketState {
  tokens: number;
  lastRefillTime: number;
}

interface LeakyBucketState {
  queue: number;
  leakRate: number;
  lastLeakTime: number;
}

@Injectable()
export class RateLimiterService {
  private logger: Logger;

  constructor(
    private redisService: RedisService,
    logger: Logger
  ) {
    this.logger = logger.child({ context: 'RateLimiterService' });
  }

  /**
   * Check if request is allowed under rate limit
   */
  async checkLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const prefixedKey = `${config.keyPrefix || 'rl'}:${key}`;

    try {
      switch (config.strategy) {
        case 'fixed-window':
          return await this.checkFixedWindow(prefixedKey, config);
        case 'sliding-window':
          return await this.checkSlidingWindow(prefixedKey, config);
        case 'token-bucket':
          return await this.checkTokenBucket(prefixedKey, config);
        case 'leaky-bucket':
          return await this.checkLeakyBucket(prefixedKey, config);
        default:
          return await this.checkFixedWindow(prefixedKey, config);
      }
    } catch (error) {
      this.logger.error({ error, key, config }, 'Rate limit check failed');
      // On error, allow request but log it
      return { allowed: true, limit: config.maxRequests, current: 0, remaining: config.maxRequests, resetTime: Date.now() + config.windowMs };
    }
  }

  /**
   * Fixed Window strategy
   * Simple counter that resets every windowMs
   */
  private async checkFixedWindow(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const windowKey = `${key}:window`;
    const countKey = `${key}:count`;

    const window = await this.redisService.get(windowKey);
    let count = parseInt(await this.redisService.get(countKey) || '0', 10);
    let resetTime = now + config.windowMs;

    if (!window || parseInt(window as string, 10) < now) {
      // New window
      await this.redisService.set(windowKey, now.toString(), config.windowMs);
      await this.redisService.set(countKey, '1', config.windowMs);
      count = 1;
      resetTime = now + config.windowMs;
    } else {
      // Existing window
      count++;
      await this.redisService.increment(countKey);
    }

    const allowed = count <= config.maxRequests;

    if (!allowed && config.onLimitReached) {
      await config.onLimitReached(key, count);
    }

    return {
      allowed,
      limit: config.maxRequests,
      current: count,
      remaining: Math.max(0, config.maxRequests - count),
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000),
    };
  }

  /**
   * Sliding Window strategy
   * More accurate than fixed window, uses sorted set
   */
  private async checkSlidingWindow(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Remove old entries outside the window
    await this.redisService.removeByScore(key, '-inf', windowStart);

    // Count requests in current window
    const count = await this.redisService.countByScore(key, windowStart, now);

    if (count < config.maxRequests) {
      // Add current request
      await this.redisService.addSortedSet(key, now, now.toString());
      // Set expiration
      await this.redisService.setExpire(key, Math.ceil(config.windowMs / 1000));
    }

    const allowed = count < config.maxRequests;
    const nextResetTime = windowStart + config.windowMs;

    if (!allowed && config.onLimitReached) {
      await config.onLimitReached(key, count + 1);
    }

    return {
      allowed,
      limit: config.maxRequests,
      current: count,
      remaining: Math.max(0, config.maxRequests - count),
      resetTime: nextResetTime,
      retryAfter: allowed ? undefined : Math.ceil((nextResetTime - now) / 1000),
    };
  }

  /**
   * Token Bucket strategy
   * Tokens refill at a constant rate
   */
  private async checkTokenBucket(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const stateKey = `${key}:bucket`;

    let state = await this.redisService.get(stateKey);
    let bucketState: TokenBucketState;

    if (!state) {
      bucketState = {
        tokens: config.maxRequests,
        lastRefillTime: now,
      };
    } else {
      bucketState = JSON.parse(state as string);
      
      // Calculate refilled tokens
      const timePassed = now - bucketState.lastRefillTime;
      const refillRate = config.maxRequests / config.windowMs; // tokens per ms
      const tokensRefilled = timePassed * refillRate;
      
      bucketState.tokens = Math.min(
        config.maxRequests,
        bucketState.tokens + tokensRefilled
      );
      bucketState.lastRefillTime = now;
    }

    const allowed = bucketState.tokens >= 1;
    if (allowed) {
      bucketState.tokens--;
    }

    await this.redisService.set(stateKey, JSON.stringify(bucketState), config.windowMs);

    if (!allowed && config.onLimitReached) {
      await config.onLimitReached(key, 1);
    }

    const tokensPerMs = config.maxRequests / config.windowMs;
    const timeToRefill = Math.ceil((1 - bucketState.tokens) / tokensPerMs);

    return {
      allowed,
      limit: config.maxRequests,
      current: Math.floor(bucketState.tokens),
      remaining: Math.floor(bucketState.tokens),
      resetTime: now + timeToRefill,
      retryAfter: allowed ? undefined : Math.ceil(timeToRefill / 1000),
    };
  }

  /**
   * Leaky Bucket strategy
   * Requests leak at a constant rate
   */
  private async checkLeakyBucket(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const stateKey = `${key}:leak`;

    let state = await this.redisService.get(stateKey);
    let bucketState: LeakyBucketState;

    if (!state) {
      bucketState = {
        queue: 0,
        leakRate: config.maxRequests / config.windowMs, // items per ms
        lastLeakTime: now,
      };
    } else {
      bucketState = JSON.parse(state as string);

      // Calculate leaked items
      const timePassed = now - bucketState.lastLeakTime;
      const itemsLeaked = timePassed * bucketState.leakRate;
      
      bucketState.queue = Math.max(0, bucketState.queue - itemsLeaked);
      bucketState.lastLeakTime = now;
    }

    const allowed = bucketState.queue < config.maxRequests;
    if (allowed) {
      bucketState.queue++;
    }

    await this.redisService.set(stateKey, JSON.stringify(bucketState), config.windowMs);

    if (!allowed && config.onLimitReached) {
      await config.onLimitReached(key, Math.ceil(bucketState.queue));
    }

    const leakTimeMs = ((bucketState.queue + 1) / bucketState.leakRate);

    return {
      allowed,
      limit: config.maxRequests,
      current: Math.ceil(bucketState.queue),
      remaining: Math.max(0, config.maxRequests - Math.ceil(bucketState.queue)),
      resetTime: now + leakTimeMs,
      retryAfter: allowed ? undefined : Math.ceil(leakTimeMs / 1000),
    };
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string, keyPrefix: string = 'rl'): Promise<void> {
    const prefixedKey = `${keyPrefix}:${key}`;
    await this.redisService.delete([
      `${prefixedKey}:window`,
      `${prefixedKey}:count`,
      `${prefixedKey}:bucket`,
      `${prefixedKey}:leak`,
      prefixedKey,
    ]);
    this.logger.debug({ key }, 'Rate limit reset');
  }

  /**
   * Get current state
   */
  async getState(key: string, keyPrefix: string = 'rl'): Promise<any> {
    const prefixedKey = `${keyPrefix}:${key}`;
    return {
      window: await this.redisService.get(`${prefixedKey}:window`),
      count: await this.redisService.get(`${prefixedKey}:count`),
      bucket: await this.redisService.get(`${prefixedKey}:bucket`),
      leak: await this.redisService.get(`${prefixedKey}:leak`),
    };
  }
}
