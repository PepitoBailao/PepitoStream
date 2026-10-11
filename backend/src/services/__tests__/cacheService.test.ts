/**
 * Tests Cache Service
 * Coverage: TTL, compression, eviction, LRU, cleanup
 */

import { CacheService } from '../cacheService';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService({
      maxSize: 10,
      defaultTTL: 1000,
      compressionThreshold: 100,
      cleanupInterval: 500,
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('SET/GET - Basic Operations', () => {
    test('should set and get data <10ms', async () => {
      const testData = { title: 'Breaking Bad', year: 2008 };
      const setResult = await cache.set('series', 'breaking-bad', testData);

      expect(setResult.success).toBe(true);
      expect(setResult.responseTime).toBeLessThan(10);

      const getResult = await cache.get('series', 'breaking-bad');
      expect(getResult.hit).toBe(true);
      expect(getResult.data).toEqual(testData);
      expect(getResult.responseTime).toBeLessThan(10);
      expect(getResult.from).toBe('cache');
    });

    test('should return null for non-existent key', async () => {
      const result = await cache.get('series', 'non-existent');
      expect(result.hit).toBe(false);
      expect(result.data).toBe(null);
    });

    test('should handle custom TTL', async () => {
      const testData = { title: 'Dune' };
      await cache.set('movie', 'dune', testData, 100); // 100ms TTL

      // Immediate read = hit
      let result = await cache.get('movie', 'dune');
      expect(result.hit).toBe(true);

      // Wait for expiry
      await new Promise((r) => setTimeout(r, 150));

      result = await cache.get('movie', 'dune');
      expect(result.hit).toBe(false);
    });

    test('should handle large data with compression', async () => {
      const largeData = {
        items: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: i,
            title: `Item ${i}`,
            description: 'A'.repeat(100),
          })),
      };

      const setResult = await cache.set('data', 'large', largeData);
      expect(setResult.success).toBe(true);

      const getResult = await cache.get('data', 'large');
      expect(getResult.hit).toBe(true);
      expect(getResult.data).toEqual(largeData);
    });

    test('should increment hits on successful gets', async () => {
      const testData = { title: 'Test' };
      await cache.set('test', 'item', testData);

      await cache.get('test', 'item');
      await cache.get('test', 'item');
      await cache.get('test', 'item');

      const stats = cache.getStats();
      expect(stats.hitRate).toBeGreaterThan(0);
    });
  });

  describe('Invalidation', () => {
    test('should invalidate specific key', async () => {
      await cache.set('series', 'test', { title: 'Test' });

      let result = await cache.get('series', 'test');
      expect(result.hit).toBe(true);

      const invalidated = await cache.invalidate('series', 'test');
      expect(invalidated).toBe(true);

      result = await cache.get('series', 'test');
      expect(result.hit).toBe(false);
    });

    test('should invalidate entire namespace', async () => {
      await cache.set('series', 'breaking-bad', { title: 'Breaking Bad' });
      await cache.set('series', 'better-call-saul', { title: 'Better Call Saul' });
      await cache.set('movie', 'dune', { title: 'Dune' });

      const invalidated = await cache.invalidateNamespace('series');
      expect(invalidated).toBe(2);

      const series1 = await cache.get('series', 'breaking-bad');
      const series2 = await cache.get('series', 'better-call-saul');
      const movie = await cache.get('movie', 'dune');

      expect(series1.hit).toBe(false);
      expect(series2.hit).toBe(false);
      expect(movie.hit).toBe(true);
    });
  });

  describe('Search', () => {
    test('should search by pattern', async () => {
      await cache.set('series', 'breaking-bad', { title: 'Breaking Bad' });
      await cache.set('series', 'breaking-bad-s1', { title: 'Season 1' });
      await cache.set('movie', 'dune', { title: 'Dune' });

      const results = await cache.search('breaking', 'series');
      expect(results.results.length).toBe(2);
      expect(results.responseTime).toBeLessThan(10);
    });

    test('should return results sorted by hits', async () => {
      await cache.set('movie', 'dune', { title: 'Dune' });
      await cache.set('movie', 'dune2', { title: 'Dune Part Two' });

      // Hit dune multiple times
      await cache.get('movie', 'dune');
      await cache.get('movie', 'dune');

      const results = await cache.search('dune', 'movie');
      expect(results.results[0].hits).toBeGreaterThanOrEqual(results.results[1].hits);
    });

    test('should handle regex patterns', async () => {
      await cache.set('anime', 'naruto', { title: 'Naruto' });
      await cache.set('anime', 'naruto-shippuden', { title: 'Naruto Shippuden' });

      const results = await cache.search('naruto.*shipp', 'anime');
      expect(results.results.some((r) => r.key.includes('shippuden'))).toBe(true);
    });
  });

  describe('Performance & Stats', () => {
    test('should track hit rate correctly', async () => {
      await cache.set('test', 'item1', { data: 1 });
      await cache.set('test', 'item2', { data: 2 });

      await cache.get('test', 'item1'); // hit
      await cache.get('test', 'item1'); // hit
      await cache.get('test', 'missing'); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(66); // 2 hits, 3 ops = 66%
    });

    test('should calculate average response time', async () => {
      for (let i = 0; i < 10; i++) {
        await cache.set('test', `item${i}`, { id: i });
      }

      for (let i = 0; i < 10; i++) {
        await cache.get('test', `item${i}`);
      }

      const stats = cache.getStats();
      expect(stats.avgResponseTime).toBeLessThan(5); // Should be <5ms
    });

    test('should track cache size in MB', async () => {
      const largeData = { data: 'x'.repeat(50000) };
      await cache.set('test', 'large', largeData);

      const stats = cache.getStats();
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.totalEntries).toBe(1);
    });

    test('should export stats as JSON', async () => {
      await cache.set('test', 'item', { data: 'test' });
      const statsJson = cache.exportStats();

      const parsed = JSON.parse(statsJson);
      expect(parsed.totalEntries).toBe(1);
      expect(parsed.hitRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cleanup & Eviction', () => {
    test('should cleanup expired entries', async () => {
      await cache.set('test', 'item1', { data: 1 }, 100);
      await cache.set('test', 'item2', { data: 2 }, 100);

      await new Promise((r) => setTimeout(r, 150));
      // Cleanup runs every 500ms, so wait a bit
      await new Promise((r) => setTimeout(r, 600));

      const result1 = await cache.get('test', 'item1');
      const result2 = await cache.get('test', 'item2');

      expect(result1.hit).toBe(false);
      expect(result2.hit).toBe(false);
    });

    test('should evict LRU when memory limit reached', async () => {
      // Set max size to 10MB and fill it
      const bigData = { content: 'x'.repeat(10000) };

      // This should trigger eviction
      for (let i = 0; i < 15; i++) {
        await cache.set('test', `item${i}`, bigData);
      }

      const stats = cache.getStats();
      expect(stats.totalSize).toBeLessThanOrEqual(10);
    });
  });

  describe('Versioning', () => {
    test('should support versioned caching', async () => {
      const dataV1 = { version: 1 };
      const dataV2 = { version: 2 };

      await cache.set('config', 'app', dataV1, 3600000, 'v1');
      await cache.set('config', 'app', dataV2, 3600000, 'v2');

      const resultV1 = await cache.get('config', 'app', 'v1');
      const resultV2 = await cache.get('config', 'app', 'v2');

      expect(resultV1.data).toEqual(dataV1);
      expect(resultV2.data).toEqual(dataV2);
    });
  });

  describe('Error Handling', () => {
    test('should handle circular references gracefully', async () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      const result = await cache.set('test', 'circular', circular);
      // Should fail gracefully
      expect(result.success).toBeFalsy();
    });

    test('should handle concurrent operations', async () => {
      const promises = [];

      for (let i = 0; i < 20; i++) {
        promises.push(cache.set('test', `item${i}`, { id: i }));
      }

      const results = await Promise.all(promises);
      expect(results.every((r) => r.success)).toBe(true);

      const stats = cache.getStats();
      expect(stats.totalEntries).toBeGreaterThan(0);
    });
  });

  describe('Clear', () => {
    test('should clear all cache', async () => {
      await cache.set('series', 'test1', { data: 1 });
      await cache.set('movie', 'test2', { data: 2 });

      cache.clear();

      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });
});
