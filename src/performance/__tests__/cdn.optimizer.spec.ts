import { Test, TestingModule } from '@nestjs/testing';
import { CDNOptimizer } from '../cdn.optimizer';

describe('CDNOptimizer', () => {
  let service: CDNOptimizer;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CDNOptimizer]
    }).compile();

    service = module.get<CDNOptimizer>(CDNOptimizer);
  });

  afterEach(() => {
    service.clear();
  });

  describe('Provider Selection', () => {
    it('should select best CDN provider for region', () => {
      const provider = service.selectBestProvider('US');

      expect(provider).toBeDefined();
      expect(provider?.name).toBeTruthy();
      expect(provider?.regions.length).toBeGreaterThan(0);
    });

    it('should support multiple regions', () => {
      const regions = ['US', 'EU', 'ASIA'];
      let selectedProviders = 0;

      regions.forEach(region => {
        const provider = service.selectBestProvider(region);
        if (provider) selectedProviders++;
      });

      expect(selectedProviders).toBeGreaterThan(0);
    });

    it('should handle global providers', () => {
      const provider = service.selectBestProvider('US');
      expect(provider?.regions).toContain('GLOBAL');
    });
  });

  describe('Content Distribution', () => {
    it('should optimize distribution for single content', () => {
      const distribution = service.optimizeDistribution('content1', 1024 * 1024 * 100, ['US']);

      expect(distribution).toBeDefined();
      expect(distribution.contentId).toBe('content1');
      expect(distribution.size).toBe(1024 * 1024 * 100);
      expect(distribution.replicas.length).toBeGreaterThan(0);
    });

    it('should calculate bandwidth for distribution', () => {
      const distribution = service.optimizeDistribution('content1', 1024 * 1024 * 100, ['US']);

      expect(distribution.totalBandwidth).toBeGreaterThan(0);
    });

    it('should estimate distribution cost', () => {
      const distribution = service.optimizeDistribution('content1', 1024 * 1024 * 100, ['US']);

      expect(distribution.estimatedCost).toBeGreaterThan(0);
    });

    it('should optimize for multiple regions', () => {
      const distribution = service.optimizeDistribution('content1', 1024 * 1024 * 100, ['US', 'EU', 'ASIA']);

      expect(distribution.replicas.length).toBeGreaterThan(1);
    });
  });

  describe('Metrics Recording', () => {
    it('should record CDN metrics', () => {
      service.recordMetrics('CloudFlare', 'US', 15, 1000, 85, 99.95);
      
      const analytics = service.getAnalytics('CloudFlare');
      expect(analytics.avgLatency).toBeGreaterThan(0);
    });

    it('should track multiple metrics', () => {
      service.recordMetrics('CloudFlare', 'US', 15, 1000, 85, 99.95);
      service.recordMetrics('CloudFlare', 'US', 16, 1100, 86, 99.96);

      const analytics = service.getAnalytics('CloudFlare');
      expect(analytics.avgLatency).toBeGreaterThan(0);
    });
  });

  describe('Analytics', () => {
    it('should get analytics for provider', () => {
      service.recordMetrics('AWS', 'US', 20, 1500, 90, 99.99);
      
      const analytics = service.getAnalytics('AWS');

      expect(analytics).toHaveProperty('avgLatency');
      expect(analytics).toHaveProperty('avgBandwidth');
      expect(analytics).toHaveProperty('avgCacheHitRate');
      expect(analytics).toHaveProperty('avgAvailability');
      expect(analytics).toHaveProperty('topProvider');
    });

    it('should calculate overall analytics', () => {
      service.recordMetrics('CloudFlare', 'US', 15, 1000, 85, 99.95);
      service.recordMetrics('AWS', 'US', 20, 1500, 90, 99.99);

      const analytics = service.getAnalytics();

      expect(analytics.avgLatency).toBeGreaterThan(0);
      expect(analytics.avgCacheHitRate).toBeGreaterThan(0);
    });

    it('should identify top provider', () => {
      service.recordMetrics('CloudFlare', 'US', 15, 1000, 95, 99.95);
      service.recordMetrics('AWS', 'US', 20, 1500, 75, 99.99);

      const analytics = service.getAnalytics();
      expect(analytics.topProvider).toBeTruthy();
    });
  });

  describe('Cost Analysis', () => {
    it('should calculate cost breakdown', () => {
      service.optimizeDistribution('content1', 1024 * 1024 * 100, ['US']);
      service.optimizeDistribution('content2', 1024 * 1024 * 200, ['EU']);

      const costs = service.getCostBreakdown();

      expect(costs.totalMonthly).toBeGreaterThan(0);
      expect(costs.byProvider.size).toBeGreaterThan(0);
      expect(costs.byRegion.size).toBeGreaterThan(0);
    });

    it('should list top content by cost', () => {
      for (let i = 0; i < 15; i++) {
        service.optimizeDistribution(`content${i}`, 1024 * 1024 * (100 + i * 50), ['US']);
      }

      const costs = service.getCostBreakdown();
      expect(costs.topContent.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Distribution Retrieval', () => {
    it('should get distribution by content ID', () => {
      service.optimizeDistribution('content1', 1024 * 1024 * 100, ['US']);
      
      const distribution = service.getDistribution('content1');

      expect(distribution).toBeDefined();
      expect(distribution?.contentId).toBe('content1');
    });

    it('should return undefined for non-existent content', () => {
      const distribution = service.getDistribution('nonexistent');

      expect(distribution).toBeUndefined();
    });

    it('should get all distributions', () => {
      service.optimizeDistribution('content1', 1024 * 1024 * 100, ['US']);
      service.optimizeDistribution('content2', 1024 * 1024 * 200, ['EU']);

      const distributions = service.getAllDistributions();

      expect(distributions.length).toBe(2);
    });
  });

  describe('Data Management', () => {
    it('should clear all data', () => {
      service.optimizeDistribution('content1', 1024 * 1024 * 100, ['US']);
      service.recordMetrics('AWS', 'US', 20, 1500, 90, 99.99);

      service.clear();

      const distributions = service.getAllDistributions();
      expect(distributions.length).toBe(0);
    });
  });
});
