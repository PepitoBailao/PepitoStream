/**
 * Cache Service - Ultra-rapide <10ms
 * Inspiration: Lumio V2 avec <10ms response time
 */

import crypto from 'crypto';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
  compressed?: boolean;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  avgResponseTime: number;
  memory: NodeJS.MemoryUsage;
}

interface CacheConfig {
  maxSize: number; // MB
  defaultTTL: number; // ms
  compressionThreshold: number; // bytes
  cleanupInterval: number; // ms
}

export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private stats = {
    hits: 0,
    misses: 0,
    totalTime: 0,
    operations: 0,
  };
  private config: CacheConfig;
  private cleanupTimer: NodeJS.Timer | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize || 500, // 500 MB
      defaultTTL: config.defaultTTL || 3600000, // 1h
      compressionThreshold: config.compressionThreshold || 10240, // 10KB
      cleanupInterval: config.cleanupInterval || 60000, // 1 min
    };
    this.startCleanup();
  }

  /**
   * Génère une clé de cache optimisée
   */
  private generateKey(namespace: string, identifier: string, version: string = 'v1'): string {
    const hash = crypto
      .createHash('md5')
      .update(`${namespace}:${identifier}:${version}`)
      .digest('hex');
    return `${namespace}:${hash}`;
  }

  /**
   * Compresse les données larges
   */
  private compress(data: any): { data: any; compressed: boolean } {
    const json = JSON.stringify(data);
    if (json.length > this.config.compressionThreshold) {
      const zlib = require('zlib');
      const compressed = zlib.deflateSync(json);
      return { data: compressed.toString('base64'), compressed: true };
    }
    return { data, compressed: false };
  }

  /**
   * Décompresse les données
   */
  private decompress(entry: CacheEntry<any>): any {
    if (entry.compressed) {
      const zlib = require('zlib');
      const buffer = Buffer.from(entry.data, 'base64');
      const decompressed = zlib.inflateSync(buffer);
      return JSON.parse(decompressed.toString());
    }
    return entry.data;
  }

  /**
   * Écrit en cache avec timing
   */
  async set<T>(
    namespace: string,
    identifier: string,
    data: T,
    ttl: number = this.config.defaultTTL,
    version: string = 'v1'
  ): Promise<{ success: boolean; cacheKey: string; responseTime: number }> {
    const startTime = performance.now();
    const key = this.generateKey(namespace, identifier, version);

    try {
      const { data: compressedData, compressed } = this.compress(data);
      const json = JSON.stringify(compressedData);
      const size = Buffer.byteLength(json, 'utf8');

      // Vérifier limite mémoire
      const totalSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
      if ((totalSize + size) / (1024 * 1024) > this.config.maxSize) {
        this.evictLRU();
      }

      this.cache.set(key, {
        data: compressedData,
        timestamp: Date.now(),
        ttl,
        hits: 0,
        size,
        compressed,
      });

      const responseTime = performance.now() - startTime;
      this.stats.operations++;
      this.stats.totalTime += responseTime;

      return { success: true, cacheKey: key, responseTime };
    } catch (error) {
      console.error(`Cache SET error for ${key}:`, error);
      return { success: false, cacheKey: key, responseTime: performance.now() - startTime };
    }
  }

  /**
   * Lit du cache (ultra-rapide <10ms)
   */
  async get<T>(
    namespace: string,
    identifier: string,
    version: string = 'v1'
  ): Promise<{ data: T | null; hit: boolean; responseTime: number; from: string }> {
    const startTime = performance.now();
    const key = this.generateKey(namespace, identifier, version);

    try {
      const entry = this.cache.get(key);

      // Cache miss
      if (!entry) {
        this.stats.misses++;
        const responseTime = performance.now() - startTime;
        return { data: null, hit: false, responseTime, from: 'none' };
      }

      // TTL expiré
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.stats.misses++;
        const responseTime = performance.now() - startTime;
        return { data: null, hit: false, responseTime, from: 'none' };
      }

      // Cache hit
      entry.hits++;
      this.stats.hits++;
      const decompressed = this.decompress(entry);

      const responseTime = performance.now() - startTime;
      this.stats.totalTime += responseTime;
      this.stats.operations++;

      return {
        data: decompressed as T,
        hit: true,
        responseTime,
        from: 'cache',
      };
    } catch (error) {
      console.error(`Cache GET error for ${key}:`, error);
      return { data: null, hit: false, responseTime: performance.now() - startTime, from: 'error' };
    }
  }

  /**
   * Pattern matching search (pour recherche rapide)
   */
  async search<T>(
    pattern: string,
    namespace?: string
  ): Promise<{ results: Array<{ key: string; data: T; hits: number }>; responseTime: number }> {
    const startTime = performance.now();
    const results = [];

    try {
      const regex = new RegExp(pattern, 'i');

      for (const [key, entry] of this.cache.entries()) {
        // Filter par namespace si spécifié
        if (namespace && !key.startsWith(namespace)) continue;

        // Match pattern
        if (regex.test(key)) {
          // Vérifier TTL
          if (Date.now() - entry.timestamp <= entry.ttl) {
            results.push({
              key,
              data: this.decompress(entry) as T,
              hits: entry.hits,
            });
          } else {
            this.cache.delete(key);
          }
        }
      }

      // Trier par hits (most popular first)
      results.sort((a, b) => b.hits - a.hits);

      const responseTime = performance.now() - startTime;
      return { results, responseTime };
    } catch (error) {
      console.error('Cache SEARCH error:', error);
      return { results: [], responseTime: performance.now() - startTime };
    }
  }

  /**
   * Invalide une clé spécifique
   */
  async invalidate(namespace: string, identifier: string, version: string = 'v1'): Promise<boolean> {
    const key = this.generateKey(namespace, identifier, version);
    return this.cache.delete(key);
  }

  /**
   * Invalide tout un namespace
   */
  async invalidateNamespace(namespace: string): Promise<number> {
    let count = 0;
    for (const [key] of this.cache.entries()) {
      if (key.startsWith(namespace)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * LRU Eviction - supprime l'entrée la moins utilisée
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruHits = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < lruHits) {
        lruHits = entry.hits;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Cleanup automatique des entrées expirées
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      let cleaned = 0;
      const now = Date.now();

      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`[Cache] Cleaned ${cleaned} expired entries`);
      }
    }, this.config.cleanupInterval);
  }

  /**
   * Arrête le cleanup
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  /**
   * Statistiques détaillées
   */
  getStats(): CacheStats {
    const totalSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
    const hitRate = this.stats.operations > 0 ? this.stats.hits / this.stats.operations : 0;
    const avgResponseTime = this.stats.operations > 0 ? this.stats.totalTime / this.stats.operations : 0;

    return {
      totalEntries: this.cache.size,
      totalSize: Math.round((totalSize / (1024 * 1024)) * 100) / 100, // MB
      hitRate: Math.round(hitRate * 100),
      avgResponseTime: Math.round(avgResponseTime * 100) / 100, // ms
      memory: process.memoryUsage(),
    };
  }

  /**
   * Reset complet
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, totalTime: 0, operations: 0 };
  }

  /**
   * Export stats JSON
   */
  exportStats(): string {
    return JSON.stringify(this.getStats(), null, 2);
  }
}

// Singleton global
export const cacheService = new CacheService({
  maxSize: 500,
  defaultTTL: 3600000, // 1h
  compressionThreshold: 10240, // 10KB
  cleanupInterval: 60000, // 1 min
});
