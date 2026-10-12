import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { QueryOptimizer } from './query.optimizer';
import { MemoryProfiler } from './memory.profiler';
import { BatchProcessor } from './batch.processor';
import { CDNOptimizer } from './cdn.optimizer';

@ApiTags('Performance')
@Controller('api/performance')
export class PerformanceController {
  constructor(
    private readonly queryOptimizer: QueryOptimizer,
    private readonly memoryProfiler: MemoryProfiler,
    private readonly batchProcessor: BatchProcessor,
    private readonly cdnOptimizer: CDNOptimizer
  ) {}

  // Query Optimization
  @Get('query/stats')
  @ApiOperation({ summary: 'Get query optimization statistics' })
  @ApiResponse({ status: 200, description: 'Query statistics' })
  getQueryStats() {
    return this.queryOptimizer.getQueryStats();
  }

  @Post('query/reset')
  @ApiOperation({ summary: 'Reset query statistics' })
  @ApiResponse({ status: 200, description: 'Statistics reset' })
  resetQueryStats() {
    this.queryOptimizer.resetStats();
    return { message: 'Query stats reset' };
  }

  // Memory Profiling
  @Post('memory/snapshot')
  @ApiOperation({ summary: 'Take memory snapshot' })
  @ApiResponse({ status: 200, description: 'Memory snapshot taken' })
  takeMemorySnapshot() {
    return this.memoryProfiler.takeSnapshot();
  }

  @Get('memory/report')
  @ApiOperation({ summary: 'Get memory report with leak detection' })
  @ApiResponse({ status: 200, description: 'Memory report' })
  getMemoryReport() {
    return this.memoryProfiler.getMemoryReport();
  }

  @Get('memory/timeline')
  @ApiOperation({ summary: 'Get memory usage timeline' })
  @ApiResponse({ status: 200, description: 'Memory timeline' })
  getMemoryTimeline() {
    return this.memoryProfiler.getTimeline();
  }

  @Get('memory/usage')
  @ApiOperation({ summary: 'Get current memory usage percentage' })
  @ApiResponse({ status: 200, description: 'Memory usage percent' })
  getMemoryUsage() {
    return { usage: this.memoryProfiler.getMemoryUsagePercent() };
  }

  @Post('memory/gc')
  @ApiOperation({ summary: 'Force garbage collection' })
  @ApiResponse({ status: 200, description: 'GC triggered' })
  forceGarbageCollection() {
    this.memoryProfiler.forceGarbageCollection();
    return { message: 'Garbage collection triggered' };
  }

  @Post('memory/clear')
  @ApiOperation({ summary: 'Clear memory snapshots' })
  @ApiResponse({ status: 200, description: 'Snapshots cleared' })
  clearMemorySnapshots() {
    this.memoryProfiler.clearSnapshots();
    return { message: 'Memory snapshots cleared' };
  }

  // Batch Processing
  @Get('batch/status')
  @ApiOperation({ summary: 'Get batch queue status' })
  @ApiResponse({ status: 200, description: 'Queue status' })
  getBatchStatus() {
    return this.batchProcessor.getQueueStatus();
  }

  @Post('batch/process')
  @ApiOperation({ summary: 'Process all batch jobs' })
  @ApiResponse({ status: 200, description: 'Jobs processed' })
  async processBatch() {
    const results = await this.batchProcessor.processQueue();
    return { jobsProcessed: results.size, results };
  }

  @Post('batch/clear')
  @ApiOperation({ summary: 'Clear batch queue' })
  @ApiResponse({ status: 200, description: 'Queue cleared' })
  clearBatch() {
    this.batchProcessor.clear();
    return { message: 'Batch queue cleared' };
  }

  @Post('batch/interval')
  @ApiOperation({ summary: 'Set batch processing interval' })
  @ApiResponse({ status: 200, description: 'Interval set' })
  setBatchInterval(@Body() { interval }: { interval: number }) {
    this.batchProcessor.setBatchInterval(interval);
    return { message: 'Batch interval set', interval };
  }

