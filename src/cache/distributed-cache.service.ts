import { Injectable, Logger } from '@nestjs/common';
import * as redis from 'redis';
import * as memcached from 'memcached';

export interface DistributedCacheConfig {
  type: 'redis' | 'memcached' | 'hybrid';
  redis?: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
  };
  memcached?: {
    servers: string[];
    options?: any;
  };
  syncInterval: number; // milliseconds
}

@Injectable()
export class DistributedCacheService {
  private readonly logger = new Logger(DistributedCacheService.name);
  private redisClient: any;
  private memcachedClient: any;

  constructor(private config: DistributedCacheConfig) {
    this.initialize();
  }

  private initialize(): void {
    if (
      this.config.type === 'redis' ||
      this.config.type === 'hybrid'
    ) {
      this.initializeRedis();
    }

    if (
      this.config.type === 'memcached' ||
      this.config.type === 'hybrid'
    ) {
      this.initializeMemcached();
    }
  }

  private initializeRedis(): void {
    const redisConfig = this.config.redis || {
      host: 'localhost',
      port: 6379,
      db: 0,
      keyPrefix: 'pepito:',
    };

    this.redisClient = redis.createClient({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          return new Error('Redis server refused connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      },
    });

    this.redisClient.on('error', (err) => {
      this.logger.error(`Redis error: ${err}`);
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Redis connected');
    });
  }

  private initializeMemcached(): void {
    const memcachedConfig = this.config.memcached || {
      servers: ['127.0.0.1:11211'],
    };

    this.memcachedClient = new memcached(
      memcachedConfig.servers,
      memcachedConfig.options,
    );

    this.memcachedClient.on('error', (err) => {
      this.logger.error(`Memcached error: ${err}`);
    });
  }

  /**
   * Get value from distributed cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      // Try Redis first (primary)
      if (this.redisClient) {
        const value = await this.redisGetAsync(key);
        if (value) {
          return JSON.parse(value) as T;
        }
      }

      // Fallback to Memcached
      if (this.memcachedClient) {
        const value = await this.memcachedGetAsync(key);
        if (value) {
          return JSON.parse(value) as T;
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}: ${error}`);
      return null;
    }
  }

  /**
   * Set value in distributed cache
   */
  async set<T = any>(
    key: string,
    value: T,
    ttl: number = 3600, // seconds
  ): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);

      // Set in Redis
      if (this.redisClient) {
        if (ttl > 0) {
          await this.redisSetexAsync(key, ttl, serialized);
        } else {
          await this.redisSetAsync(key, serialized);
        }
      }

      // Set in Memcached (async)
      if (this.memcachedClient) {
        await this.memcachedSetAsync(key, serialized, ttl);
      }

      return true;
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Delete key from distributed cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      if (this.redisClient) {
        await this.redisDelAsync(key);
      }

      if (this.memcachedClient) {
        await this.memcachedDelAsync(key);
      }

      return true;
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Get multiple keys
   */
  async mget<T = any>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();

    try {
      if (this.redisClient) {
        const values = await this.redisMgetAsync(keys);
        keys.forEach((key, index) => {
          if (values[index]) {
            result.set(key, JSON.parse(values[index]));
          }
        });
        return result;
      }
    } catch (error) {
      this.logger.error(`Error getting multiple keys: ${error}`);
    }

    return result;
  }

  /**
   * Set multiple keys
   */
  async mset<T = any>(
    entries: Map<string, T>,
    ttl: number = 3600,
  ): Promise<boolean> {
    try {
      if (this.redisClient) {
        const pipeline = this.redisClient.pipeline();

        for (const [key, value] of entries) {
          const serialized = JSON.stringify(value);
          if (ttl > 0) {
            pipeline.setex(key, ttl, serialized);
          } else {
            pipeline.set(key, serialized);
          }
        }

        await this.redisExecAsync(pipeline);
      }

      return true;
    } catch (error) {
      this.logger.error(`Error setting multiple keys: ${error}`);
      return false;
    }
  }

  /**
   * Increment counter
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      if (this.redisClient) {
        return await this.redisIncrbyAsync(key, amount);
      }
    } catch (error) {
      this.logger.error(`Error incrementing key ${key}: ${error}`);
    }

    return 0;
  }

  /**
   * Get expiration time in seconds
   */
  async ttl(key: string): Promise<number> {
    try {
      if (this.redisClient) {
        return await this.redisTtlAsync(key);
      }
    } catch (error) {
      this.logger.error(`Error getting TTL for key ${key}: ${error}`);
    }

    return -2; // Key doesn't exist
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    try {
      if (this.redisClient) {
        await this.redisFlushdbAsync();
      }

      if (this.memcachedClient) {
        await this.memcachedFlushAsync();
      }

      this.logger.log('Cache cleared');
      return true;
    } catch (error) {
      this.logger.error(`Error clearing cache: ${error}`);
      return false;
    }
  }

  /**
   * Get cache info/stats
   */
  async getStats(): Promise<any> {
    try {
      if (this.redisClient) {
        const info = await this.redisInfoAsync('stats');
        return {
          connected_clients: this.parseRedisInfo(info, 'connected_clients'),
          used_memory: this.parseRedisInfo(info, 'used_memory_human'),
          ops_per_sec: this.parseRedisInfo(info, 'instantaneous_ops_per_sec'),
          total_commands_processed: this.parseRedisInfo(
            info,
            'total_commands_processed',
          ),
        };
      }
    } catch (error) {
      this.logger.error(`Error getting cache stats: ${error}`);
    }

    return null;
  }

  /**
   * Private async helpers for Redis
   */

  private redisGetAsync(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.redisClient.get(key, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  }

  private redisSetAsync(key: string, value: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.redisClient.set(key, value, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private redisSetexAsync(
    key: string,
    ttl: number,
    value: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.redisClient.setex(key, ttl, value, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private redisDelAsync(key: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.redisClient.del(key, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  }

  private redisMgetAsync(keys: string[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.redisClient.mget(...keys, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  }

  private redisIncrbyAsync(key: string, amount: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.redisClient.incrby(key, amount, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  }

  private redisTtlAsync(key: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.redisClient.ttl(key, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  }

  private redisFlushdbAsync(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.redisClient.flushdb((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private redisInfoAsync(section: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.redisClient.info(section, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  }

  private redisExecAsync(pipeline: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
      pipeline.exec((err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  }

  /**
   * Private async helpers for Memcached
   */

  private memcachedGetAsync(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.memcachedClient.get(key, (err, data) => {
        if (err) reject(err);
        else resolve(data || null);
      });
    });
  }

  private memcachedSetAsync(
    key: string,
    value: string,
    ttl: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.memcachedClient.set(key, value, ttl, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private memcachedDelAsync(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.memcachedClient.del(key, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private memcachedFlushAsync(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.memcachedClient.flush((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private parseRedisInfo(info: string, key: string): string {
    const lines = info.split('\r\n');
    for (const line of lines) {
      if (line.startsWith(key)) {
        return line.split(':')[1];
      }
    }
    return '';
  }
}
