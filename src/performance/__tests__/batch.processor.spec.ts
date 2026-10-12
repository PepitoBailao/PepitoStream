import { Test, TestingModule } from '@nestjs/testing';
import { BatchProcessor } from '../batch.processor';

describe('BatchProcessor', () => {
  let service: BatchProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BatchProcessor]
    }).compile();

    service = module.get<BatchProcessor>(BatchProcessor);
  });

  afterEach(() => {
    service.clear();
  });

  describe('Job Management', () => {
    it('should add job to queue', () => {
      const items = [1, 2, 3];
      const processor = jest.fn().mockResolvedValue(['a', 'b', 'c']);

      const jobId = service.addJob(items, processor);

      expect(jobId).toBeTruthy();
      expect(jobId).toMatch(/^job_/);
    });

    it('should get queue status', () => {
      const items = [1, 2, 3];
      const processor = jest.fn().mockResolvedValue(['a', 'b', 'c']);

      service.addJob(items, processor);
      const status = service.getQueueStatus();

      expect(status.totalJobs).toBe(1);
      expect(status.totalItems).toBe(3);
      expect(status.processing).toBe(false);
    });

    it('should clear queue', () => {
      const items = [1, 2, 3];
      const processor = jest.fn().mockResolvedValue(['a', 'b', 'c']);

      service.addJob(items, processor);
      service.clear();

      const status = service.getQueueStatus();
      expect(status.totalJobs).toBe(0);
    });
  });

  describe('Job Processing', () => {
    it('should process single job', async () => {
      const items = [1, 2, 3];
      const processor = jest.fn().mockResolvedValue(['a', 'b', 'c']);

      service.addJob(items, processor);
      const results = await service.processQueue();

      expect(results.size).toBe(1);
    });

    it('should handle batch sizes correctly', async () => {
      const items = Array.from({ length: 250 }, (_, i) => i);
      const processor = jest.fn().mockResolvedValue(items);

      const jobId = service.addJob(items, processor, { batchSize: 100 });
      const results = await service.processQueue();
      const result = results.get(jobId);

      expect(result?.processed).toBeGreaterThan(0);
    });

    it('should track processing metrics', async () => {
      const items = [1, 2, 3];
      const processor = jest.fn().mockResolvedValue(['a', 'b', 'c']);

      const jobId = service.addJob(items, processor);
      const results = await service.processQueue();
      const result = results.get(jobId);

      expect(result?.duration).toBeGreaterThan(0);
      expect(result?.processed).toBe(3);
      expect(result?.failed).toBe(0);
    });
  });

  describe('Parallel Processing', () => {
    it('should process batches in parallel', async () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      const processor = jest.fn().mockResolvedValue(items);

      const result = await service.parallelBatch(items, processor, 5, 20);

      expect(result.processed).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle parallel errors gracefully', async () => {
      const items = [1, 2, 3];
      const processor = jest.fn().mockRejectedValue(new Error('Test error'));

      const result = await service.parallelBatch(items, processor, 2, 1);

      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Stream Processing', () => {
    it('should stream process batches', async () => {
      const items = Array.from({ length: 50 }, (_, i) => i);
      const processor = jest.fn().mockResolvedValue(items);

      let batchCount = 0;
      for await (const batch of service.streamBatch(items, processor, 20)) {
        batchCount++;
        expect(Array.isArray(batch)).toBe(true);
      }

      expect(batchCount).toBeGreaterThan(0);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed batches', async () => {
      const items = [1, 2, 3];
      let callCount = 0;
      const processor = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve(['a', 'b', 'c']);
      });

      const jobId = service.addJob(items, processor, { retries: 3 });
      const results = await service.processQueue();
      const result = results.get(jobId);

      expect(result?.failed).toBeLessThan(3);
    });
  });

  describe('Batch Interval', () => {
    it('should set batch interval', () => {
      service.setBatchInterval(200);
      // Interval is set internally, verify it doesn't throw
      expect(() => service.setBatchInterval(200)).not.toThrow();
    });
  });
});
