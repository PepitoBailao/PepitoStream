import { Test } from '@nestjs/testing';
import { DistributedCacheService } from './distributed-cache.service';

describe('DistributedCacheService', () => {
  let service: DistributedCacheService;

  beforeEach(async () => {
    service = new DistributedCacheService({
      type: 'redis',
      redis: {
        host: 'localhost',
        port: 6379,
        db: 15, // Use test DB
        keyPrefix: 'test:',
      },
      syncInterval: 5000,
    });
  });

  describe('Basic Operations', () => {
    it('should set and get value', async () => {
      await service.set('test-key', { data: 'value' }, 3600);
      const result = await service.get('test-key');
      expect(result).toEqual({ data: 'value' });
    });

    it('should return null for non-existent key', async () => {
      const result = await service.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should delete key', async () => {
      await service.set('test-key', 'value', 3600);
      await service.delete('test-key');
      const result = await service.get('test-key');
      expect(result).toBeNull();
    });
  });

  describe('TTL Management', () => {
    it('should respect TTL', async () => {
      await service.set('ttl-key', 'value', 1); // 1 second TTL
      const ttlResult = await service.ttl('ttl-key');
      expect(ttlResult).toBeGreaterThan(0);
      expect(ttlResult).toBeLessThanOrEqual(1);
    });

    it('should expire key after TTL', async (done) => {
      await service.set('expiring-key', 'value', 1);

      setTimeout(async () => {
        const result = await service.get('expiring-key');
        expect(result).toBeNull();
        done();
      }, 1500);
    });
  });

  describe('Bulk Operations', () => {
    it('should handle mget', async () => {
      await service.set('key1', { value: 1 }, 3600);
      await service.set('key2', { value: 2 }, 3600);
      await service.set('key3', { value: 3 }, 3600);

      const result = await service.mget(['key1', 'key2', 'key3']);
      expect(result.get('key1')).toEqual({ value: 1 });
      expect(result.get('key2')).toEqual({ value: 2 });
      expect(result.get('key3')).toEqual({ value: 3 });
    });

    it('should handle mset', async () => {
      const entries = new Map([
        ['bulk1', { id: 1 }],
        ['bulk2', { id: 2 }],
        ['bulk3', { id: 3 }],
      ]);

      const result = await service.mset(entries, 3600);
      expect(result).toBe(true);

      const retrieved = await service.get('bulk1');
      expect(retrieved).toEqual({ id: 1 });
    });
  });

  describe('Counter Operations', () => {
    it('should increment counter', async () => {
      let result = await service.increment('counter', 1);
      expect(result).toBeGreaterThanOrEqual(1);

      result = await service.increment('counter', 5);
      expect(result).toBeGreaterThanOrEqual(6);
    });

    it('should handle counter from zero', async () => {
      await service.delete('new-counter');
      const result = await service.increment('new-counter', 1);
      expect(result).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Data Serialization', () => {
    it('should serialize and deserialize objects', async () => {
      const complexObj = {
        nested: {
          deep: {
            value: 'test',
            array: [1, 2, 3],
          },
        },
      };

      await service.set('complex', complexObj, 3600);
      const result = await service.get('complex');
      expect(result).toEqual(complexObj);
    });

    it('should handle arrays', async () => {
      const array = [1, 'two', { three: 3 }, [4, 5]];
      await service.set('array-key', array, 3600);
      const result = await service.get('array-key');
      expect(result).toEqual(array);
    });

    it('should handle primitives', async () => {
      await service.set('string', 'value', 3600);
      await service.set('number', 42, 3600);
      await service.set('boolean', true, 3600);

      expect(await service.get('string')).toBe('value');
      expect(await service.get('number')).toBe(42);
      expect(await service.get('boolean')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle get errors gracefully', async () => {
      const result = await service.get('any-key');
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should handle set errors gracefully', async () => {
      const result = await service.set('key', 'value', 3600);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Cache Management', () => {
    it('should clear entire cache', async () => {
      await service.set('key1', 'value1', 3600);
      await service.set('key2', 'value2', 3600);

      const cleared = await service.clear();
      expect(cleared).toBe(true);

      const key1 = await service.get('key1');
      const key2 = await service.get('key2');
      expect(key1).toBeNull();
      expect(key2).toBeNull();
    });

    it('should get cache stats', async () => {
      const stats = await service.getStats();
      expect(stats).toBeDefined();
      if (stats) {
        expect(stats.connected_clients).toBeDefined();
        expect(stats.used_memory).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    it('should handle rapid operations', async () => {
      const startTime = performance.now();

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(service.set(`perf-key-${i}`, { value: i }, 3600));
      }

      await Promise.all(promises);
      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(5000); // Should complete in < 5 seconds
    });
  });

  afterAll(async () => {
    await service.clear();
  });
});
