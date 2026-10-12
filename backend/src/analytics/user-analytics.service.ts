import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { Logger } from 'pino';

export interface UserEvent {
  userId: string;
  eventType: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface UserAnalytics {
  userId: string;
  totalWatched: number;
  totalDuration: number;
  averageSessionDuration: number;
  favoriteGenres: { genre: string; count: number }[];
  watchHistory: Array<{
    contentId: string;
    title: string;
    watchedAt: number;
    duration: number;
  }>;
  engagementScore: number;
  lastActiveAt: number;
}

export interface ContentPopularity {
  contentId: string;
  title: string;
  views: number;
  avgRating: number;
  totalWatchDuration: number;
  dropoffRate: number; // % users who didn't finish
}

@Injectable()
export class UserAnalyticsService {
  private logger: Logger;

  constructor(
    private elasticsearchService: ElasticsearchService,
    logger: Logger
  ) {
    this.logger = logger.child({ context: 'UserAnalyticsService' });
  }

  /**
   * Track user event
   */
  async trackEvent(event: UserEvent): Promise<void> {
    try {
      await this.elasticsearchService.index(
        'user-events',
        {
          ...event,
          '@timestamp': new Date(event.timestamp).toISOString(),
        }
      );
    } catch (error) {
      this.logger.error({ error, event }, 'Failed to track user event');
    }
  }

  /**
   * Track watch event
   */
  async trackWatch(
    userId: string,
    contentId: string,
    title: string,
    duration: number,
    genre: string
  ): Promise<void> {
    await this.trackEvent({
      userId,
      eventType: 'watch',
      timestamp: Date.now(),
      metadata: {
        contentId,
        title,
        duration,
        genre,
      },
    });
  }

  /**
   * Track search event
   */
  async trackSearch(
    userId: string,
    query: string,
    resultsCount: number
  ): Promise<void> {
    await this.trackEvent({
      userId,
      eventType: 'search',
      timestamp: Date.now(),
      metadata: {
        query,
        resultsCount,
      },
    });
  }

  /**
   * Track rating event
   */
  async trackRating(
    userId: string,
    contentId: string,
    rating: number
  ): Promise<void> {
    await this.trackEvent({
      userId,
      eventType: 'rating',
      timestamp: Date.now(),
      metadata: {
        contentId,
        rating,
      },
    });
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    try {
      const response = await this.elasticsearchService.search('user-events', {
        query: {
          bool: {
            must: [
              { term: { userId } },
              { term: { 'eventType.keyword': 'watch' } },
            ],
          },
        },
        aggs: {
          totalWatched: { value_count: { field: 'metadata.contentId.keyword' } },
          totalDuration: { sum: { field: 'metadata.duration' } },
          genres: {
            terms: { field: 'metadata.genre.keyword', size: 10 },
          },
          avgDuration: { avg: { field: 'metadata.duration' } },
          lastActive: { max: { field: 'timestamp' } },
        },
        size: 1000,
      });

      const hits = response.hits.hits || [];
      const aggs = response.aggregations || {};

      const watchHistory = hits.map((hit: any) => ({
        contentId: hit._source.metadata.contentId,
        title: hit._source.metadata.title,
        watchedAt: hit._source.timestamp,
        duration: hit._source.metadata.duration,
      }));

      const favoriteGenres = (aggs.genres?.buckets || []).map((bucket: any) => ({
        genre: bucket.key,
        count: bucket.doc_count,
      }));

      const engagementScore = this.calculateEngagementScore(
        aggs.totalWatched?.value || 0,
        aggs.totalDuration?.value || 0,
        favoriteGenres.length,
        hits.length
      );

      return {
        userId,
        totalWatched: aggs.totalWatched?.value || 0,
        totalDuration: aggs.totalDuration?.value || 0,
        averageSessionDuration: aggs.avgDuration?.value || 0,
        favoriteGenres,
        watchHistory,
        engagementScore,
        lastActiveAt: aggs.lastActive?.value || 0,
      };
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to get user analytics');
      throw error;
    }
  }

