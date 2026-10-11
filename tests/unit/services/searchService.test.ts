import { SearchService } from '../../../src/services/searchService';

describe('SearchService', () => {
  let searchService: SearchService;

  beforeEach(() => {
    searchService = new SearchService();
  });

  describe('search', () => {
    it('should return search results', async () => {
      const results = await searchService.search('breaking bad', { limit: 10 });
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should filter by type', async () => {
      const results = await searchService.search('anime', { 
        type: 'ANIME',
        limit: 5 
      });
      expect(results).toBeDefined();
    });

    it('should handle empty search', async () => {
      const results = await searchService.search('', { limit: 10 });
      expect(results).toBeDefined();
    });
  });

  describe('getPopular', () => {
    it('should return popular content', async () => {
      const results = await searchService.getPopular({ limit: 10 });
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });
});