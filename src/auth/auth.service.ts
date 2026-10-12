import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface User {
  id: string;
  email: string;
  password: string;
  role: 'user' | 'admin' | 'moderator';
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  refreshTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthService {
  private users: Map<string, User> = new Map();
  private tokenBlacklist: Set<string> = new Set();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Enregistrer un nouvel utilisateur
   */
  async register(email: string, password: string): Promise<{ userId: string; message: string }> {
    if (this.users.has(email)) {
      throw new BadRequestException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = this.generateId();

    const user: User = {
      id: userId,
      email,
      password: hashedPassword,
      role: 'user',
      twoFactorEnabled: false,
      refreshTokens: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(email, user);

    return {
      userId,
      message: 'User registered successfully',
    };
  }

  /**
   * Login avec email/password
   */
  async login(email: string, password: string): Promise<AuthToken> {
    const user = this.users.get(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.twoFactorEnabled) {
      // Retourner un token temporaire pour compléter 2FA
      return this.generateTemporaryToken(user);
    }

    return this.generateTokens(user);
  }

  /**
   * Vérifier le code 2FA
   */
  async verify2FA(userId: string, code: string): Promise<AuthToken> {
    const user = Array.from(this.users.values()).find(u => u.id === userId);
    if (!user || !user.twoFactorEnabled) {
      throw new UnauthorizedException('2FA not enabled');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    return this.generateTokens(user);
  }

  /**
   * Activer la 2FA
   */
  async enable2FA(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = Array.from(this.users.values()).find(u => u.id === userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `PepitoStream (${user.email})`,
      issuer: 'PepitoStream',
      length: 32,
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    user.twoFactorSecret = secret.base32;

    return {
      secret: secret.base32,
      qrCode,
    };
  }

  /**
   * Confirmer l'activation de 2FA
   */
  async confirm2FA(userId: string, code: string): Promise<{ message: string }> {
    const user = Array.from(this.users.values()).find(u => u.id === userId);
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA setup not initiated');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    user.twoFactorEnabled = true;
    user.updatedAt = new Date();

    return { message: '2FA enabled successfully' };
  }

  /**
   * Désactiver la 2FA
   */
  async disable2FA(userId: string, password: string): Promise<{ message: string }> {
    const user = Array.from(this.users.values()).find(u => u.id === userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.updatedAt = new Date();

    return { message: '2FA disabled successfully' };
  }

  /**
   * Refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthToken> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = Array.from(this.users.values()).find(u => u.id === payload.sub);
      if (!user || !user.refreshTokens.includes(refreshToken)) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Retirer l'ancien token
      user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Logout
   */
  async logout(token: string): Promise<{ message: string }> {
    this.tokenBlacklist.add(token);
    return { message: 'Logout successful' };
  }

  /**
   * Vérifier si un token est révoqué
   */
  isTokenBlacklisted(token: string): boolean {
    return this.tokenBlacklist.has(token);
  }

  /**
   * Valider un utilisateur
   */
  async validateUser(userId: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(u => u.id === userId);
    return user || null;
  }

  /**
   * Générer les tokens JWT
   */
  private generateTokens(user: User): AuthToken {
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        scope: this.getScopes(user.role),
      },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: '15m',
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );

    user.refreshTokens.push(refreshToken);
    user.updatedAt = new Date();

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes en secondes
    };
  }

  /**
   * Générer un token temporaire pour 2FA
   */
  private generateTemporaryToken(user: User): AuthToken {
    const tempToken = this.jwtService.sign(
      {
        sub: user.id,
        type: '2FA_TEMP',
      },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: '5m',
      },
    );

    return {
      accessToken: tempToken,
      refreshToken: '',
      expiresIn: 5 * 60, // 5 minutes
    };
  }

  /**
   * Obtenir les scopes selon le rôle
   */
  private getScopes(role: string): string[] {
    const scopes: Record<string, string[]> = {
      user: ['read:streams', 'read:profile', 'write:profile'],
      admin: ['read:*', 'write:*', 'delete:*', 'admin:*'],
      moderator: ['read:*', 'write:moderation', 'read:reports'],
    };
    return scopes[role] || [];
  }

  /**
   * Générer un ID unique
   */
  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