  /**
   * Get content popularity
   */
  async getContentPopularity(contentId: string): Promise<ContentPopularity> {
    try {
      const response = await this.elasticsearchService.search('user-events', {
        query: {
          bool: {
            must: [
              { match: { 'metadata.contentId': contentId } },
              { term: { 'eventType.keyword': 'watch' } },
            ],
          },
        },
        aggs: {
          views: { cardinality: { field: 'userId.keyword' } },
          avgRating: { avg: { field: 'metadata.rating' } },
          totalDuration: { sum: { field: 'metadata.duration' } },
        },
      });

      const aggs = response.aggregations || {};

      // Calculate dropoff rate (users who didn't complete)
      const watchedFull = await this.elasticsearchService.countDocuments(
        'user-events',
        {
          bool: {
            must: [
              { match: { 'metadata.contentId': contentId } },
              { range: { 'metadata.duration': { gte: 0.9 } } }, // 90% watched
            ],
          },
        }
      );

      const totalViews = aggs.views?.value || 1;
      const dropoffRate = ((totalViews - watchedFull) / totalViews) * 100;

      return {
        contentId,
        title: '', // Would fetch from content service
        views: totalViews,
        avgRating: aggs.avgRating?.value || 0,
        totalWatchDuration: aggs.totalDuration?.value || 0,
        dropoffRate,
      };
    } catch (error) {
      this.logger.error({ error, contentId }, 'Failed to get content popularity');
      throw error;
    }
  }

  /**
   * Get trending content
   */
  async getTrendingContent(
    hours: number = 24,
    limit: number = 10
  ): Promise<ContentPopularity[]> {
    try {
      const since = Date.now() - hours * 60 * 60 * 1000;

      const response = await this.elasticsearchService.search('user-events', {
        query: {
          bool: {
            must: [
              { term: { 'eventType.keyword': 'watch' } },
              { range: { timestamp: { gte: since } } },
            ],
          },
        },
        aggs: {
          contents: {
            terms: { field: 'metadata.contentId.keyword', size: limit },
            aggs: {
              views: { cardinality: { field: 'userId.keyword' } },
              avgRating: { avg: { field: 'metadata.rating' } },
              totalDuration: { sum: { field: 'metadata.duration' } },
            },
          },
        },
      });

      const buckets = response.aggregations?.contents?.buckets || [];

      return buckets.map((bucket: any) => ({
        contentId: bucket.key,
        title: '', // Would fetch from content service
        views: bucket.views.value || 0,
        avgRating: bucket.avgRating.value || 0,
        totalWatchDuration: bucket.totalDuration.value || 0,
        dropoffRate: 0, // Simplified
      }));
    } catch (error) {
      this.logger.error({ error }, 'Failed to get trending content');
      throw error;
    }
  }

  /**
   * Get user cohort analysis
   */
  async getCohortAnalysis(
    cohortSize: number = 100
  ): Promise<Record<string, any>> {
    try {
      const response = await this.elasticsearchService.search('user-events', {
        query: { match_all: {} },
        aggs: {
          userCohorts: {
            date_histogram: {
              field: 'timestamp',
              calendar_interval: 'day',
            },
            aggs: {
              uniqueUsers: { cardinality: { field: 'userId.keyword' } },
              avgWatchTime: { avg: { field: 'metadata.duration' } },
            },
          },
        },
      });

      const buckets = response.aggregations?.userCohorts?.buckets || [];

      return {
        cohorts: buckets.map((bucket: any) => ({
          date: bucket.key_as_string,
          users: bucket.uniqueUsers.value,
          avgWatchTime: bucket.avgWatchTime.value,
        })),
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get cohort analysis');
      throw error;
    }
  }

  /**
   * Calculate engagement score (0-100)
   */
  private calculateEngagementScore(
    contentWatched: number,
    totalDuration: number,
    genreCount: number,
    eventCount: number
  ): number {
    // Simple engagement score formula
    const contentScore = Math.min(contentWatched / 50, 1) * 30;
    const durationScore = Math.min(totalDuration / 360000, 1) * 30; // 100 hours = max
    const genreScore = Math.min(genreCount / 10, 1) * 20;
    const activityScore = Math.min(eventCount / 100, 1) * 20;

    return Math.round(contentScore + durationScore + genreScore + activityScore);
  }
}
