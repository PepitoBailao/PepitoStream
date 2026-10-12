import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'user' | 'admin' | 'moderator';
  iat: number;
  exp: number;
  scope: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload) {
    // Valider que l'utilisateur existe toujours
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new Error('User not found');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      scope: payload.scope,
    };
  }
}

/**
 * JWT Strategy pour Passport
 * 
 * Features:
 * - Extraction automatique du token Bearer
 * - Validation de l'expiration
 * - Validation de la signature
 * - Récupération de l'utilisateur
 * - Support des rôles et scopes
 * 
 * Usage:
 * @UseGuards(JwtAuthGuard)
 * @Get('/protected')
 * async getProtected(@Request() req) {
 *   return req.user;
 * }
 */
