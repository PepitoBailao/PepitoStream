import { Controller, Post, Get, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard, TwoFactorGuard } from './jwt-auth.guard';

export class RegisterDto {
  email: string;
  password: string;
}

export class LoginDto {
  email: string;
  password: string;
}

export class Verify2FADto {
  code: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /auth/register
   * Enregistrer un nouvel utilisateur
   * 
   * Body:
   * {
   *   "email": "user@example.com",
   *   "password": "SecurePassword123!"
   * }
   * 
   * Response:
   * {
   *   "userId": "user_1728736920000_abc123def",
   *   "message": "User registered successfully"
   * }
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    if (!dto.email || !dto.password) {
      throw new BadRequestException('Email and password are required');
    }

    if (dto.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    return this.authService.register(dto.email, dto.password);
  }

  /**
   * POST /auth/login
   * Login avec email/password
   * 
   * Body:
   * {
   *   "email": "user@example.com",
   *   "password": "SecurePassword123!"
   * }
   * 
   * Response:
   * {
   *   "accessToken": "eyJhbGciOiJIUzI1NiIs...",
   *   "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
   *   "expiresIn": 900,
   *   "requiresTwoFactor": false
   * }
   */
  @Post('login')
  async login(@Body() dto: LoginDto) {
    if (!dto.email || !dto.password) {
      throw new BadRequestException('Email and password are required');
    }

    const result = await this.authService.login(dto.email, dto.password);

    // Vérifier si c'est un token temporaire 2FA
    const decoded = this.decodeToken(result.accessToken);
    if (decoded.type === '2FA_TEMP') {
      return {
        ...result,
        requiresTwoFactor: true,
        message: '2FA verification required',
      };
    }

    return {
      ...result,
      requiresTwoFactor: false,
    };
  }

  /**
   * POST /auth/verify-2fa
   * Vérifier le code 2FA et retourner les tokens
   * 
   * Headers:
   * Authorization: Bearer <2FA_TEMP_TOKEN>
   * 
   * Body:
   * {
   *   "code": "123456"
   * }
   * 
   * Response:
   * {
   *   "accessToken": "eyJhbGciOiJIUzI1NiIs...",
   *   "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
   *   "expiresIn": 900
   * }
   */
  @Post('verify-2fa')
  @UseGuards(TwoFactorGuard)
  async verify2FA(@Request() req, @Body() dto: Verify2FADto) {
    if (!dto.code) {
      throw new BadRequestException('Code is required');
    }

    return this.authService.verify2FA(req.user.sub, dto.code);
  }

  /**
   * GET /auth/enable-2fa
   * Générer et retourner le secret 2FA + QR Code
   * 
   * Headers:
   * Authorization: Bearer <ACCESS_TOKEN>
   * 
   * Response:
   * {
   *   "secret": "JBSWY3DPEBLW64TMMQ======",
   *   "qrCode": "data:image/png;base64,iVBORw0KGgo..."
   * }
   */
  @Get('enable-2fa')
  @UseGuards(JwtAuthGuard)
  async enable2FA(@Request() req) {
    return this.authService.enable2FA(req.user.userId);
  }

  /**
   * POST /auth/confirm-2fa
   * Confirmer l'activation de 2FA
   * 
   * Headers:
   * Authorization: Bearer <ACCESS_TOKEN>
   * 
   * Body:
   * {
   *   "code": "123456"
   * }
   * 
   * Response:
   * {
   *   "message": "2FA enabled successfully"
   * }
   */
  @Post('confirm-2fa')
  @UseGuards(JwtAuthGuard)
  async confirm2FA(@Request() req, @Body() dto: Verify2FADto) {
    if (!dto.code) {
      throw new BadRequestException('Code is required');
    }

    return this.authService.confirm2FA(req.user.userId, dto.code);
  }

  /**
   * POST /auth/disable-2fa
   * Désactiver la 2FA (confirmation password requise)
   * 
   * Headers:
   * Authorization: Bearer <ACCESS_TOKEN>
   * 
   * Body:
   * {
   *   "password": "SecurePassword123!"
   * }
   * 
   * Response:
   * {
   *   "message": "2FA disabled successfully"
   * }
   */
  @Post('disable-2fa')
  @UseGuards(JwtAuthGuard)
  async disable2FA(@Request() req, @Body() dto: { password: string }) {
    if (!dto.password) {
      throw new BadRequestException('Password is required');
    }

    return this.authService.disable2FA(req.user.userId, dto.password);
  }

  /**
   * POST /auth/refresh
   * Générer un nouveau access token avec le refresh token
   * 
   * Body:
   * {
   *   "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
   * }
   * 
   * Response:
   * {
   *   "accessToken": "eyJhbGciOiJIUzI1NiIs...",
   *   "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
   *   "expiresIn": 900
   * }
   */
  @Post('refresh')
  async refreshToken(@Body() dto: { refreshToken: string }) {
    if (!dto.refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    return this.authService.refreshToken(dto.refreshToken);
  }

  /**
   * POST /auth/logout
   * Révoquer le token actuel
   * 
   * Headers:
   * Authorization: Bearer <ACCESS_TOKEN>
   * 
   * Response:
   * {
   *   "message": "Logout successful"
   * }
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req) {
    const token = this.extractToken(req);
    return this.authService.logout(token);
  }

  /**
   * GET /auth/me
   * Obtenir les informations de l'utilisateur connecté
   * 
   * Headers:
   * Authorization: Bearer <ACCESS_TOKEN>
   * 
   * Response:
   * {
   *   "userId": "user_1728736920000_abc123def",
   *   "email": "user@example.com",
   *   "role": "user",
   *   "twoFactorEnabled": true
   * }
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return {
      userId: req.user.userId,
      email: req.user.email,
      role: req.user.role,
      scope: req.user.scope,
    };
  }

  /**
   * Extraire le token du header Authorization
   */
  private extractToken(request: any): string {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new BadRequestException('No token provided');
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer') {
      throw new BadRequestException('Invalid auth scheme');
    }

    return token;
  }

  /**
   * Décoder un JWT (sans vérification)
   */
  private decodeToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return {};
      const decoded = Buffer.from(parts[1], 'base64').toString();
      return JSON.parse(decoded);
    } catch {
      return {};
    }
  }
}
