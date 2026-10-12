import { Test, TestingModule } from '@nestjs/testing';
import { JWTStrategy, JWTPayload } from './jwt.strategy';
import { RedisService } from '../cache/redis.service';
import { UnauthorizedException } from '@nestjs/common';
import pino from 'pino';

describe('JWTStrategy', () => {
  let service: JWTStrategy;
  let mockRedisService: Partial<RedisService>;
  const logger = pino();

  const testPayload: JWTPayload = {
    userId: 'user123',
    email: 'test@example.com',
    roles: ['user', 'premium'],
    permissions: ['watch:movies', 'watch:series'],
  };

  beforeEach(async () => {
    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JWTStrategy,
        { provide: RedisService, useValue: mockRedisService },
        { provide: 'LOGGER', useValue: logger },
      ],
    }).compile();

    service = module.get<JWTStrategy>(JWTStrategy);
  });

  describe('Token Generation', () => {
    it('should generate valid token pair', () => {
      const tokenPair = service.generateTokenPair(testPayload);

      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.accessTokenExpiresIn).toBe(15 * 60);
      expect(tokenPair.refreshTokenExpiresIn).toBe(7 * 24 * 60 * 60);
    });

    it('should include payload data in token', () => {
      const tokenPair = service.generateTokenPair(testPayload);
      const decoded = service.verifyAccessToken(tokenPair.accessToken);

      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.roles).toEqual(testPayload.roles);
    });
  });

  describe('Token Verification', () => {
    it('should verify valid access token', () => {
      const tokenPair = service.generateTokenPair(testPayload);
      const decoded = service.verifyAccessToken(tokenPair.accessToken);

      expect(decoded.userId).toBe(testPayload.userId);
    });

    it('should reject invalid access token', () => {
      expect(() => {
        service.verifyAccessToken('invalid-token');
      }).toThrow(UnauthorizedException);
    });

    it('should verify valid refresh token', async () => {
      (mockRedisService.get as jest.Mock).mockResolvedValue(null);
      const tokenPair = service.generateTokenPair(testPayload);

      const result = await service.verifyRefreshToken(
        tokenPair.refreshToken,
        testPayload.userId
      );

      expect(result).toBeDefined();
    });

    it('should reject blacklisted refresh token', async () => {
      (mockRedisService.get as jest.Mock).mockResolvedValue('revoked');
      const tokenPair = service.generateTokenPair(testPayload);

      await expect(
        service.verifyRefreshToken(tokenPair.refreshToken, testPayload.userId)
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      (mockRedisService.get as jest.Mock).mockResolvedValue(null);
      const tokenPair = service.generateTokenPair(testPayload);

      const newTokenPair = await service.refreshAccessToken(
        tokenPair.refreshToken,
        testPayload
      );

      expect(newTokenPair.accessToken).toBeDefined();
      expect(newTokenPair.accessToken).not.toBe(tokenPair.accessToken);
    });
  });

  describe('Token Revocation', () => {
    it('should revoke refresh token', async () => {
      (mockRedisService.set as jest.Mock).mockResolvedValue(true);
      const tokenPair = service.generateTokenPair(testPayload);

      await service.revokeRefreshToken(tokenPair.refreshToken, testPayload.userId);

      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('should revoke all tokens for user', async () => {
      (mockRedisService.set as jest.Mock).mockResolvedValue(true);

      await service.revokeAllTokens(testPayload.userId);

      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('should check if user is logged out', async () => {
      (mockRedisService.get as jest.Mock).mockResolvedValue('all-tokens-revoked');

      const isLoggedOut = await service.isUserLoggedOut(testPayload.userId);

      expect(isLoggedOut).toBe(true);
    });
  });

  describe('Permission and Role Validation', () => {
    it('should validate user has required permissions', () => {
      const hasPermission = service.validatePermissions(testPayload, [
        'watch:movies',
      ]);

      expect(hasPermission).toBe(true);
    });

    it('should reject missing permissions', () => {
      const hasPermission = service.validatePermissions(testPayload, [
        'admin:delete',
      ]);

      expect(hasPermission).toBe(false);
    });

    it('should validate user has required role', () => {
      const hasRole = service.validateRoles(testPayload, ['premium']);

      expect(hasRole).toBe(true);
    });

    it('should reject missing role', () => {
      const hasRole = service.validateRoles(testPayload, ['admin']);

      expect(hasRole).toBe(false);
    });
  });

  describe('Authorization Header Extraction', () => {
    it('should extract token from valid header', () => {
      const header = 'Bearer valid-token';
      const token = service.extractTokenFromHeader(header);

      expect(token).toBe('valid-token');
    });

    it('should reject invalid header format', () => {
      expect(() => {
        service.extractTokenFromHeader('InvalidFormat');
      }).toThrow(UnauthorizedException);
    });

    it('should reject missing header', () => {
      expect(() => {
        service.extractTokenFromHeader('');
      }).toThrow(UnauthorizedException);
    });
  });
});
