import crypto from 'crypto';
import NodeCache from 'node-cache';
import { logger } from '../utils/logger';

interface TokenRecord {
  token: string;
  createdAt: number;
  ip: string;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export class SecretAuthService {
  private tokenCache: NodeCache;
  private rateLimitCache: NodeCache;
  private readonly TOKEN_TTL = 3600; // 1 hour
  private readonly RATE_LIMIT_WINDOW = 900; // 15 minutes
  private readonly MAX_REQUESTS_PER_IP = 10;

  constructor() {
    this.tokenCache = new NodeCache({ stdTTL: this.TOKEN_TTL, checkperiod: 600 });
    this.rateLimitCache = new NodeCache({ stdTTL: this.RATE_LIMIT_WINDOW, checkperiod: 120 });

    logger.info('SecretAuthService initialized', {
      tokenTTL: this.TOKEN_TTL,
      rateLimitWindow: this.RATE_LIMIT_WINDOW,
      maxRequestsPerIp: this.MAX_REQUESTS_PER_IP,
    });
  }

  /**
   * Generate a cryptographically secure token
   */
  generateToken(): string {
    const token = crypto.randomBytes(32).toString('hex');
    logger.debug('Token generated', { tokenLength: token.length });
    return token;
  }

  /**
   * Store token with IP tracking
   */
  storeToken(token: string, ip: string): void {
    try {
      const record: TokenRecord = {
        token,
        createdAt: Date.now(),
        ip,
      };

      this.tokenCache.set(token, record, this.TOKEN_TTL);
      logger.info('Token stored', { token: token.substring(0, 8) + '...', ip, ttl: this.TOKEN_TTL });
    } catch (error) {
      logger.error('Failed to store token', { error: (error as Error).message, ip });
      throw new Error('Token storage failed');
    }
  }

  /**
   * Validate token with timing-safe comparison
   */
  validateToken(providedToken: string, ip: string): boolean {
    try {
      if (!providedToken || typeof providedToken !== 'string') {
        logger.warn('Invalid token format', { ip, tokenType: typeof providedToken });
        return false;
      }

      const stored = this.tokenCache.get(providedToken) as TokenRecord | undefined;

      if (!stored) {
        logger.warn('Token not found or expired', { token: providedToken.substring(0, 8) + '...', ip });
        return false;
      }

      // Timing-safe comparison
      const isValid = crypto.timingSafeEqual(
        Buffer.from(providedToken),
        Buffer.from(stored.token)
      );

      if (!isValid) {
        logger.warn('Token mismatch', { ip, storedIp: stored.ip });
        return false;
      }

      // Verify IP matches (optional but recommended)
      if (stored.ip !== ip) {
        logger.warn('Token IP mismatch', { ip, storedIp: stored.ip });
        return false;
      }

      logger.debug('Token validated successfully', { token: providedToken.substring(0, 8) + '...', ip });
      return true;
    } catch (error) {
      logger.error('Token validation error', { error: (error as Error).message, ip });
      return false;
    }
  }

  /**
   * Rate limiting by IP
   */
  checkRateLimit(ip: string): boolean {
    try {
      const record = this.rateLimitCache.get(ip) as RateLimitRecord | undefined;

      if (!record) {
        this.rateLimitCache.set(ip, { count: 1, resetAt: Date.now() + this.RATE_LIMIT_WINDOW });
        logger.debug('Rate limit counter initialized', { ip });
        return true;
      }

      if (record.count >= this.MAX_REQUESTS_PER_IP) {
        logger.warn('Rate limit exceeded', { ip, count: record.count, limit: this.MAX_REQUESTS_PER_IP });
        return false;
      }

      record.count++;
      this.rateLimitCache.set(ip, record);
      logger.debug('Rate limit incremented', { ip, count: record.count });
      return true;
    } catch (error) {
      logger.error('Rate limit check error', { error: (error as Error).message, ip });
      return false;
    }
  }

  /**
   * Revoke token
   */
  revokeToken(token: string): void {
    try {
      this.tokenCache.del(token);
      logger.info('Token revoked', { token: token.substring(0, 8) + '...' });
    } catch (error) {
      logger.error('Failed to revoke token', { error: (error as Error).message });
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      activeTokens: this.tokenCache.keys().length,
      rateLimitEntries: this.rateLimitCache.keys().length,
    };
  }
}

export const secretAuthService = new SecretAuthService();