  // CDN Optimization
  @Get('cdn/providers')
  @ApiOperation({ summary: 'Get available CDN providers' })
  @ApiResponse({ status: 200, description: 'List of providers' })
  getCDNProviders() {
    return { message: 'CDN providers configured' };
  }

  @Post('cdn/optimize')
  @ApiOperation({ summary: 'Optimize content distribution' })
  @ApiResponse({ status: 200, description: 'Distribution optimized' })
  optimizeCDN(
    @Body() { contentId, size, regions }: { contentId: string; size: number; regions: string[] }
  ) {
    return this.cdnOptimizer.optimizeDistribution(contentId, size, regions);
  }

  @Get('cdn/analytics')
  @ApiOperation({ summary: 'Get CDN analytics' })
  @ApiResponse({ status: 200, description: 'CDN analytics' })
  getCDNAnalytics(@Param('provider') provider?: string) {
    return this.cdnOptimizer.getAnalytics(provider);
  }

  @Get('cdn/costs')
  @ApiOperation({ summary: 'Get CDN cost breakdown' })
  @ApiResponse({ status: 200, description: 'Cost breakdown' })
  getCDNCosts() {
    return this.cdnOptimizer.getCostBreakdown();
  }

  @Get('cdn/distribution/:contentId')
  @ApiOperation({ summary: 'Get distribution for content' })
  @ApiResponse({ status: 200, description: 'Distribution info' })
  getDistribution(@Param('contentId') contentId: string) {
    return this.cdnOptimizer.getDistribution(contentId);
  }

  @Post('cdn/metrics')
  @ApiOperation({ summary: 'Record CDN metrics' })
  @ApiResponse({ status: 200, description: 'Metrics recorded' })
  recordCDNMetrics(
    @Body()
    { provider, region, latency, bandwidth, cacheHitRate, availability }:
      { provider: string; region: string; latency: number; bandwidth: number; cacheHitRate: number; availability: number }
  ) {
    this.cdnOptimizer.recordMetrics(provider, region, latency, bandwidth, cacheHitRate, availability);
    return { message: 'Metrics recorded' };
  }

  @Post('cdn/clear')
  @ApiOperation({ summary: 'Clear CDN data' })
  @ApiResponse({ status: 200, description: 'Data cleared' })
  clearCDN() {
    this.cdnOptimizer.clear();
    return { message: 'CDN data cleared' };
  }

  // Overall Performance Status
  @Get('health')
  @ApiOperation({ summary: 'Get overall performance health' })
  @ApiResponse({ status: 200, description: 'Performance health status' })
  getHealthStatus() {
    const queryStats = this.queryOptimizer.getQueryStats();
    const memoryReport = this.memoryProfiler.getMemoryReport();
    const batchStatus = this.batchProcessor.getQueueStatus();
    const cdnAnalytics = this.cdnOptimizer.getAnalytics();

    return {
      query: {
        avgExecutionTime: queryStats.avgExecutionTime.toFixed(2) + 'ms',
        cacheHitRate: queryStats.cacheHitRate.toFixed(1) + '%',
        slowQueries: queryStats.slowQueries
      },
      memory: {
        heapUsagePercent: ((memoryReport.current.heapUsed / memoryReport.current.heapTotal) * 100).toFixed(1) + '%',
        leaks: memoryReport.leaks.length,
        trend: memoryReport.trends.heapGrowth.toFixed(1) + '%'
      },
      batch: {
        queued: batchStatus.totalJobs,
        completed: batchStatus.completedJobs,
        processing: batchStatus.processing
      },
      cdn: {
        avgLatency: cdnAnalytics.avgLatency + 'ms',
        avgCacheHitRate: cdnAnalytics.avgCacheHitRate + '%',
        topProvider: cdnAnalytics.topProvider
      },
      timestamp: new Date().toISOString()
    };
  }
}
