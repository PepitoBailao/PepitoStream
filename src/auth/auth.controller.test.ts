import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            verify2FA: jest.fn(),
            enable2FA: jest.fn(),
            confirm2FA: jest.fn(),
            disable2FA: jest.fn(),
            refreshToken: jest.fn(),
            logout: jest.fn(),
            validateUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  describe('POST /auth/register', () => {
    it('should register user successfully', async () => {
      const dto = { email: 'test@example.com', password: 'Password123!' };
      jest.spyOn(authService, 'register').mockResolvedValue({
        userId: 'user_123',
        message: 'User registered successfully',
      });

      const result = await controller.register(dto);
      expect(result.userId).toBe('user_123');
      expect(authService.register).toHaveBeenCalledWith(dto.email, dto.password);
    });

    it('should throw error if email is missing', async () => {
      const dto = { email: '', password: 'Password123!' };
      await expect(controller.register(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw error if password is too short', async () => {
      const dto = { email: 'test@example.com', password: 'short' };
      await expect(controller.register(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /auth/login', () => {
    it('should login user successfully', async () => {
      const dto = { email: 'test@example.com', password: 'Password123!' };
      const tokens = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresIn: 900,
      };
      jest.spyOn(authService, 'login').mockResolvedValue(tokens);

      const result = await controller.login(dto);
      expect(result.accessToken).toBe('access_token');
      expect(result.requiresTwoFactor).toBe(false);
    });

    it('should require 2FA if enabled', async () => {
      const dto = { email: 'test@example.com', password: 'Password123!' };
      const tempToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsInR5cGUiOiIyRkFfVEVNUCJ9.fake';
      jest.spyOn(authService, 'login').mockResolvedValue({
        accessToken: tempToken,
        refreshToken: '',
        expiresIn: 300,
      });

      const result = await controller.login(dto);
      expect(result.requiresTwoFactor).toBe(true);
    });
  });

  describe('POST /auth/verify-2fa', () => {
    it('should verify 2FA code and return tokens', async () => {
      const req = { user: { sub: 'user_123' } };
      const dto = { code: '123456' };
      const tokens = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresIn: 900,
      };
      jest.spyOn(authService, 'verify2FA').mockResolvedValue(tokens);

      const result = await controller.verify2FA(req, dto);
      expect(result.accessToken).toBe('access_token');
      expect(authService.verify2FA).toHaveBeenCalledWith('user_123', '123456');
    });

    it('should throw error if code is missing', async () => {
      const req = { user: { sub: 'user_123' } };
      const dto = { code: '' };
      await expect(controller.verify2FA(req, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /auth/enable-2fa', () => {
    it('should return 2FA secret and QR code', async () => {
      const req = { user: { userId: 'user_123' } };
      const result = {
        secret: 'JBSWY3DPEBLW64TMMQ======',
        qrCode: 'data:image/png;base64,...',
      };
      jest.spyOn(authService, 'enable2FA').mockResolvedValue(result);

      const response = await controller.enable2FA(req);
      expect(response.secret).toBeDefined();
      expect(response.qrCode).toContain('data:image');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should generate new access token', async () => {
      const dto = { refreshToken: 'refresh_token' };
      const tokens = {
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresIn: 900,
      };
      jest.spyOn(authService, 'refreshToken').mockResolvedValue(tokens);

      const result = await controller.refreshToken(dto);
      expect(result.accessToken).toBe('new_access_token');
      expect(authService.refreshToken).toHaveBeenCalledWith('refresh_token');
    });

    it('should throw error if refresh token is missing', async () => {
      const dto = { refreshToken: '' };
      await expect(controller.refreshToken(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout user', async () => {
      const req = { headers: { authorization: 'Bearer access_token' } };
      jest.spyOn(authService, 'logout').mockResolvedValue({ message: 'Logout successful' });

      const result = await controller.logout(req);
      expect(result.message).toBe('Logout successful');
    });
  });

  describe('GET /auth/me', () => {
    it('should return user profile', async () => {
      const req = {
        user: {
          userId: 'user_123',
          email: 'test@example.com',
          role: 'user',
          scope: ['read:streams', 'read:profile'],
        },
      };

      const result = await controller.getProfile(req);
      expect(result.userId).toBe('user_123');
      expect(result.email).toBe('test@example.com');
      expect(result.role).toBe('user');
    });
  });
});
