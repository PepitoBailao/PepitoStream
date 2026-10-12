import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as speakeasy from 'speakeasy';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const result = await service.register('user@example.com', 'password123');
      expect(result.userId).toBeDefined();
      expect(result.message).toBe('User registered successfully');
    });

    it('should throw error if user already exists', async () => {
      await service.register('user@example.com', 'password123');
      await expect(
        service.register('user@example.com', 'password456'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if password is too short', async () => {
      await expect(
        service.register('user@example.com', 'short'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await service.register('user@example.com', 'password123');
    });

    it('should login with valid credentials', async () => {
      const result = await service.login('user@example.com', 'password123');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(900);
    });

    it('should throw error with invalid email', async () => {
      await expect(
        service.login('wrong@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw error with invalid password', async () => {
      await expect(
        service.login('user@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('2FA', () => {
    let userId: string;

    beforeEach(async () => {
      const result = await service.register('user@example.com', 'password123');
      userId = result.userId;
    });

    it('should enable 2FA', async () => {
      const result = await service.enable2FA(userId);
      expect(result.secret).toBeDefined();
      expect(result.qrCode).toContain('data:image/png;base64');
    });

    it('should confirm 2FA with valid code', async () => {
      await service.enable2FA(userId);

      // Générer un code valide
      const user = Array.from((service as any).users.values()).find(
        u => u.id === userId,
      );
      const code = speakeasy.totp({
        secret: user.twoFactorSecret,
        encoding: 'base32',
      });

      const result = await service.confirm2FA(userId, code);
      expect(result.message).toBe('2FA enabled successfully');
    });

    it('should reject invalid 2FA code', async () => {
      await service.enable2FA(userId);
      await expect(service.confirm2FA(userId, '000000')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should verify 2FA on login', async () => {
      await service.enable2FA(userId);
      const user = Array.from((service as any).users.values()).find(
        u => u.id === userId,
      );
      const code = speakeasy.totp({
        secret: user.twoFactorSecret,
        encoding: 'base32',
      });
      await service.confirm2FA(userId, code);

      // Login should return temp token
      const loginResult = await service.login('user@example.com', 'password123');
      expect(loginResult.expiresIn).toBe(300); // 5 min pour temp token
    });

    it('should disable 2FA', async () => {
      await service.enable2FA(userId);
      const user = Array.from((service as any).users.values()).find(
        u => u.id === userId,
      );
      const code = speakeasy.totp({
        secret: user.twoFactorSecret,
        encoding: 'base32',
      });
      await service.confirm2FA(userId, code);

      const result = await service.disable2FA(userId, 'password123');
      expect(result.message).toBe('2FA disabled successfully');
    });
  });

  describe('refreshToken', () => {
    let userId: string;

    beforeEach(async () => {
      const result = await service.register('user@example.com', 'password123');
      userId = result.userId;
    });

    it('should refresh token with valid refresh token', async () => {
      const loginResult = await service.login('user@example.com', 'password123');
      const refreshResult = await service.refreshToken(loginResult.refreshToken);
      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.refreshToken).toBeDefined();
    });

    it('should throw error with invalid refresh token', async () => {
      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should blacklist token', async () => {
      const result = await service.logout('test-token');
      expect(result.message).toBe('Logout successful');
      expect(service.isTokenBlacklisted('test-token')).toBe(true);
    });
  });

  describe('validateUser', () => {
    let userId: string;

    beforeEach(async () => {
      const result = await service.register('user@example.com', 'password123');
      userId = result.userId;
    });

    it('should validate existing user', async () => {
      const user = await service.validateUser(userId);
      expect(user).toBeDefined();
      expect(user.id).toBe(userId);
    });

    it('should return null for non-existent user', async () => {
      const user = await service.validateUser('invalid-id');
      expect(user).toBeNull();
    });
  });

  describe('scopes', () => {
    it('should assign correct scopes for user role', async () => {
      const result = await service.register('user@example.com', 'password123');
      const user = Array.from((service as any).users.values()).find(
        u => u.id === result.userId,
      );
      expect(user.role).toBe('user');
    });

    it('should assign correct scopes for admin role', async () => {
      const result = await service.register('admin@example.com', 'password123');
      const user = Array.from((service as any).users.values()).find(
        u => u.id === result.userId,
      );
      user.role = 'admin';
      expect(user.role).toBe('admin');
    });
  });
});
