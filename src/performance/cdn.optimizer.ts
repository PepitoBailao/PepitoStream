import { Injectable, Logger } from '@nestjs/common';

interface CDNProvider {
  name: string;
  endpoint: string;
  regions: string[];
  latency: number;
  availability: number;
}

interface CDNMetrics {
  provider: string;
  region: string;
  latency: number;
  bandwidth: number;
  cacheHitRate: number;
  availability: number;
}

interface ContentDistribution {
  contentId: string;
  size: number;
  replicas: Array<{ region: string; provider: string; available: boolean }>;
  totalBandwidth: number;
  estimatedCost: number;
}

@Injectable()
export class CDNOptimizer {
  private readonly logger = new Logger(CDNOptimizer.name);
  private providers: Map<string, CDNProvider> = new Map();
  private metrics: Map<string, CDNMetrics[]> = new Map();
  private contentDistribution: Map<string, ContentDistribution> = new Map();

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize CDN providers
   */
  private initializeProviders(): void {
    const providers: CDNProvider[] = [
      {
        name: 'CloudFlare',
        endpoint: 'https://cdn.cloudflare.com',
        regions: ['US', 'EU', 'ASIA'],
        latency: 15,
        availability: 99.95
      },
      {
        name: 'AWS CloudFront',
        endpoint: 'https://cloudfront.amazonaws.com',
        regions: ['US-EAST', 'US-WEST', 'EU-WEST', 'ASIA-PACIFIC'],
        latency: 20,
        availability: 99.99
      },
      {
        name: 'Bunny CDN',
        endpoint: 'https://bunnycdn.com',
        regions: ['GLOBAL'],
        latency: 10,
        availability: 99.9
      },
      {
        name: 'Fastly',
        endpoint: 'https://fastly.com',
        regions: ['GLOBAL'],
        latency: 12,
        availability: 99.99
      }
    ];

    providers.forEach(provider => {
      this.providers.set(provider.name, provider);
    });
  }

  /**
   * Select best CDN provider for region
   */
  selectBestProvider(targetRegion: string): CDNProvider | null {
    let bestProvider: CDNProvider | null = null;
    let bestScore = -1;

    this.providers.forEach(provider => {
      if (!provider.regions.includes('GLOBAL') && !provider.regions.includes(targetRegion)) {
        return; // Skip if region not supported
      }

      const score = (provider.availability / 100) * 1000 - provider.latency * 10;

      if (score > bestScore) {
        bestScore = score;
        bestProvider = provider;
      }
    });

    return bestProvider;
  }

  /**
   * Optimize content distribution
   */
  optimizeDistribution(
    contentId: string,
    contentSize: number,
    targetRegions: string[]
  ): ContentDistribution {
    const replicas: Array<{ region: string; provider: string; available: boolean }> = [];
    let totalBandwidth = 0;
    let estimatedCost = 0;

    targetRegions.forEach(region => {
      const provider = this.selectBestProvider(region);
      if (provider) {
        replicas.push({
          region,
          provider: provider.name,
          available: true
        });

        // Calculate bandwidth (assume 1 Gbps base)
        const bandwidth = 1000 * (provider.availability / 100);
        totalBandwidth += bandwidth;

        // Estimate cost ($0.085 per GB in US, varies by region)
        const regionMultiplier = region === 'US' ? 1 : region === 'EU' ? 1.2 : 1.5;
        estimatedCost += (contentSize / 1024 / 1024 / 1024) * 0.085 * regionMultiplier;
      }
    });

    const distribution: ContentDistribution = {
      contentId,
      size: contentSize,
      replicas,
      totalBandwidth,
      estimatedCost
    };

    this.contentDistribution.set(contentId, distribution);
    return distribution;
  }

  /**
   * Record CDN metrics
   */
  recordMetrics(
    provider: string,
    region: string,
    latency: number,
    bandwidth: number,
    cacheHitRate: number,
    availability: number
  ): void {
    const metrics: CDNMetrics = {
      provider,
      region,
      latency,
      bandwidth,
      cacheHitRate,
      availability
    };

    if (!this.metrics.has(provider)) {
      this.metrics.set(provider, []);
    }

    this.metrics.get(provider)!.push(metrics);
    this.maintainMetrics();
  }

