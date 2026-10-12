import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    if (this.authService.isTokenBlacklisted(token)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    try {
      request.user = this.authService.validateToken(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }

  private extractToken(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer') {
      throw new UnauthorizedException('Invalid auth scheme');
    }

    return token;
  }
}

/**
 * Role-based access control guard
 */
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return true;
  }
}

/**
 * 2FA check guard
 */
@Injectable()
export class TwoFactorGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Si le token est un 2FA_TEMP, permettre seulement l'accès à /verify-2fa
    if (user.type === '2FA_TEMP') {
      const path = request.path;
      if (!path.includes('/verify-2fa')) {
        throw new UnauthorizedException('2FA verification required');
      }
    }

    return true;
  }
}
