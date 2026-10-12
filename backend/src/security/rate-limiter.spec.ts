import { Test, TestingModule } from '@nestjs/testing';
import { RateLimiterService } from './rate-limiter.service';
import { RedisService } from '../cache/redis.service';
import pino from 'pino';

describe('RateLimiterService', () => {
  let service: RateLimiterService;
  let mockRedisService: Partial<RedisService>;
  const logger = pino();

  beforeEach(async () => {
    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      increment: jest.fn(),
      delete: jest.fn(),
      removeByScore: jest.fn(),
      countByScore: jest.fn(),
      addSortedSet: jest.fn(),
      setExpire: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimiterService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: 'LOGGER', useValue: logger },
      ],
    }).compile();

    service = module.get<RateLimiterService>(RateLimiterService);
  });

  describe('Fixed Window Strategy', () => {
    it('should allow requests within limit', async () => {
      (mockRedisService.get as jest.Mock).mockResolvedValue(null);
      (mockRedisService.set as jest.Mock).mockResolvedValue(true);

      const result = await service.checkLimit('test-key', {
        windowMs: 60000,
        maxRequests: 10,
        strategy: 'fixed-window',
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should reject requests exceeding limit', async () => {
      (mockRedisService.get as jest.Mock).mockResolvedValue('11');
      (mockRedisService.increment as jest.Mock).mockResolvedValue(12);

      const result = await service.checkLimit('test-key', {
        windowMs: 60000,
        maxRequests: 10,
        strategy: 'fixed-window',
      });

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });

    it('should reset counter on new window', async () => {
      (mockRedisService.get as jest.Mock)
        .mockResolvedValueOnce(Date.now() - 70000) // Old window
        .mockResolvedValueOnce(null);

      await service.checkLimit('test-key', {
        windowMs: 60000,
        maxRequests: 10,
        strategy: 'fixed-window',
      });

      expect(mockRedisService.set).toHaveBeenCalled();
    });
  });

  describe('Sliding Window Strategy', () => {
    it('should count requests in current window', async () => {
      (mockRedisService.removeByScore as jest.Mock).mockResolvedValue(true);
      (mockRedisService.countByScore as jest.Mock).mockResolvedValue(5);
      (mockRedisService.addSortedSet as jest.Mock).mockResolvedValue(true);

      const result = await service.checkLimit('test-key', {
        windowMs: 60000,
        maxRequests: 10,
        strategy: 'sliding-window',
      });

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(5);
    });

    it('should reject when exceeding sliding window limit', async () => {
      (mockRedisService.removeByScore as jest.Mock).mockResolvedValue(true);
      (mockRedisService.countByScore as jest.Mock).mockResolvedValue(10);

      const result = await service.checkLimit('test-key', {
        windowMs: 60000,
        maxRequests: 10,
        strategy: 'sliding-window',
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe('Token Bucket Strategy', () => {
    it('should allow request when tokens available', async () => {
      const state = JSON.stringify({
        tokens: 10,
        lastRefillTime: Date.now(),
      });
      (mockRedisService.get as jest.Mock).mockResolvedValue(state);
      (mockRedisService.set as jest.Mock).mockResolvedValue(true);

      const result = await service.checkLimit('test-key', {
        windowMs: 60000,
        maxRequests: 10,
        strategy: 'token-bucket',
      });

      expect(result.allowed).toBe(true);
    });

    it('should refill tokens over time', async () => {
      const state = JSON.stringify({
        tokens: 5,
        lastRefillTime: Date.now() - 30000,
      });
      (mockRedisService.get as jest.Mock).mockResolvedValue(state);
      (mockRedisService.set as jest.Mock).mockResolvedValue(true);

      await service.checkLimit('test-key', {
        windowMs: 60000,
        maxRequests: 10,
        strategy: 'token-bucket',
      });

      // Tokens should be refilled
      expect(mockRedisService.set).toHaveBeenCalled();
    });
  });

  describe('Leaky Bucket Strategy', () => {
    it('should allow request when queue not full', async () => {
      const state = JSON.stringify({
        queue: 5,
        leakRate: 0.1,
        lastLeakTime: Date.now(),
      });
      (mockRedisService.get as jest.Mock).mockResolvedValue(state);
      (mockRedisService.set as jest.Mock).mockResolvedValue(true);

      const result = await service.checkLimit('test-key', {
        windowMs: 60000,
        maxRequests: 10,
        strategy: 'leaky-bucket',
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('Reset and State', () => {
    it('should reset rate limit', async () => {
      (mockRedisService.delete as jest.Mock).mockResolvedValue(true);

      await service.reset('test-key');

      expect(mockRedisService.delete).toHaveBeenCalled();
    });

    it('should get current state', async () => {
      (mockRedisService.get as jest.Mock).mockResolvedValue('state-value');

      const state = await service.getState('test-key');

      expect(state).toBeDefined();
      expect(mockRedisService.get).toHaveBeenCalled();
    });
  });
});
