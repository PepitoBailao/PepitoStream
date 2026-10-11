/**
 * Stream Controller Tests
 * Tests pour tous les endpoints API
 */

import { Test, TestingModule } from '@nestjs/testing';
import { StreamController } from './stream.controller';
import { CacheService } from '../../cache/cacheService';
import { SearchService } from '../../search/searchService';
import { QualityService } from '../../quality/qualityService';
import { AudioService } from '../../audio/audioService';
import { StreamService } from '../../stream/streamService';
import { BadRequestException, HttpException } from '@nestjs/common';

describe('StreamController', () => {
  let controller: StreamController;
  let cacheService: CacheService;
  let searchService: SearchService;
  let qualityService: QualityService;
  let audioService: AudioService;
  let streamService: StreamService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StreamController],
      providers: [
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            getHitRate: jest.fn().mockReturnValue(75),
            getStats: jest.fn(),
          },
        },
        {
          provide: SearchService,
          useValue: {
            search: jest.fn(),
            autocomplete: jest.fn(),
          },
        },
        {
          provide: QualityService,
          useValue: {
            scoreStream: jest.fn(),
          },
        },
        {
          provide: AudioService,
          useValue: {
            scoreAudioTracks: jest.fn(),
          },
        },
        {
          provide: StreamService,
          useValue: {
            getStream: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<StreamController>(StreamController);
    cacheService = module.get<CacheService>(CacheService);
    searchService = module.get<SearchService>(SearchService);
    qualityService = module.get<QualityService>(QualityService);
    audioService = module.get<AudioService>(AudioService);
    streamService = module.get<StreamService>(StreamService);
  });

  describe('searchStreams', () => {
    it('should return search results', async () => {
      const mockResults = [
        { id: '1', title: 'Breaking Bad' },
        { id: '2', title: 'Breaking Point' },
      ];

      jest.spyOn(cacheService, 'get').mockReturnValue(null);
      jest.spyOn(searchService, 'search').mockResolvedValue(mockResults);

      const result = await controller.searchStreams('breaking', 'fuzzy', '10', '0', 'relevance');

      expect(result.query).toBe('breaking');
      expect(result.type).toBe('fuzzy');
      expect(result.totalResults).toBe(2);
      expect(result.cacheHit).toBe(false);
    });

    it('should return cached results', async () => {
      const cachedResult = {
        query: 'breaking',
        type: 'fuzzy',
        totalResults: 2,
        results: [{ id: '1', title: 'Breaking Bad' }],
      };

      jest.spyOn(cacheService, 'get').mockReturnValue(cachedResult);

      const result = await controller.searchStreams('breaking', 'fuzzy', '10', '0', 'relevance');

      expect(result.cacheHit).toBe(true);
    });

    it('should throw BadRequestException for empty query', async () => {
      await expect(controller.searchStreams('', 'fuzzy')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid type', async () => {
      await expect(controller.searchStreams('breaking', 'invalid')).rejects.toThrow(BadRequestException);
    });

    it('should limit results to 100', async () => {
      const mockResults = Array(150).fill({ id: '1', title: 'Test' });

      jest.spyOn(cacheService, 'get').mockReturnValue(null);
      jest.spyOn(searchService, 'search').mockResolvedValue(mockResults);

      const result = await controller.searchStreams('test', 'fuzzy', '150', '0');

      expect(result.results.length).toBeLessThanOrEqual(100);
    });
  });

  describe('bulkSearch', () => {
    it('should search multiple queries', async () => {
      const mockResults = [
        { id: '1', title: 'Breaking Bad' },
      ];

      jest.spyOn(searchService, 'search').mockResolvedValue(mockResults);

      const result = await controller.bulkSearch({
        queries: ['Breaking Bad', 'Game of Thrones'],
      });

      expect(result.queries.length).toBe(2);
      expect(result.totalProcessingTime).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for empty queries', async () => {
      await expect(controller.bulkSearch({ queries: [] })).rejects.toThrow();
    });

    it('should throw error for > 50 queries', async () => {
      const queries = Array(51).fill('test');
      await expect(controller.bulkSearch({ queries })).rejects.toThrow();
    });
  });

  describe('autocomplete', () => {
    it('should return autocomplete suggestions', async () => {
      const mockSuggestions = ['Breaking Bad', 'Breaking Point'];

      jest.spyOn(cacheService, 'get').mockReturnValue(null);
      jest.spyOn(searchService, 'autocomplete').mockResolvedValue(mockSuggestions);

      const result = await controller.autocomplete('break', '10');

      expect(result.suggestions).toEqual(mockSuggestions);
    });

    it('should throw error for empty q parameter', async () => {
      await expect(controller.autocomplete('')).rejects.toThrow();
    });

    it('should limit to 50 suggestions', async () => {
      const suggestions = Array(60).fill('test');
      jest.spyOn(cacheService, 'get').mockReturnValue(null);
      jest.spyOn(searchService, 'autocomplete').mockResolvedValue(suggestions);

      const result = await controller.autocomplete('test', '60');

      // Le controller limite à 50
      expect(result.suggestions.length).toBeLessThanOrEqual(50);
    });
  });

  describe('getStream', () => {
    it('should return stream with quality and audio', async () => {
      const mockStream = {
        id: 'tt0903747',
        title: 'Breaking Bad',
        type: 'series',
        rating: 9.5,
        file: {
          audioTracks: [
            { language: 'fr', type: 'vf', codec: 'AC3', channels: '5.1' },
          ],
        },
        sources: [
          { id: '1', tracker: 'YGG', latency: 50, score: 95 },
        ],
      };

      jest.spyOn(cacheService, 'get').mockReturnValue(null);
      jest.spyOn(streamService, 'getStream').mockResolvedValue(mockStream);
      jest.spyOn(qualityService, 'scoreStream').mockReturnValue({
        profile: 'Pepito',
        resolution: '1080p',
        codec: 'H.265',
        bitrate: 8,
        score: 85,
      });
      jest.spyOn(audioService, 'scoreAudioTracks').mockReturnValue({
        language: 'fr',
        type: 'vf',
        codec: 'AC3',
        channels: '5.1',
        score: 90,
      });

      const result = await controller.getStream('tt0903747', 'vf', 'Pepito');

      expect(result.id).toBe('tt0903747');
      expect(result.quality).toBeDefined();
      expect(result.audio).toBeDefined();
      expect(result.sources).toBeDefined();
    });

    it('should throw 404 for non-existent stream', async () => {
      jest.spyOn(streamService, 'getStream').mockResolvedValue(null);

      await expect(controller.getStream('invalid-id')).rejects.toThrow();
    });

    it('should filter sources by maxLatency', async () => {
      const mockStream = {
        id: 'tt0903747',
        title: 'Breaking Bad',
        file: { audioTracks: [] },
        sources: [
          { id: '1', latency: 50 },
          { id: '2', latency: 200 },
          { id: '3', latency: 5000 },
        ],
      };

      jest.spyOn(cacheService, 'get').mockReturnValue(null);
      jest.spyOn(streamService, 'getStream').mockResolvedValue(mockStream);
      jest.spyOn(qualityService, 'scoreStream').mockReturnValue({
        score: 85,
      });
      jest.spyOn(audioService, 'scoreAudioTracks').mockReturnValue({
        score: 90,
      });

      const result = await controller.getStream('tt0903747', 'vf', 'Pepito', '100');

      // Seulement les sources avec latency <= 100
      expect(result.sources.length).toBe(1);
    });
  });

  describe('getSources', () => {
    it('should return sorted sources', async () => {
      const mockStream = {
        id: 'tt0903747',
        sources: [
          { id: '1', tracker: 'YGG', latency: 100, seeders: 50, score: 85 },
          { id: '2', tracker: 'C411', latency: 50, seeders: 200, score: 95 },
        ],
      };

      jest.spyOn(cacheService, 'get').mockReturnValue(null);
      jest.spyOn(streamService, 'getStream').mockResolvedValue(mockStream);

      const result = await controller.getSources('tt0903747', 'seeders');

      expect(result.sources[0].seeders).toBe(200);
    });

    it('should throw 404 for non-existent stream', async () => {
      jest.spyOn(streamService, 'getStream').mockResolvedValue(null);

      await expect(controller.getSources('invalid-id')).rejects.toThrow();
    });
  });

  describe('getAudioTracks', () => {
    it('should return audio tracks', async () => {
      const mockStream = {
        id: 'tt0903747',
        file: {
          audioTracks: [
            { language: 'fr', type: 'vf', codec: 'AC3' },
            { language: 'en', type: 'vo', codec: 'AC3' },
          ],
        },
      };

      jest.spyOn(streamService, 'getStream').mockResolvedValue(mockStream);

      const result = await controller.getAudioTracks('tt0903747');

      expect(result.audioTracks.length).toBe(2);
    });
  });

  describe('compareProfiles', () => {
    it('should compare all quality profiles', async () => {
      const mockStream = {
        id: 'tt0903747',
        file: { audioTracks: [{ language: 'fr' }] },
      };

      jest.spyOn(streamService, 'getStream').mockResolvedValue(mockStream);
      jest.spyOn(qualityService, 'scoreStream').mockReturnValue({ score: 85 });
      jest.spyOn(audioService, 'scoreAudioTracks').mockReturnValue({ score: 90 });

      const result = await controller.compareProfiles('tt0903747');

      expect(result.profiles.length).toBe(4);
      expect(result.profiles.map((p) => p.name)).toContain('PepitoCiné');
      expect(result.profiles.map((p) => p.name)).toContain('Pepito');
    });
  });
});
