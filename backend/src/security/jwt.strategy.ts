import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { RedisService } from '../cache/redis.service';
import { Logger } from 'pino';

export interface JWTPayload {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
}

@Injectable()
export class JWTStrategy {
  private logger: Logger;
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: number = 15 * 60; // 15 minutes
  private refreshTokenExpiry: number = 7 * 24 * 60 * 60; // 7 days

  constructor(
    private redisService: RedisService,
    logger: Logger
  ) {
    this.logger = logger.child({ context: 'JWTStrategy' });
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'access-secret-key';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'refresh-secret-key';
  }

  /**
   * Generate access and refresh tokens
   */
  generateTokenPair(payload: JWTPayload): TokenPair {
    const accessToken = jwt.sign(
      payload,
      this.accessTokenSecret,
      { expiresIn: this.accessTokenExpiry }
    );

    const refreshToken = jwt.sign(
      { userId: payload.userId, tokenId: crypto.randomUUID() },
      this.refreshTokenSecret,
      { expiresIn: this.refreshTokenExpiry }
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: this.accessTokenExpiry,
      refreshTokenExpiresIn: this.refreshTokenExpiry,
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.accessTokenSecret) as JWTPayload;
    } catch (error) {
      this.logger.warn({ error }, 'Access token verification failed');
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token: string, userId: string): Promise<JWTPayload> {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret) as any;
      
      // Check if token is in blacklist
      const isBlacklisted = await this.redisService.get(`blacklist:${userId}:${decoded.tokenId}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      return decoded;
    } catch (error) {
      this.logger.warn({ error }, 'Refresh token verification failed');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    payload: JWTPayload
  ): Promise<TokenPair> {
    await this.verifyRefreshToken(refreshToken, payload.userId);

    return this.generateTokenPair(payload);
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(refreshToken: string, userId: string): Promise<void> {
    try {
      const decoded = jwt.verify(refreshToken, this.refreshTokenSecret) as any;
      const ttl = Math.ceil((decoded.exp - Math.floor(Date.now() / 1000)));
      
      if (ttl > 0) {
        await this.redisService.set(
          `blacklist:${userId}:${decoded.tokenId}`,
          'revoked',
          ttl
        );
        this.logger.debug({ userId }, 'Refresh token revoked');
      }
    } catch (error) {
      this.logger.warn({ error }, 'Failed to revoke refresh token');
    }
  }

  /**
   * Revoke all tokens for user (logout all devices)
   */
  async revokeAllTokens(userId: string): Promise<void> {
    // Implementation would need tracking of all issued tokenIds per user
    // This is a simplified version
    await this.redisService.set(`user-logout:${userId}`, 'all-tokens-revoked', 24 * 60 * 60);
    this.logger.debug({ userId }, 'All tokens revoked');
  }

  /**
   * Check if user has been logged out globally
   */
  async isUserLoggedOut(userId: string): Promise<boolean> {
    const logoutKey = await this.redisService.get(`user-logout:${userId}`);
    return !!logoutKey;
  }

  /**
   * Validate token permissions
   */
  validatePermissions(payload: JWTPayload, requiredPermissions: string[]): boolean {
    return requiredPermissions.every(permission =>
      payload.permissions.includes(permission)
    );
  }

  /**
   * Validate token roles
   */
  validateRoles(payload: JWTPayload, requiredRoles: string[]): boolean {
    return requiredRoles.some(role => payload.roles.includes(role));
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    return authHeader.substring(7);
  }
}
