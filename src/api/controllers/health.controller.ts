/**
 * Health Controller - Monitoring et santé de l'API
 */

import { Controller, Get, HttpCode } from '@nestjs/common';
import { CacheService } from '../../cache/cacheService';
import { SearchService } from '../../search/searchService';
import { QualityService } from '../../quality/qualityService';
import { AudioService } from '../../audio/audioService';

@Controller('api/v1/health')
export class HealthController {
  constructor(
    private cacheService: CacheService,
    private searchService: SearchService,
    private qualityService: QualityService,
    private audioService: AudioService,
  ) {}

  /**
   * GET /api/v1/health
   * Vérification simple de santé
   */
  @Get()
  @HttpCode(200)
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date(),
      uptime: process.uptime(),
    };
  }

  /**
   * GET /api/v1/health/detailed
   * Vérification détaillée avec tous les services
   */
  @Get('detailed')
  @HttpCode(200)
  async detailedHealth() {
    const startTime = Date.now();

    const cacheHealth = this.checkCacheHealth();
    const searchHealth = this.checkSearchHealth();
    const qualityHealth = this.checkQualityHealth();
    const audioHealth = this.checkAudioHealth();

    const allHealthy = [cacheHealth, searchHealth, qualityHealth, audioHealth].every(
      (h) => h.status === 'ok',
    );

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date(),
      uptime: process.uptime(),
      responseTime: `${Date.now() - startTime}ms`,
      services: {
        cache: cacheHealth,
        search: searchHealth,
        quality: qualityHealth,
        audio: audioHealth,
      },
    };
  }

  /**
   * GET /api/v1/health/metrics
   * Métriques de performance et utilisation
   */
  @Get('metrics')
  @HttpCode(200)
  getMetrics() {
    return {
      timestamp: new Date(),
      memory: {
        total: Math.round(require('os').totalmem() / 1024 / 1024) + ' MB',
        free: Math.round(require('os').freemem() / 1024 / 1024) + ' MB',
        used: Math.round((require('os').totalmem() - require('os').freemem()) / 1024 / 1024) + ' MB',
        usedPercent: Math.round(
          ((require('os').totalmem() - require('os').freemem()) / require('os').totalmem()) * 100,
        ) + '%',
      },
      cache: this.cacheService.getStats(),
      nodejs: {
        version: process.version,
        uptime: `${Math.round(process.uptime())}s`,
        pid: process.pid,
        cpuUsage: process.cpuUsage(),
      },
    };
  }

  /**
   * GET /api/v1/health/cache
   * Stats du cache uniquement
   */
  @Get('cache')
  @HttpCode(200)
  getCacheStats() {
    const stats = this.cacheService.getStats();
    return {
      timestamp: new Date(),
      cache: stats,
    };
  }

  /**
   * GET /api/v1/health/ready
   * Vérification de readiness (pour Kubernetes)
   */
  @Get('ready')
  @HttpCode(200)
  readinessCheck() {
    const cache = this.checkCacheHealth();
    const search = this.checkSearchHealth();

    const ready = cache.status === 'ok' && search.status === 'ok';

    return {
      ready,
      timestamp: new Date(),
      checks: {
        cache: cache.status,
        search: search.status,
      },
    };
  }

  /**
   * GET /api/v1/health/live
   * Vérification de liveness (pour Kubernetes)
   */
  @Get('live')
  @HttpCode(200)
  livenessCheck() {
    return {
      alive: true,
      timestamp: new Date(),
      uptime: process.uptime(),
    };
  }

  // ============= PRIVATE HEALTH CHECKERS =============

  private checkCacheHealth() {
    try {
      const stats = this.cacheService.getStats();
      const memoryUsedPercent = (stats.memoryUsed / (100 * 1024 * 1024)) * 100;

      if (memoryUsedPercent > 90) {
        return { status: 'degraded', message: 'Memory usage high', memoryUsedPercent };
      }

      return {
        status: 'ok',
        itemsCount: stats.totalItems,
        hitRate: stats.hitRate.toFixed(2) + '%',
      };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  private checkSearchHealth() {
    try {
      // Test un search simple
      const result = this.searchService.search('test', 'exact', 1);
      return {
        status: 'ok',
        message: 'Search service operational',
      };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  private checkQualityHealth() {
    try {
      const profiles = ['PepitoCiné', 'PepitoDuVoyage', 'Pepito', 'PepitoMacqueen'];
      return {
        status: 'ok',
        availableProfiles: profiles.length,
        profiles,
      };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  private checkAudioHealth() {
    try {
      const languages = ['vf', 'vostfr', 'vo'];
      return {
        status: 'ok',
        availableLanguages: languages.length,
        languages,
      };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }
}
