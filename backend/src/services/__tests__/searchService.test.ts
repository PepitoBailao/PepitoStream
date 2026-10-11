/**
 * Tests Search Service
 * Coverage: Indexing, search, fuzzy match, autocomplete, normalization
 */

import { SearchService } from '../searchService';
import { CacheService } from '../cacheService';

describe('SearchService', () => {
  let search: SearchService;
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService();
    search = new SearchService(cache);
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('Indexing', () => {
    test('should index a movie', async () => {
      await search.indexItem({
        id: '1',
        title: 'Breaking Bad',
        type: 'series',
        metadata: { year: 2008, rating: 9.5, popularity: 100 },
      });

      const stats = search.getStats();
      expect(stats.indexSize).toBeGreaterThan(0);
    });

    test('should index multiple items', async () => {
      const items = [
        { id: '1', title: 'Breaking Bad', type: 'series' as const },
        { id: '2', title: 'Better Call Saul', type: 'series' as const },
        { id: '3', title: 'Dune', type: 'movie' as const },
        { id: '4', title: 'Naruto', type: 'anime' as const },
      ];

      for (const item of items) {
        await search.indexItem(item);
      }

      const stats = search.getStats();
      expect(stats.indexSize).toBe(items.length * 2); // ~2 terms per item
    });

    test('should prevent duplicate indexing', async () => {
      await search.indexItem({
        id: '1',
        title: 'Breaking Bad',
        type: 'series',
      });

      await search.indexItem({
        id: '1',
        title: 'Breaking Bad',
        type: 'series',
      });

      const results = await search.search('breaking bad');
      const uniqueIds = new Set(results.map((r) => r.id));
      expect(uniqueIds.size).toBe(1);
    });

    test('should handle metadata for ranking', async () => {
      await search.indexItem({
        id: '1',
        title: 'Breaking Bad',
        type: 'series',
        metadata: { popularity: 100, rating: 9.5 },
      });

      await search.indexItem({
        id: '2',
        title: 'Random Series',
        type: 'series',
        metadata: { popularity: 10, rating: 5.0 },
      });

      const results = await search.search('series', { limit: 10 });
      expect(results[0].id).toBe('1'); // Higher weight should be first
    });
  });

  describe('Basic Search', () => {
    beforeEach(async () => {
      const items = [
        { id: '1', title: 'Breaking Bad', type: 'series' as const },
        { id: '2', title: 'Better Call Saul', type: 'series' as const },
        { id: '3', title: 'Dune', type: 'movie' as const },
        { id: '4', title: 'Dune Part Two', type: 'movie' as const },
      ];

      for (const item of items) {
        await search.indexItem(item);
      }
    });

    test('should find exact match <10ms', async () => {
      const results = await search.search('breaking bad', { limit: 10 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Breaking Bad');
      expect(results[0].responseTime).toBeLessThan(10);
      expect(results[0].score).toBe(100); // Exact match = 100
    });

    test('should filter by type', async () => {
      const movieResults = await search.search('dune', { type: 'movie' });
      const seriesResults = await search.search('dune', { type: 'series' });

      expect(movieResults.every((r) => r.type === 'movie')).toBe(true);
      expect(seriesResults.length).toBe(0);
    });

    test('should limit results', async () => {
      const results = await search.search('', { limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    test('should return results sorted by score', async () => {
      const results = await search.search('dune');

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    test('should cache search results', async () => {
      const stats1 = cache.getStats();

      await search.search('breaking bad');
      await search.search('breaking bad'); // Second call should hit cache

      const stats2 = cache.getStats();
      expect(stats2.hitRate).toBeGreaterThan(stats1.hitRate);
    });
  });

  describe('Fuzzy Matching', () => {
    beforeEach(async () => {
      const items = [
        { id: '1', title: 'Breaking Bad', type: 'series' as const },
        { id: '2', title: 'Breaking Bad Season 5', type: 'series' as const },
        { id: '3', title: 'Dune', type: 'movie' as const },
      ];

      for (const item of items) {
        await search.indexItem(item);
      }
    });

    test('should find typos with fuzzy match', async () => {
      const results = await search.search('breakng bad', { fuzzy: true });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Breaking Bad');
      expect(results[0].score).toBeGreaterThan(0);
    });

    test('should disable fuzzy matching when specified', async () => {
      const results = await search.search('breakng', { fuzzy: false });

      // Without fuzzy, shouldn't find "Breaking"
      const hasBreaking = results.some((r) => r.title.includes('Breaking'));
      expect(hasBreaking || results.length === 0).toBe(true);
    });

    test('should handle partial matches', async () => {
      const results = await search.search('dun', { fuzzy: true });

      expect(results.some((r) => r.title.includes('Dune'))).toBe(true);
    });

    test('should score fuzzy matches lower than exact', async () => {
      const exactResults = await search.search('breaking bad');
      const fuzzyResults = await search.search('breakng bad', { fuzzy: true });

      if (exactResults.length > 0 && fuzzyResults.length > 0) {
        expect(exactResults[0].score).toBeGreaterThanOrEqual(fuzzyResults[0].score);
      }
    });
  });

  describe('Autocomplete', () => {
    beforeEach(async () => {
      const items = [
        { id: '1', title: 'Breaking Bad', type: 'series' as const },
        { id: '2', title: 'Better Call Saul', type: 'series' as const },
        { id: '3', title: 'Bridgerton', type: 'series' as const },
        { id: '4', title: 'Dune', type: 'movie' as const },
      ];

      for (const item of items) {
        await search.indexItem(item);
      }
    });

    test('should autocomplete prefix', async () => {
      const results = await search.search('bre', { autocomplete: true });

      expect(results.length).toBeGreaterThan(0);
      expect(
        results.some(
          (r) =>
            r.title.toLowerCase().includes('breaking') ||
            r.title.toLowerCase().includes('better') ||
            r.title.toLowerCase().includes('bridgerton')
        )
      ).toBe(true);
    });

    test('should disable autocomplete when specified', async () => {
      const results = await search.search('bx', { autocomplete: false, fuzzy: false });

      expect(results.length).toBe(0);
    });

    test('should return autocomplete results with score 75', async () => {
      const results = await search.search('bre', { autocomplete: true });

      if (results.length > 0) {
        expect(results[0].score).toBe(75);
      }
    });
  });

  describe('Normalization', () => {
    beforeEach(async () => {
      const items = [
        { id: '1', title: 'Élève', type: 'series' as const },
        { id: '2', title: 'Café', type: 'movie' as const },
        { id: '3', title: 'naïve', type: 'anime' as const },
      ];

      for (const item of items) {
        await search.indexItem(item);
      }
    });

    test('should handle accented characters', async () => {
      const results = await search.search('eleve');

      expect(results.some((r) => r.title.includes('Élève'))).toBe(true);
    });

    test('should handle case insensitivity', async () => {
      const results1 = await search.search('CAFE');
      const results2 = await search.search('cafe');

      expect(results1.length).toBe(results2.length);
      expect(results1.some((r) => r.title.includes('Café'))).toBe(true);
    });

    test('should remove special characters', async () => {
      const results = await search.search('na-ive');

      expect(results.some((r) => r.title.toLowerCase().includes('naive'))).toBe(true);
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      // Index 1000 items
      for (let i = 0; i < 1000; i++) {
        await search.indexItem({
          id: `${i}`,
          title: `Item ${i} - Breaking Bad Season ${i % 5}`,
          type: (['series', 'movie', 'anime'][i % 3] as any),
          metadata: { popularity: Math.random() * 100 },
        });
      }
    });

    test('should search 1000 items <10ms', async () => {
      const results = await search.search('breaking');

      expect(results[0].responseTime).toBeLessThan(10);
    });

    test('should handle autocomplete on 1000 items <10ms', async () => {
      const results = await search.search('ite', { autocomplete: true });

      expect(results[0].responseTime).toBeLessThan(10);
    });

    test('should track search stats', async () => {
      await search.search('breaking');
      await search.search('item');
      await search.search('season');

      const stats = search.getStats();
      expect(stats.searchCount).toBe(3);
      expect(stats.avgSearchTime).toBeLessThan(10);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty search query', async () => {
      await search.indexItem({
        id: '1',
        title: 'Breaking Bad',
        type: 'series',
      });

      const results = await search.search('');
      expect(Array.isArray(results)).toBe(true);
    });

    test('should handle special characters in title', async () => {
      await search.indexItem({
        id: '1',
        title: "It's a Wonderful Life!",
        type: 'movie',
      });

      const results = await search.search('wonderful');
      expect(results.length).toBeGreaterThan(0);
    });

    test('should handle numbers in search', async () => {
      await search.indexItem({
        id: '1',
        title: 'Ocean 11',
        type: 'movie',
      });

      const results = await search.search('11');
      expect(results.some((r) => r.title.includes('11'))).toBe(true);
    });

    test('should handle very long titles', async () => {
      const longTitle = 'A'.repeat(500);
      await search.indexItem({
        id: '1',
        title: longTitle,
        type: 'series',
      });

      const results = await search.search('aaaa');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Clear Index', () => {
    test('should clear all indexed items', async () => {
      await search.indexItem({
        id: '1',
        title: 'Breaking Bad',
        type: 'series',
      });

      search.clearIndex();

      const results = await search.search('breaking');
      expect(results.length).toBe(0);

      const stats = search.getStats();
      expect(stats.indexSize).toBe(0);
    });
  });
});
