import { Test, TestingModule } from '@nestjs/testing';
import { UserAnalyticsService } from './user-analytics.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import pino from 'pino';

describe('UserAnalyticsService', () => {
  let service: UserAnalyticsService;
  let mockElasticsearchService: Partial<ElasticsearchService>;
  const logger = pino();

  beforeEach(async () => {
    mockElasticsearchService = {
      index: jest.fn(),
      search: jest.fn(),
      countDocuments: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAnalyticsService,
        { provide: ElasticsearchService, useValue: mockElasticsearchService },
        { provide: 'LOGGER', useValue: logger },
      ],
    }).compile();

    service = module.get<UserAnalyticsService>(UserAnalyticsService);
  });

  describe('Event Tracking', () => {
    it('should track user event', async () => {
      (mockElasticsearchService.index as jest.Mock).mockResolvedValue(true);

      await service.trackEvent({
        userId: 'user123',
        eventType: 'watch',
        timestamp: Date.now(),
        metadata: { contentId: 'movie123' },
      });

      expect(mockElasticsearchService.index).toHaveBeenCalled();
    });

    it('should track watch event', async () => {
      (mockElasticsearchService.index as jest.Mock).mockResolvedValue(true);

      await service.trackWatch('user123', 'movie123', 'The Matrix', 7200, 'Action');

      expect(mockElasticsearchService.index).toHaveBeenCalledWith(
        'user-events',
        expect.objectContaining({
          userId: 'user123',
          eventType: 'watch',
        })
      );
    });

    it('should track search event', async () => {
      (mockElasticsearchService.index as jest.Mock).mockResolvedValue(true);

      await service.trackSearch('user123', 'Action movies', 50);

      expect(mockElasticsearchService.index).toHaveBeenCalledWith(
        'user-events',
        expect.objectContaining({
          eventType: 'search',
          metadata: expect.objectContaining({ resultsCount: 50 }),
        })
      );
    });

    it('should track rating event', async () => {
      (mockElasticsearchService.index as jest.Mock).mockResolvedValue(true);

      await service.trackRating('user123', 'movie123', 4.5);

      expect(mockElasticsearchService.index).toHaveBeenCalledWith(
        'user-events',
        expect.objectContaining({
          eventType: 'rating',
          metadata: expect.objectContaining({ rating: 4.5 }),
        })
      );
    });
  });

  describe('User Analytics', () => {
    it('should get user analytics', async () => {
      (mockElasticsearchService.search as jest.Mock).mockResolvedValue({
        hits: {
          hits: [
            {
              _source: {
                metadata: {
                  contentId: 'movie123',
                  title: 'The Matrix',
                  duration: 7200,
                  genre: 'Action',
                },
                timestamp: Date.now(),
              },
            },
          ],
        },
        aggregations: {
          totalWatched: { value: 10 },
          totalDuration: { value: 72000 },
          avgDuration: { value: 7200 },
          genres: { buckets: [{ key: 'Action', doc_count: 5 }] },
          lastActive: { value: Date.now() },
        },
      });

      const analytics = await service.getUserAnalytics('user123');

      expect(analytics.userId).toBe('user123');
      expect(analytics.totalWatched).toBe(10);
      expect(analytics.engagementScore).toBeGreaterThan(0);
    });

    it('should calculate engagement score', async () => {
      (mockElasticsearchService.search as jest.Mock).mockResolvedValue({
        hits: { hits: [] },
        aggregations: {
          totalWatched: { value: 50 },
          totalDuration: { value: 360000 },
          avgDuration: { value: 7200 },
          genres: { buckets: [{ key: 'Action', doc_count: 20 }] },
          lastActive: { value: Date.now() },
        },
      });

      const analytics = await service.getUserAnalytics('user123');

      expect(analytics.engagementScore).toBeGreaterThan(50);
    });
  });

  describe('Content Popularity', () => {
    it('should get content popularity', async () => {
      (mockElasticsearchService.search as jest.Mock).mockResolvedValue({
        hits: { hits: [] },
        aggregations: {
          views: { value: 1000 },
          avgRating: { value: 4.5 },
          totalDuration: { value: 7200000 },
        },
      });
      (mockElasticsearchService.countDocuments as jest.Mock).mockResolvedValue(900);

      const popularity = await service.getContentPopularity('movie123');

      expect(popularity.contentId).toBe('movie123');
      expect(popularity.views).toBe(1000);
      expect(popularity.dropoffRate).toBeLessThan(100);
    });
  });

  describe('Trending Content', () => {
    it('should get trending content', async () => {
      (mockElasticsearchService.search as jest.Mock).mockResolvedValue({
        hits: { hits: [] },
        aggregations: {
          contents: {
            buckets: [
              {
                key: 'movie123',
                views: { value: 500 },
                avgRating: { value: 4.5 },
                totalDuration: { value: 3600000 },
              },
            ],
          },
        },
      });

      const trending = await service.getTrendingContent(24, 10);

      expect(Array.isArray(trending)).toBe(true);
      expect(trending.length).toBeGreaterThan(0);
    });
  });

  describe('Cohort Analysis', () => {
    it('should get cohort analysis', async () => {
      (mockElasticsearchService.search as jest.Mock).mockResolvedValue({
        aggregations: {
          userCohorts: {
            buckets: [
              {
                key_as_string: '2026-10-12T00:00:00.000Z',
                uniqueUsers: { value: 100 },
                avgWatchTime: { value: 7200 },
              },
            ],
          },
        },
      });

      const cohorts = await service.getCohortAnalysis(100);

      expect(cohorts.cohorts).toBeDefined();
      expect(Array.isArray(cohorts.cohorts)).toBe(true);
    });
  });
});
