import { Test, TestingModule } from '@nestjs/testing';
import { MemoryProfiler } from '../memory.profiler';

describe('MemoryProfiler', () => {
  let service: MemoryProfiler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MemoryProfiler]
    }).compile();

    service = module.get<MemoryProfiler>(MemoryProfiler);
  });

  describe('Memory Snapshots', () => {
    it('should take memory snapshot', () => {
      const snapshot = service.takeSnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot.timestamp).toBeTruthy();
      expect(snapshot.heapUsed).toBeGreaterThan(0);
      expect(snapshot.heapTotal).toBeGreaterThan(0);
      expect(snapshot.rss).toBeGreaterThan(0);
    });

    it('should maintain max snapshots limit', () => {
      for (let i = 0; i < 150; i++) {
        service.takeSnapshot();
      }

      const report = service.getMemoryReport();
      expect(report.current).toBeDefined();
    });

    it('should clear snapshots', () => {
      service.takeSnapshot();
      service.takeSnapshot();
      service.clearSnapshots();

      const report = service.getMemoryReport();
      expect(report.current).toBeDefined();
    });
  });

  describe('Memory Reports', () => {
    it('should generate memory report', () => {
      service.takeSnapshot();
      const report = service.getMemoryReport();

      expect(report).toHaveProperty('current');
      expect(report).toHaveProperty('peak');
      expect(report).toHaveProperty('average');
      expect(report).toHaveProperty('leaks');
      expect(report).toHaveProperty('trends');
    });

    it('should calculate average memory usage', () => {
      service.takeSnapshot();
      service.takeSnapshot();
      service.takeSnapshot();

      const report = service.getMemoryReport();
      expect(report.average.heapUsed).toBeGreaterThan(0);
    });

    it('should identify peak memory usage', () => {
      service.takeSnapshot();
      service.takeSnapshot();
      const report = service.getMemoryReport();

      expect(report.peak.heapUsed).toBeGreaterThanOrEqual(report.current.heapUsed);
    });
  });

  describe('Memory Growth Analysis', () => {
    it('should detect memory growth trends', () => {
      service.takeSnapshot();
      service.takeSnapshot();
      service.takeSnapshot();

      const report = service.getMemoryReport();
      expect(report.trends).toBeDefined();
      expect(report.trends.heapGrowth).toBeDefined();
    });

    it('should return trends with multiple snapshots', () => {
      for (let i = 0; i < 10; i++) {
        service.takeSnapshot();
      }

      const report = service.getMemoryReport();
      expect(typeof report.trends.heapGrowth).toBe('number');
      expect(typeof report.trends.externalGrowth).toBe('number');
      expect(typeof report.trends.rssGrowth).toBe('number');
    });
  });

  describe('Memory Usage Percentage', () => {
    it('should return valid percentage', () => {
      const percent = service.getMemoryUsagePercent();

      expect(percent).toBeGreaterThanOrEqual(0);
      expect(percent).toBeLessThanOrEqual(100);
    });
  });

  describe('Memory Timeline', () => {
    it('should generate memory timeline', () => {
      service.takeSnapshot();
      service.takeSnapshot();

      const timeline = service.getTimeline();

      expect(Array.isArray(timeline)).toBe(true);
      expect(timeline.length).toBeGreaterThan(0);
      expect(timeline[0]).toHaveProperty('time');
      expect(timeline[0]).toHaveProperty('heap');
      expect(timeline[0]).toHaveProperty('rss');
    });

    it('should have timestamps in timeline', () => {
      service.takeSnapshot();
      service.takeSnapshot();

      const timeline = service.getTimeline();
      const timestamps = timeline.map(t => new Date(t.time).getTime());

      expect(timestamps[0]).toBeLessThanOrEqual(timestamps[1]);
    });
  });
});
