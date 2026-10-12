import { Test, TestingModule } from '@nestjs/testing';
import { StreamMonitorService } from './stream-monitor.service';

describe('StreamMonitorService', () => {
  let service: StreamMonitorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StreamMonitorService],
    }).compile();

    service = module.get<StreamMonitorService>(StreamMonitorService);
  });

  describe('recordStreamMetric', () => {
    it('should record bitrate metric', () => {
      service.recordStreamMetric('stream-1', { bitrate: 5000 });
      service.recordStreamMetric('stream-1', { bitrate: 4800 });

      const stats = service.getStreamMetricsStats('stream-1');
      expect(stats.bitrate.avg).toBeCloseTo(4900, 0);
      expect(stats.bitrate.max).toBe(5000);
      expect(stats.bitrate.min).toBe(4800);
    });

    it('should record latency metric', () => {
      service.recordStreamMetric('stream-1', { latency: 100 });
      service.recordStreamMetric('stream-1', { latency: 150 });

      const stats = service.getStreamMetricsStats('stream-1');
      expect(stats.latency.avg).toBeCloseTo(125, 0);
    });
  });

  describe('recordClientMetric', () => {
    it('should record client metrics', () => {
      service.recordClientMetric('client-1', {
        bandwidth: 10000,
        packetLoss: 0.5,
        jitter: 10,
        fps: 60,
      });

      const stats = service.getClientMetricsStats('client-1');
      expect(stats.bandwidth.current).toBe(10000);
      expect(stats.fps.current).toBe(60);
    });
  });

  describe('Alerts', () => {
    it('should create alert for low bitrate', () => {
      service.recordStreamMetric('stream-1', { bitrate: 300 }); // Below 500 threshold

      const alerts = service.getStreamAlerts('stream-1', true);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('LOW_BITRATE');
    });

    it('should create alert for high latency', () => {
      service.recordStreamMetric('stream-1', { latency: 6000 }); // Above 5000 threshold

      const alerts = service.getStreamAlerts('stream-1', true);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('HIGH_LATENCY');
    });

    it('should resolve alert', () => {
      service.recordStreamMetric('stream-1', { bitrate: 300 });
      const alerts = service.getStreamAlerts('stream-1', false);
      
      service.resolveAlert('stream-1', 0);
      const unresolvedAlerts = service.getStreamAlerts('stream-1', true);
      
      expect(unresolvedAlerts.length).toBe(0);
    });
  });

  describe('Stream Health', () => {
    it('should calculate excellent health', () => {
      service.recordStreamMetric('stream-1', { bitrate: 8000, latency: 50 });
      service.recordStreamMetric('stream-1', { bitrate: 7800, latency: 45 });

      const stats = service.getStreamMetricsStats('stream-1');
      expect(stats.health).toBeGreaterThanOrEqual(80);
    });

    it('should calculate poor health with low bitrate', () => {
      service.recordStreamMetric('stream-1', { bitrate: 300 });
      service.recordStreamMetric('stream-1', { bitrate: 250 });

      const stats = service.getStreamMetricsStats('stream-1');
      expect(stats.health).toBeLessThan(70);
    });
  });

  describe('Client Quality', () => {
    it('should calculate excellent quality', () => {
      for (let i = 0; i < 10; i++) {
        service.recordClientMetric('client-1', { fps: 60, packetLoss: 0.1 });
      }

      const stats = service.getClientMetricsStats('client-1');
      expect(stats.quality).toBe('excellent');
    });

    it('should calculate poor quality', () => {
      for (let i = 0; i < 5; i++) {
        service.recordClientMetric('client-1', { fps: 15, packetLoss: 10 });
      }

      const stats = service.getClientMetricsStats('client-1');
      expect(stats.quality).toBe('poor');
    });
  });
});
