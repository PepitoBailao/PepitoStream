import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  UseGuards,
  Param,
} from '@nestjs/common';
import { RateLimiterService, RateLimitConfig } from './rate-limiter.service';
import { JWTStrategy, JWTPayload, TokenPair } from './jwt.strategy';
import { EncryptionService } from './encryption.service';

@Controller('api/security')
export class SecurityController {
  constructor(
    private rateLimiterService: RateLimiterService,
    private jwtStrategy: JWTStrategy,
    private encryptionService: EncryptionService
  ) {}

  /**
   * Generate token pair
   */
  @Post('auth/tokens')
  @HttpCode(HttpStatus.OK)
  generateTokens(@Body() payload: JWTPayload): TokenPair {
    if (!payload.userId || !payload.email) {
      throw new BadRequestException('userId and email are required');
    }
    return this.jwtStrategy.generateTokenPair(payload);
  }

  /**
   * Refresh access token
   */
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  refreshAccessToken(
    @Body() body: { refreshToken: string; payload: JWTPayload }
  ): Promise<TokenPair> {
    if (!body.refreshToken) {
      throw new BadRequestException('refreshToken is required');
    }
    return this.jwtStrategy.refreshAccessToken(body.refreshToken, body.payload);
  }

  /**
   * Revoke refresh token
   */
  @Post('auth/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeRefreshToken(
    @Body() body: { refreshToken: string; userId: string }
  ): Promise<void> {
    if (!body.refreshToken || !body.userId) {
      throw new BadRequestException('refreshToken and userId are required');
    }
    await this.jwtStrategy.revokeRefreshToken(body.refreshToken, body.userId);
  }

  /**
   * Logout all devices
   */
  @Post('auth/logout-all/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@Param('userId') userId: string): Promise<void> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    await this.jwtStrategy.revokeAllTokens(userId);
  }

  /**
   * Verify token
   */
  @Get('auth/verify')
  @HttpCode(HttpStatus.OK)
  verifyToken(@Headers('authorization') authHeader: string): JWTPayload {
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }
    const token = this.jwtStrategy.extractTokenFromHeader(authHeader);
    return this.jwtStrategy.verifyAccessToken(token);
  }

  /**
   * Check rate limit
   */
  @Post('rate-limit/check')
  @HttpCode(HttpStatus.OK)
  async checkRateLimit(
    @Body() body: { key: string; config: RateLimitConfig }
  ) {
    if (!body.key) {
      throw new BadRequestException('key is required');
    }
    return this.rateLimiterService.checkLimit(body.key, body.config);
  }

  /**
   * Reset rate limit
   */
  @Post('rate-limit/reset/:key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetRateLimit(@Param('key') key: string): Promise<void> {
    if (!key) {
      throw new BadRequestException('key is required');
    }
    await this.rateLimiterService.reset(key);
  }

  /**
   * Get rate limit state
   */
  @Get('rate-limit/state/:key')
  @HttpCode(HttpStatus.OK)
  async getRateLimitState(@Param('key') key: string) {
    if (!key) {
      throw new BadRequestException('key is required');
    }
    return this.rateLimiterService.getState(key);
  }

  /**
   * Encrypt data
   */
  @Post('encrypt')
  @HttpCode(HttpStatus.OK)
  encryptData(
    @Body() body: { data: string; additionalData?: string }
  ) {
    if (!body.data) {
      throw new BadRequestException('data is required');
    }
    return this.encryptionService.encrypt(body.data, body.additionalData);
  }

  /**
   * Decrypt data
   */
  @Post('decrypt')
  @HttpCode(HttpStatus.OK)
  decryptData(
    @Body() body: { ciphertext: string; iv: string; authTag: string; additionalData?: string }
  ): { plaintext: string } {
    if (!body.ciphertext || !body.iv || !body.authTag) {
      throw new BadRequestException('ciphertext, iv, and authTag are required');
    }
    const plaintext = this.encryptionService.decrypt(
      {
        ciphertext: body.ciphertext,
        iv: body.iv,
        authTag: body.authTag,
        algorithm: 'aes-256-gcm',
      },
      body.additionalData
    );
    return { plaintext };
  }

  /**
   * Hash password
   */
  @Post('password/hash')
  @HttpCode(HttpStatus.OK)
  hashPassword(@Body() body: { password: string }) {
    if (!body.password) {
      throw new BadRequestException('password is required');
    }
    return this.encryptionService.hashPassword(body.password);
  }

  /**
   * Verify password
   */
  @Post('password/verify')
  @HttpCode(HttpStatus.OK)
  verifyPassword(
    @Body() body: { password: string; hash: string; salt: string }
  ): { valid: boolean } {
    if (!body.password || !body.hash || !body.salt) {
      throw new BadRequestException('password, hash, and salt are required');
    }
    const valid = this.encryptionService.verifyPassword(
      body.password,
      body.hash,
      body.salt
    );
    return { valid };
  }

  /**
   * Generate signature
   */
  @Post('signature/generate')
  @HttpCode(HttpStatus.OK)
  generateSignature(
    @Body() body: { data: string; secret?: string }
  ): { signature: string } {
    if (!body.data) {
      throw new BadRequestException('data is required');
    }
    const signature = this.encryptionService.generateSignature(body.data, body.secret);
    return { signature };
  }

  /**
   * Verify signature
   */
  @Post('signature/verify')
  @HttpCode(HttpStatus.OK)
  verifySignature(
    @Body() body: { data: string; signature: string; secret?: string }
  ): { valid: boolean } {
    if (!body.data || !body.signature) {
      throw new BadRequestException('data and signature are required');
    }
    const valid = this.encryptionService.verifySignature(body.data, body.signature, body.secret);
    return { valid };
  }

  /**
   * Generate random token
   */
  @Post('token/generate')
  @HttpCode(HttpStatus.OK)
  generateToken(@Body() body: { length?: number }): { token: string } {
    const token = this.encryptionService.generateToken(body.length || 32);
    return { token };
  }

  /**
   * Generate RSA key pair
   */
  @Post('rsa/generate')
  @HttpCode(HttpStatus.OK)
  generateRSAKeyPair(
    @Body() body: { modulusLength?: number }
  ) {
    return this.encryptionService.generateRSAKeyPair(body.modulusLength || 2048);
  }
}
