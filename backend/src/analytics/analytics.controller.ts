import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { UserAnalyticsService } from './user-analytics.service';
import { ContentAnalyticsService, StreamMetrics } from './content-analytics.service';

@Controller('api/analytics')
export class AnalyticsController {
  constructor(
    private userAnalyticsService: UserAnalyticsService,
    private contentAnalyticsService: ContentAnalyticsService
  ) {}

  /**
   * Track user event
   */
  @Post('events')
  @HttpCode(HttpStatus.NO_CONTENT)
  async trackEvent(
    @Body() body: { userId: string; eventType: string; metadata?: any }
  ): Promise<void> {
    if (!body.userId || !body.eventType) {
      throw new BadRequestException('userId and eventType are required');
    }
    await this.userAnalyticsService.trackEvent({
      userId: body.userId,
      eventType: body.eventType,
      timestamp: Date.now(),
      metadata: body.metadata,
    });
  }

  /**
   * Track watch event
   */
  @Post('watch')
  @HttpCode(HttpStatus.NO_CONTENT)
  async trackWatch(
    @Body()
    body: {
      userId: string;
      contentId: string;
      title: string;
      duration: number;
      genre: string;
    }
  ): Promise<void> {
    if (!body.userId || !body.contentId) {
      throw new BadRequestException('userId and contentId are required');
    }
    await this.userAnalyticsService.trackWatch(
      body.userId,
      body.contentId,
      body.title,
      body.duration,
      body.genre
    );
  }

  /**
   * Get user analytics
   */
  @Get('users/:userId')
  @HttpCode(HttpStatus.OK)
  async getUserAnalytics(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.userAnalyticsService.getUserAnalytics(userId);
  }

  /**
   * Get content popularity
   */
  @Get('content/:contentId/popularity')
  @HttpCode(HttpStatus.OK)
  async getContentPopularity(@Param('contentId') contentId: string) {
    if (!contentId) {
      throw new BadRequestException('contentId is required');
    }
    return this.userAnalyticsService.getContentPopularity(contentId);
  }

  /**
   * Get trending content
   */
  @Get('trending')
  @HttpCode(HttpStatus.OK)
  async getTrendingContent(
    @Query('hours') hours: string = '24',
    @Query('limit') limit: string = '10'
  ) {
    const hoursNum = parseInt(hours, 10) || 24;
    const limitNum = parseInt(limit, 10) || 10;
    return this.userAnalyticsService.getTrendingContent(hoursNum, limitNum);
  }

  /**
   * Get cohort analysis
   */
  @Get('cohorts')
  @HttpCode(HttpStatus.OK)
  async getCohortAnalysis(@Query('size') size: string = '100') {
    const sizeNum = parseInt(size, 10) || 100;
    return this.userAnalyticsService.getCohortAnalysis(sizeNum);
  }

  /**
   * Track stream metrics
   */
  @Post('stream-metrics')
  @HttpCode(HttpStatus.NO_CONTENT)
  async trackStreamMetrics(
    @Body()
    body: {
      contentId: string;
      userId: string;
      metrics: StreamMetrics;
    }
  ): Promise<void> {
    if (!body.contentId || !body.userId || !body.metrics) {
      throw new BadRequestException('contentId, userId, and metrics are required');
    }
    await this.contentAnalyticsService.trackStreamMetrics(
      body.contentId,
      body.userId,
      body.metrics
    );
  }

  /**
   * Get content performance
   */
  @Get('content/:contentId/performance')
  @HttpCode(HttpStatus.OK)
  async getContentPerformance(@Param('contentId') contentId: string) {
    if (!contentId) {
      throw new BadRequestException('contentId is required');
    }
    return this.contentAnalyticsService.getContentPerformance(contentId);
  }

  /**
   * Get streaming quality report
   */
  @Get('quality-report')
  @HttpCode(HttpStatus.OK)
  async getQualityReport(
    @Query('period') period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ) {
    return this.contentAnalyticsService.getStreamingQualityReport(period);
  }

  /**
   * Get device distribution
   */
  @Get('devices')
  @HttpCode(HttpStatus.OK)
  async getDeviceDistribution() {
    return this.contentAnalyticsService.getDeviceDistribution();
  }

  /**
   * Get geographic distribution
   */
  @Get('geographic')
  @HttpCode(HttpStatus.OK)
  async getGeographicDistribution() {
    return this.contentAnalyticsService.getGeographicDistribution();
  }

  /**
   * Detect streaming anomalies
   */
  @Get('anomalies')
  @HttpCode(HttpStatus.OK)
  async detectAnomalies() {
    return this.contentAnalyticsService.detectAnomalies();
  }
}
