import { Injectable, Logger } from '@nestjs/common';
import { CacheStore } from './cache.store';

export interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl?: number; // milliseconds
  hits: number;
  size: number; // bytes
  tags?: string[];
}

export interface CacheConfig {
  maxSize: number; // bytes
  defaultTtl: number; // milliseconds
  maxEntries: number;
  strategy: 'LRU' | 'LFU' | 'FIFO' | 'TTL';
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  entryCount: number;
  hitRate: number;
  avgAccessTime: number;
}

@Injectable()
export class CacheStrategies {
  private readonly logger = new Logger(CacheStrategies.name);
  private store: Map<string, CacheEntry> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    accessTimes: [] as number[],
  };

  constructor(private config: CacheConfig) {
    this.validateConfig();
    if (config.strategy === 'TTL') {
      this.startTTLCleanup();
    }
  }

  private validateConfig(): void {
    if (this.config.maxSize < 1024) {
      throw new Error('Cache maxSize must be at least 1KB');
    }
    if (this.config.maxEntries < 1) {
      throw new Error('Cache maxEntries must be at least 1');
    }
  }

  /**
   * Get value from cache with LRU/LFU/FIFO/TTL strategy
   */
  get<T = any>(key: string): T | null {
    const startTime = performance.now();
    const entry = this.store.get(key);

    if (!entry) {
      this.stats.misses++;
      this.recordAccessTime(performance.now() - startTime);
      return null;
    }

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      this.stats.misses++;
      this.recordAccessTime(performance.now() - startTime);
      return null;
    }

    entry.hits++;
    this.stats.hits++;
    this.recordAccessTime(performance.now() - startTime);

    this.logger.debug(`Cache HIT for key: ${key} (hits: ${entry.hits})`);
    return entry.value as T;
  }

  /**
   * Set value in cache with automatic eviction
   */
  set<T = any>(
    key: string,
    value: T,
    ttl?: number,
    tags?: string[],
  ): boolean {
    const size = this.estimateSize(value);

    if (size > this.config.maxSize) {
      this.logger.warn(
        `Value for key "${key}" exceeds max cache size (${size} > ${this.config.maxSize})`,
      );
      return false;
    }

    // Remove old entry if exists
    if (this.store.has(key)) {
      this.store.delete(key);
    }

    // Check if we need to evict
    if (this.isCacheFull(size)) {
      this.evictByStrategy(size);
    }

    const entry: CacheEntry = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTtl,
      hits: 0,
      size,
      tags,
    };

    this.store.set(key, entry);
    this.logger.debug(`Cache SET for key: ${key} (size: ${size} bytes)`);
    return true;
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear cache by tag
   */
  clearByTag(tag: string): number {
    let count = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.tags?.includes(tag)) {
        this.store.delete(key);
        count++;
      }
    }
    this.logger.debug(`Cleared ${count} entries with tag: ${tag}`);
    return count;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.store.clear();
    this.logger.debug('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    let totalSize = 0;
    for (const entry of this.store.values()) {
      totalSize += entry.size;
    }

    const hitRate =
      this.stats.hits + this.stats.misses === 0
        ? 0
        : this.stats.hits / (this.stats.hits + this.stats.misses);

    const avgAccessTime =
      this.stats.accessTimes.length === 0
        ? 0
        : this.stats.accessTimes.reduce((a, b) => a + b, 0) /
          this.stats.accessTimes.length;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      totalSize,
      entryCount: this.store.size,
      hitRate,
      avgAccessTime,
    };
  }

  /**
   * Private helper methods
   */

  private isCacheFull(neededSize: number): boolean {
    let totalSize = 0;
    for (const entry of this.store.values()) {
      totalSize += entry.size;
    }
    return (
      totalSize + neededSize > this.config.maxSize ||
      this.store.size >= this.config.maxEntries
    );
  }

  private evictByStrategy(neededSize: number): void {
    switch (this.config.strategy) {
      case 'LRU':
        this.evictLRU(neededSize);
        break;
      case 'LFU':
        this.evictLFU(neededSize);
        break;
      case 'FIFO':
        this.evictFIFO(neededSize);
        break;
      case 'TTL':
        this.evictTTL(neededSize);
        break;
    }
  }

  private evictLRU(neededSize: number): void {
    // Least Recently Used - evict oldest accessed
    const sorted = Array.from(this.store.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp,
    );

    let freedSize = 0;
    for (const [key, entry] of sorted) {
      this.store.delete(key);
      freedSize += entry.size;
      this.stats.evictions++;

      if (freedSize >= neededSize) break;
    }
  }

  private evictLFU(neededSize: number): void {
    // Least Frequently Used - evict least accessed
    const sorted = Array.from(this.store.entries()).sort(
      (a, b) => a[1].hits - b[1].hits,
    );

    let freedSize = 0;
    for (const [key, entry] of sorted) {
      this.store.delete(key);
      freedSize += entry.size;
      this.stats.evictions++;

      if (freedSize >= neededSize) break;
    }
  }

  private evictFIFO(neededSize: number): void {
    // First In First Out - evict oldest
    const sorted = Array.from(this.store.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp,
    );

    let freedSize = 0;
    for (const [key, entry] of sorted) {
      this.store.delete(key);
      freedSize += entry.size;
      this.stats.evictions++;

      if (freedSize >= neededSize) break;
    }
  }

  private evictTTL(neededSize: number): void {
    // Time To Live - evict expired entries first
    const now = Date.now();
    let freedSize = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        this.store.delete(key);
        freedSize += entry.size;
        this.stats.evictions++;
      }
    }

    // If still need space, evict oldest
    if (freedSize < neededSize) {
      const sorted = Array.from(this.store.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp,
      );

      for (const [key, entry] of sorted) {
        this.store.delete(key);
        freedSize += entry.size;
        this.stats.evictions++;

        if (freedSize >= neededSize) break;
      }
    }
  }

  private estimateSize(value: any): number {
    if (typeof value === 'string') return value.length;
    if (typeof value === 'number') return 8;
    if (typeof value === 'boolean') return 1;
    if (value === null) return 0;
    if (typeof value === 'object') {
      return JSON.stringify(value).length;
    }
    return 0;
  }

  private recordAccessTime(time: number): void {
    this.stats.accessTimes.push(time);
    if (this.stats.accessTimes.length > 1000) {
      this.stats.accessTimes.shift();
    }
  }

  private startTTLCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.store.entries()) {
        if (entry.ttl && now - entry.timestamp > entry.ttl) {
          this.store.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.logger.debug(`TTL cleanup: removed ${cleaned} expired entries`);
      }
    }, 60000); // Run every minute
  }
}
