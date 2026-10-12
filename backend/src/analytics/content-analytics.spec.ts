import { Test, TestingModule } from '@nestjs/testing';
import { ContentAnalyticsService } from './content-analytics.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import pino from 'pino';

describe('ContentAnalyticsService', () => {
  let service: ContentAnalyticsService;
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
        ContentAnalyticsService,
        { provide: ElasticsearchService, useValue: mockElasticsearchService },
        { provide: 'LOGGER', useValue: logger },
      ],
    }).compile();

    service = module.get<ContentAnalyticsService>(ContentAnalyticsService);
  });

  describe('Stream Metrics', () => {
    it('should track stream metrics', async () => {
      (mockElasticsearchService.index as jest.Mock).mockResolvedValue(true);

      await service.trackStreamMetrics('movie123', 'user123', {
        startTime: Date.now(),
        endTime: Date.now() + 7200000,
        duration: 7200000,
        bitrate: 5000,
        quality: '1080p',
        bufferingEvents: 2,
        errors: 0,
      });

      expect(mockElasticsearchService.index).toHaveBeenCalledWith(
        'stream-metrics',
        expect.objectContaining({
          contentId: 'movie123',
          userId: 'user123',
        })
      );
    });
  });

  describe('Content Performance', () => {
    it('should get content performance', async () => {
      (mockElasticsearchService.search as jest.Mock).mockResolvedValue({
        hits: { hits: [] },
        aggregations: {
          uniqueViews: { value: 1000 },
          avgDuration: { value: 7200 },
          totalDuration: { value: 7200000 },
          avgBitrate: { value: 5000 },
          bufferingAvg: { value: 1 },
          errorRate: { value: 0.1 },
          qualities: { buckets: [{ key: '1080p', doc_count: 500 }] },
          peakHours: { buckets: [{ key_as_string: '2026-10-12T20:00:00.000Z', doc_count: 100 }] },
        },
      });
      (mockElasticsearchService.countDocuments as jest.Mock).mockResolvedValue(950);

      const performance = await service.getContentPerformance('movie123');

      expect(performance.contentId).toBe('movie123');
      expect(performance.views).toBe(1000);
      expect(performance.completionRate).toBeGreaterThan(80);
    });
  });

  describe('Streaming Quality Report', () => {
    it('should get streaming quality report', async () => {
      (mockElasticsearchService.search as jest.Mock).mockResolvedValue({
        aggregations: {
          qualityTimeline: {
            buckets: [
              {
                key_as_string: '2026-10-12T00:00:00.000Z',
                qualities: { buckets: [{ key: '1080p', doc_count: 500 }] },
                avgBitrate: { value: 5000 },
                avgBuffering: { value: 1 },
                errorRate: { value: 0.1 },
              },
            ],
          },
        },
      });

      const report = await service.getStreamingQualityReport('day');

      expect(report.period).toBe('day');
      expect(Array.isArray(report.timeline)).toBe(true);
    });
  });

  describe('Device Distribution', () => {
    it('should get device distribution', async () => {
      (mockElasticsearchService.search as jest.Mock).mockResolvedValue({
        aggregations: {
          devices: {
            buckets: [
              {
                key: 'mobile',
                doc_count: 3000,
                avgBitrate: { value: 2000 },
                avgDuration: { value: 3600 },
              },
              {
                key: 'desktop',
                doc_count: 2000,
                avgBitrate: { value: 5000 },
                avgDuration: { value: 7200 },
              },
            ],
          },
        },
      });

      const distribution = await service.getDeviceDistribution();

      expect(distribution.devices).toBeDefined();
      expect(distribution.devices.length).toBe(2);
      expect(distribution.devices[0].device).toBe('mobile');
    });
  });

  describe('Geographic Distribution', () => {
    it('should get geographic distribution', async () => {
      (mockElasticsearchService.search as jest.Mock).mockResolvedValue({
        aggregations: {
          regions: {
            buckets: [
              {
                key: 'US',
                doc_count: 5000,
                views: { value: 2000 },
                avgDuration: { value: 7200 },
              },
              {
                key: 'FR',
                doc_count: 3000,
                views: { value: 1500 },
                avgDuration: { value: 6000 },
              },
            ],
          },
        },
      });

      const distribution = await service.getGeographicDistribution();

      expect(distribution.regions).toBeDefined();
      expect(distribution.regions.length).toBe(2);
      expect(distribution.regions[0].region).toBe('US');
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect streaming anomalies', async () => {
      (mockElasticsearchService.search as jest.Mock).mockResolvedValue({
        hits: {
          hits: [
            {
              _source: {
                contentId: 'movie123',
                userId: 'user123',
                bufferingEvents: 15,
                bitrate: 1000,
                quality: '480p',
              },
            },
          ],
        },
      });

      const anomalies = await service.detectAnomalies();

      expect(anomalies.highBufferingCount).toBeGreaterThan(0);
      expect(Array.isArray(anomalies.samples)).toBe(true);
    });
  });
});
