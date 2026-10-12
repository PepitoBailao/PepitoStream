import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { CacheStrategies } from './cache.strategies';
import { DistributedCacheService } from './distributed-cache.service';
import { CacheCompressionService } from './cache-compression.service';

@Controller('api/cache')
export class CacheController {
  constructor(
    private cacheStrategies: CacheStrategies,
    private distributedCache: DistributedCacheService,
    private compression: CacheCompressionService,
  ) {}

  /**
   * Get cache statistics
   */
  @Get('stats')
  getStats() {
    return {
      local: this.cacheStrategies.getStats(),
      compression: this.compression.getStats(),
    };
  }

  /**
   * Get cache entry
   */
  @Get('get/:key')
  async getKey(@Param('key') key: string) {
    const distributed = await this.distributedCache.get(key);
    const local = this.cacheStrategies.get(key);

    return {
      key,
      distributed,
      local,
    };
  }

  /**
   * Set cache entry
   */
  @Post('set')
  async setKey(
    @Body() body: { key: string; value: any; ttl?: number },
  ) {
    const { key, value, ttl } = body;

    const localResult = this.cacheStrategies.set(key, value, ttl);
    const distributedResult = await this.distributedCache.set(
      key,
      value,
      ttl ? ttl / 1000 : 3600, // convert to seconds
    );

    return {
      key,
      local: localResult,
      distributed: distributedResult,
    };
  }

  /**
   * Delete cache entry
   */
  @Delete('delete/:key')
  async deleteKey(@Param('key') key: string) {
    const localResult = this.cacheStrategies.delete(key);
    const distributedResult = await this.distributedCache.delete(key);

    return {
      key,
      local: localResult,
      distributed: distributedResult,
    };
  }

  /**
   * Clear cache by tag
   */
  @Delete('clear-tag/:tag')
  async clearByTag(@Param('tag') tag: string) {
    const count = this.cacheStrategies.clearByTag(tag);

    return {
      tag,
      cleared: count,
    };
  }

  /**
   * Clear entire cache
   */
  @Delete('clear')
  async clearCache() {
    this.cacheStrategies.clear();
    const result = await this.distributedCache.clear();

    return {
      success: result,
      message: 'Cache cleared',
    };
  }

  /**
   * Get compression stats
   */
  @Get('compression/stats')
  getCompressionStats() {
    return this.compression.getStats();
  }

  /**
   * Test compression
   */
  @Post('compression/test')
  async testCompression(@Body() body: { data: string }) {
    const { compressed, stats } = await this.compression.compress(
      body.data,
    );
    const { decompressed, time } = await this.compression.decompress(
      compressed,
    );

    return {
      original: body.data,
      originalSize: Buffer.byteLength(body.data),
      compressedSize: compressed.length,
      ratio: stats.compressionRatio,
      compressionTime: stats.compressionTime,
      decompressionTime: time,
      decompressed: decompressed.toString('utf-8'),
      verified: body.data === decompressed.toString('utf-8'),
    };
  }

  /**
   * Distributed cache multi-get
   */
  @Post('mget')
  async mget(@Body() body: { keys: string[] }) {
    const result = await this.distributedCache.mget(body.keys);
    return Array.from(result.entries()).map(([key, value]) => ({
      key,
      value,
    }));
  }

  /**
   * Distributed cache multi-set
   */
  @Post('mset')
  async mset(@Body() body: { entries: Array<{ key: string; value: any }>; ttl?: number }) {
    const map = new Map(body.entries.map(e => [e.key, e.value]));
    const result = await this.distributedCache.mset(
      map,
      body.ttl ? body.ttl / 1000 : 3600,
    );

    return {
      success: result,
      count: body.entries.length,
    };
  }

  /**
   * Get distributed cache info
   */
  @Get('info')
  async getCacheInfo() {
    const stats = await this.distributedCache.getStats();
    return {
      stats,
      timestamp: new Date().toISOString(),
    };
  }
}