  /**
   * Get CDN analytics
   */
  getAnalytics(provider?: string): {
    avgLatency: number;
    avgBandwidth: number;
    avgCacheHitRate: number;
    avgAvailability: number;
    topProvider: string;
  } {
    let metricsArray: CDNMetrics[] = [];

    if (provider) {
      metricsArray = this.metrics.get(provider) || [];
    } else {
      Array.from(this.metrics.values()).forEach(m => metricsArray.push(...m));
    }

    if (metricsArray.length === 0) {
      return {
        avgLatency: 0,
        avgBandwidth: 0,
        avgCacheHitRate: 0,
        avgAvailability: 0,
        topProvider: ''
      };
    }

    const avgLatency = metricsArray.reduce((sum, m) => sum + m.latency, 0) / metricsArray.length;
    const avgBandwidth = metricsArray.reduce((sum, m) => sum + m.bandwidth, 0) / metricsArray.length;
    const avgCacheHitRate = metricsArray.reduce((sum, m) => sum + m.cacheHitRate, 0) / metricsArray.length;
    const avgAvailability = metricsArray.reduce((sum, m) => sum + m.availability, 0) / metricsArray.length;

    // Find top provider by cache hit rate
    const providerScores = new Map<string, number>();
    metricsArray.forEach(m => {
      const score = providerScores.get(m.provider) || 0;
      providerScores.set(m.provider, score + m.cacheHitRate);
    });

    let topProvider = '';
    let maxScore = 0;
    providerScores.forEach((score, prov) => {
      if (score > maxScore) {
        maxScore = score;
        topProvider = prov;
      }
    });

    return {
      avgLatency: Math.round(avgLatency),
      avgBandwidth: Math.round(avgBandwidth),
      avgCacheHitRate: Math.round(avgCacheHitRate),
      avgAvailability: Math.round(avgAvailability),
      topProvider
    };
  }

  /**
   * Get distribution cost breakdown
   */
  getCostBreakdown(): {
    totalMonthly: number;
    byProvider: Map<string, number>;
    byRegion: Map<string, number>;
    topContent: Array<{ contentId: string; cost: number }>;
  } {
    let totalMonthly = 0;
    const byProvider = new Map<string, number>();
    const byRegion = new Map<string, number>();

    this.contentDistribution.forEach(dist => {
      totalMonthly += dist.estimatedCost;

      dist.replicas.forEach(replica => {
        const current = byProvider.get(replica.provider) || 0;
        byProvider.set(replica.provider, current + dist.estimatedCost);

        const regionCurrent = byRegion.get(replica.region) || 0;
        byRegion.set(replica.region, regionCurrent + dist.estimatedCost);
      });
    });

    const topContent = Array.from(this.contentDistribution.values())
      .sort((a, b) => b.estimatedCost - a.estimatedCost)
      .slice(0, 10)
      .map(dist => ({
        contentId: dist.contentId,
        cost: dist.estimatedCost
      }));

    return {
      totalMonthly,
      byProvider,
      byRegion,
      topContent
    };
  }

  /**
   * Get distribution info
   */
  getDistribution(contentId: string): ContentDistribution | undefined {
    return this.contentDistribution.get(contentId);
  }

  /**
   * Get all distributions
   */
  getAllDistributions(): ContentDistribution[] {
    return Array.from(this.contentDistribution.values());
  }

  /**
   * Clear metrics and distributions
   */
  clear(): void {
    this.metrics.clear();
    this.contentDistribution.clear();
    this.logger.log('CDN metrics and distributions cleared');
  }

  // Private helpers
  private maintainMetrics(): void {
    this.metrics.forEach((metricsArray, provider) => {
      if (metricsArray.length > 1000) {
        this.metrics.set(provider, metricsArray.slice(-1000));
      }
    });
  }
}
