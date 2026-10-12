import { CacheCompressionService } from './cache-compression.service';

describe('CacheCompressionService', () => {
  let service: CacheCompressionService;

  beforeEach(() => {
    service = new CacheCompressionService({
      enabled: true,
      algorithm: 'gzip',
      level: 6,
      threshold: 100, // 100 bytes
    });
  });

  describe('Gzip Compression', () => {
    it('should compress string data', async () => {
      const data = 'x'.repeat(1000);
      const { compressed, stats } = await service.compress(data);

      expect(compressed.length).toBeLessThan(data.length);
      expect(stats.compressionRatio).toBeGreaterThan(0);
      expect(stats.originalSize).toBe(1000);
    });

    it('should decompress gzip data', async () => {
      const original = 'Hello World! '.repeat(100);
      const { compressed } = await service.compress(original);
      const { decompressed } = await service.decompress(compressed);

      expect(decompressed.toString('utf-8')).toBe(original);
    });

    it('should skip compression for small data', async () => {
      const smallData = 'small';
      const { compressed, stats } = await service.compress(smallData);

      expect(compressed.toString()).toBe(smallData);
      expect(stats.compressionRatio).toBe(0);
    });
  });

  describe('Brotli Compression', () => {
    let brotliService: CacheCompressionService;

    beforeEach(() => {
      brotliService = new CacheCompressionService({
        enabled: true,
        algorithm: 'brotli',
        level: 6,
        threshold: 100,
      });
    });

    it('should compress with brotli', async () => {
      const data = 'test data '.repeat(500);
      const { compressed, stats } = await brotliService.compress(data);

      expect(compressed.length).toBeLessThan(data.length);
      expect(stats.compressionRatio).toBeGreaterThan(0);
    });

    it('should decompress brotli data', async () => {
      const original = 'Brotli test '.repeat(100);
      const { compressed } = await brotliService.compress(original);
      const { decompressed } = await brotliService.decompress(compressed);

      expect(decompressed.toString('utf-8')).toBe(original);
    });
  });

  describe('Deflate Compression', () => {
    let deflateService: CacheCompressionService;

    beforeEach(() => {
      deflateService = new CacheCompressionService({
        enabled: true,
        algorithm: 'deflate',
        level: 6,
        threshold: 100,
      });
    });

    it('should compress with deflate', async () => {
      const data = 'deflate test '.repeat(200);
      const { compressed, stats } = await deflateService.compress(data);

      expect(compressed.length).toBeLessThan(data.length);
      expect(stats.compressionRatio).toBeGreaterThan(0);
    });

    it('should decompress deflate data', async () => {
      const original = 'Deflate compression '.repeat(50);
      const { compressed } = await deflateService.compress(original);
      const { decompressed } = await deflateService.decompress(compressed);

      expect(decompressed.toString('utf-8')).toBe(original);
    });
  });

  describe('Buffer Handling', () => {
    it('should compress Buffer data', async () => {
      const data = Buffer.from('test data'.repeat(100));
      const { compressed, stats } = await service.compress(data);

      expect(compressed.length).toBeLessThan(data.length);
    });

    it('should handle binary data', async () => {
      const binaryData = Buffer.alloc(500, 'test');
      const { compressed } = await service.compress(binaryData);
      const { decompressed } = await service.decompress(compressed);

      expect(decompressed.length).toBe(binaryData.length);
    });
  });

  describe('Statistics', () => {
    it('should track compression statistics', async () => {
      const data = 'test '.repeat(200);

      await service.compress(data);
      await service.compress(data);

      const stats = service.getStats();
      expect(stats.attempts).toBe(2);
      expect(stats.totalOriginalSize).toBeGreaterThan(0);
      expect(stats.totalCompressedSize).toBeGreaterThan(0);
    });

    it('should calculate compression ratio', async () => {
      const data = 'x'.repeat(1000);
      await service.compress(data);

      const stats = service.getStats();
      expect(stats.overallCompressionRatio).toBeGreaterThan(0);
    });

    it('should reset statistics', async () => {
      const data = 'test '.repeat(100);
      await service.compress(data);

      service.resetStats();
      const stats = service.getStats();

      expect(stats.totalOriginalSize).toBe(0);
      expect(stats.totalCompressedSize).toBe(0);
      expect(stats.attempts).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should compress efficiently', async () => {
      const data = 'performance test '.repeat(500);
      const startTime = performance.now();

      await service.compress(data);

      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(1000); // < 1 second
    });

    it('should decompress efficiently', async () => {
      const data = 'decompression test '.repeat(500);
      const { compressed } = await service.compress(data);

      const startTime = performance.now();
      await service.decompress(compressed);
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(500); // < 500ms
    });

    it('should handle large data', async () => {
      const largeData = 'large '.repeat(10000); // ~60KB
      const { stats } = await service.compress(largeData);

      expect(stats.originalSize).toBeGreaterThan(50000);
      expect(stats.compressedSize).toBeLessThan(stats.originalSize);
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted data gracefully', async () => {
      const corrupted = Buffer.from([0xff, 0xd8, 0xff]);
      const { decompressed } = await service.decompress(corrupted);
      expect(decompressed).toBeDefined();
    });
  });

  describe('Compression Levels', () => {
    it('should handle different compression levels', async () => {
      const data = 'level test '.repeat(500);

      const level1 = new CacheCompressionService({
        enabled: true,
        algorithm: 'gzip',
        level: 1,
        threshold: 0,
      });

      const level9 = new CacheCompressionService({
        enabled: true,
        algorithm: 'gzip',
        level: 9,
        threshold: 0,
      });

      const result1 = await level1.compress(data);
      const result9 = await level9.compress(data);

      // Level 9 should compress better (smaller size)
      expect(result9.compressed.length).toBeLessThanOrEqual(result1.compressed.length);
    });
  });
});
