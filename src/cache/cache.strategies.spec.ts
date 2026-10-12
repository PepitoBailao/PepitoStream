import { Test } from '@nestjs/testing';
import { CacheStrategies } from './cache.strategies';

describe('CacheStrategies', () => {
  let cache: CacheStrategies;

  beforeEach(() => {
    cache = new CacheStrategies({
      maxSize: 10 * 1024 * 1024, // 10MB
      defaultTtl: 3600000,
      maxEntries: 1000,
      strategy: 'LRU',
    });
  });

  describe('Basic Operations', () => {
    it('should set and get value', () => {
      cache.set('test-key', { data: 'value' });
      const result = cache.get('test-key');
      expect(result).toEqual({ data: 'value' });
    });

    it('should return null for non-existent key', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should delete key', () => {
      cache.set('test-key', 'value');
      expect(cache.delete('test-key')).toBe(true);
      expect(cache.get('test-key')).toBeNull();
    });

    it('should clear all cache', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('TTL Strategy', () => {
    it('should expire entry after TTL', (done) => {
      cache.set('ttl-key', 'value', 100); // 100ms TTL
      expect(cache.get('ttl-key')).toEqual('value');

      setTimeout(() => {
        expect(cache.get('ttl-key')).toBeNull();
        done();
      }, 150);
    });

    it('should use default TTL', () => {
      cache.set('default-ttl', 'value');
      const result = cache.get('default-ttl');
      expect(result).toEqual('value');
    });
  });

  describe('Tagging System', () => {
    it('should clear entries by tag', () => {
      cache.set('user:1', { id: 1 }, undefined, ['user', 'profile']);
      cache.set('user:2', { id: 2 }, undefined, ['user', 'profile']);
      cache.set('post:1', { id: 1 }, undefined, ['post']);

      const count = cache.clearByTag('user');
      expect(count).toBe(2);
      expect(cache.get('user:1')).toBeNull();
      expect(cache.get('post:1')).not.toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('non-existent'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('should calculate hit rate', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');
      cache.get('non-existent');

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(2 / 3);
    });

    it('should track evictions', () => {
      const smallCache = new CacheStrategies({
        maxSize: 1024, // 1KB
        defaultTtl: 3600000,
        maxEntries: 2,
        strategy: 'LRU',
      });

      smallCache.set('key1', 'a'.repeat(512));
      smallCache.set('key2', 'b'.repeat(512));
      smallCache.set('key3', 'c'.repeat(512)); // Should evict key1

      const stats = smallCache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used', () => {
      const lruCache = new CacheStrategies({
        maxSize: 1024 * 1024,
        defaultTtl: 3600000,
        maxEntries: 3,
        strategy: 'LRU',
      });

      lruCache.set('key1', 'value1');
      lruCache.set('key2', 'value2');
      lruCache.set('key3', 'value3');

      // Access key1 and key2 to make key3 least recently used
      lruCache.get('key1');
      lruCache.get('key2');

      // Add new entry, should evict key3
      lruCache.set('key4', 'value4');

      expect(lruCache.get('key3')).toBeNull();
      expect(lruCache.get('key1')).not.toBeNull();
    });
  });

  describe('LFU Eviction', () => {
    it('should evict least frequently used', () => {
      const lfuCache = new CacheStrategies({
        maxSize: 1024 * 1024,
        defaultTtl: 3600000,
        maxEntries: 3,
        strategy: 'LFU',
      });

      lfuCache.set('key1', 'value1');
      lfuCache.set('key2', 'value2');
      lfuCache.set('key3', 'value3');

      // Access key1 and key2 more frequently
      lfuCache.get('key1');
      lfuCache.get('key1');
      lfuCache.get('key2');

      // Add new entry, should evict key3 (least frequently used)
      lfuCache.set('key4', 'value4');

      expect(lfuCache.get('key3')).toBeNull();
      expect(lfuCache.get('key1')).not.toBeNull();
    });
  });

  describe('Size Management', () => {
    it('should respect max cache size', () => {
      const sizedCache = new CacheStrategies({
        maxSize: 1024,
        defaultTtl: 3600000,
        maxEntries: 1000,
        strategy: 'LRU',
      });

      const largeData = 'x'.repeat(512);
      sizedCache.set('key1', largeData);
      sizedCache.set('key2', largeData);

      const stats = sizedCache.getStats();
      expect(stats.totalSize).toBeLessThanOrEqual(1024);
    });

    it('should reject oversized entries', () => {
      const sizedCache = new CacheStrategies({
        maxSize: 100, // 100 bytes
        defaultTtl: 3600000,
        maxEntries: 1000,
        strategy: 'LRU',
      });

      const result = sizedCache.set('key1', 'x'.repeat(500));
      expect(result).toBe(false);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle mixed operations', () => {
      cache.set('user:1', { name: 'Alice' }, undefined, ['user']);
      cache.set('user:2', { name: 'Bob' }, undefined, ['user']);
      cache.set('post:1', { title: 'Post 1' }, undefined, ['post']);

      expect(cache.get('user:1')).not.toBeNull();
      cache.get('user:1');
      cache.get('user:1');

      cache.clearByTag('post');
      expect(cache.get('post:1')).toBeNull();
      expect(cache.get('user:1')).not.toBeNull();

      const stats = cache.getStats();
      expect(stats.hits).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should handle large number of entries efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        cache.set(`key-${i}`, `value-${i}`);
      }

      const setTime = performance.now() - startTime;
      expect(setTime).toBeLessThan(1000); // Should complete in < 1 second

      const getStartTime = performance.now();
      for (let i = 0; i < 1000; i++) {
        cache.get(`key-${i}`);
      }
      const getTime = performance.now() - getStartTime;
      expect(getTime).toBeLessThan(1000);
    });
  });
});
