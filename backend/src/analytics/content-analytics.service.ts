import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { Logger } from 'pino';

export interface ContentPerformance {
  contentId: string;
  title: string;
  views: number;
  completionRate: number; // % users who finished
  avgRating: number;
  ratingDistribution: { stars: number; count: number }[];
  watchTime: number;
  avgWatchDuration: number;
  peakHours: { hour: number; views: number }[];
  devices: { device: string; views: number }[];
  regions: { region: string; views: number }[];
}

export interface StreamMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  bitrate: number;
  quality: string;
  bufferingEvents: number;
  errors: number;
  abandonedAt?: number; // If user stopped watching
}

@Injectable()
export class ContentAnalyticsService {
  private logger: Logger;

  constructor(
    private elasticsearchService: ElasticsearchService,
    logger: Logger
  ) {
    this.logger = logger.child({ context: 'ContentAnalyticsService' });
  }

  /**
   * Track stream metrics
   */
  async trackStreamMetrics(
    contentId: string,
    userId: string,
    metrics: StreamMetrics
  ): Promise<void> {
    try {
      await this.elasticsearchService.index('stream-metrics', {
        contentId,
        userId,
        ...metrics,
        '@timestamp': new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error({ error, contentId, userId }, 'Failed to track stream metrics');
    }
  }

  /**
   * Get content performance
   */
  async getContentPerformance(contentId: string): Promise<ContentPerformance> {
    try {
      const response = await this.elasticsearchService.search('stream-metrics', {
        query: { term: { contentId } },
        aggs: {
          uniqueViews: { cardinality: { field: 'userId.keyword' } },
          avgDuration: { avg: { field: 'duration' } },
          totalDuration: { sum: { field: 'duration' } },
          avgBitrate: { avg: { field: 'bitrate' } },
          bufferingAvg: { avg: { field: 'bufferingEvents' } },
          errorRate: { avg: { field: 'errors' } },
          qualities: { terms: { field: 'quality.keyword', size: 5 } },
          peakHours: {
            date_histogram: { field: '@timestamp', calendar_interval: 'hour' },
          },
        },
      });

      const aggs = response.aggregations || {};

      // Calculate completion rate (viewed more than 90% of duration)
      const completedCount = await this.elasticsearchService.countDocuments(
        'stream-metrics',
        {
          bool: {
            must: [
              { term: { contentId } },
              { range: { duration: { gte: 0.9 } } }, // Simplified, should use actual content duration
            ],
          },
        }
      );

      const totalViews = aggs.uniqueViews?.value || 1;
      const completionRate = (completedCount / totalViews) * 100;

      return {
        contentId,
        title: '', // Would fetch from content service
        views: totalViews,
        completionRate,
        avgRating: 0, // Would aggregate from ratings
        ratingDistribution: [], // Would aggregate from ratings
        watchTime: aggs.totalDuration?.value || 0,
        avgWatchDuration: aggs.avgDuration?.value || 0,
        peakHours: (aggs.peakHours?.buckets || []).map((bucket: any) => ({
          hour: new Date(bucket.key_as_string).getHours(),
          views: bucket.doc_count,
        })),
        devices: (aggs.qualities?.buckets || []).map((bucket: any) => ({
          device: bucket.key,
          views: bucket.doc_count,
        })),
        regions: [], // Would aggregate from user location
      };
    } catch (error) {
      this.logger.error({ error, contentId }, 'Failed to get content performance');
      throw error;
    }
  }

  /**
   * Get streaming quality report
   */
  async getStreamingQualityReport(
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ) {
    try {
      const intervals = {
        hour: 'hour',
        day: 'day',
        week: 'week',
        month: 'month',
      };

      const response = await this.elasticsearchService.search('stream-metrics', {
        query: { match_all: {} },
        aggs: {
          qualityTimeline: {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: intervals[period],
            },
            aggs: {
              qualities: { terms: { field: 'quality.keyword', size: 10 } },
              avgBitrate: { avg: { field: 'bitrate' } },
              avgBuffering: { avg: { field: 'bufferingEvents' } },
              errorRate: { avg: { field: 'errors' } },
            },
          },
        },
      });

      const buckets = response.aggregations?.qualityTimeline?.buckets || [];

      return {
        period,
        timeline: buckets.map((bucket: any) => ({
          date: bucket.key_as_string,
          qualities: bucket.qualities.buckets.map((q: any) => ({
            quality: q.key,
            count: q.doc_count,
          })),
          avgBitrate: bucket.avgBitrate.value,
          avgBuffering: bucket.avgBuffering.value,
          errorRate: bucket.errorRate.value,
        })),
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get streaming quality report');
      throw error;
    }
  }

  /**
   * Get device distribution
   */
  async getDeviceDistribution() {
    try {
      const response = await this.elasticsearchService.search('stream-metrics', {
        query: { match_all: {} },
        aggs: {
          devices: {
            terms: { field: 'device.keyword', size: 20 },
            aggs: {
              avgBitrate: { avg: { field: 'bitrate' } },
              avgDuration: { avg: { field: 'duration' } },
            },
          },
        },
      });

      return {
        devices: (response.aggregations?.devices?.buckets || []).map((bucket: any) => ({
          device: bucket.key,
          views: bucket.doc_count,
          avgBitrate: bucket.avgBitrate.value,
          avgDuration: bucket.avgDuration.value,
        })),
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get device distribution');
      throw error;
    }
  }

  /**
   * Get geographic distribution
   */
  async getGeographicDistribution() {
    try {
      const response = await this.elasticsearchService.search('stream-metrics', {
        query: { match_all: {} },
        aggs: {
          regions: {
            terms: { field: 'region.keyword', size: 100 },
            aggs: {
              views: { cardinality: { field: 'userId.keyword' } },
              avgDuration: { avg: { field: 'duration' } },
            },
          },
        },
      });

      return {
        regions: (response.aggregations?.regions?.buckets || []).map((bucket: any) => ({
          region: bucket.key,
          users: bucket.views.value,
          views: bucket.doc_count,
          avgDuration: bucket.avgDuration.value,
        })),
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get geographic distribution');
      throw error;
    }
  }

  /**
   * Detect anomalies in streaming
   */
  async detectAnomalies() {
    try {
      const response = await this.elasticsearchService.search('stream-metrics', {
        query: {
          range: { bufferingEvents: { gte: 10 } }, // High buffering
        },
        size: 100,
      });

      const hits = response.hits.hits || [];

      return {
        highBufferingCount: hits.length,
        samples: hits.map((hit: any) => ({
          contentId: hit._source.contentId,
          userId: hit._source.userId,
          bufferingEvents: hit._source.bufferingEvents,
          bitrate: hit._source.bitrate,
          quality: hit._source.quality,
        })),
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to detect anomalies');
      throw error;
    }
  }
}
