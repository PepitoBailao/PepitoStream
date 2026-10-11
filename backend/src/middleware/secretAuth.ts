import { Request, Response, NextFunction } from 'express';
import { secretAuthService } from '../services/secretAuth';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  clientToken?: string;
  clientIp?: string;
}

/**
 * Middleware to validate secret auth token
 * Expects: Authorization: Bearer <token>
 * or query param: ?token=<token>
 */
export const secretAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Get client IP
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || 'unknown';
    req.clientIp = clientIp;

    // Check rate limit first
    if (!secretAuthService.checkRateLimit(clientIp)) {
      logger.warn('Rate limit exceeded', { ip: clientIp, path: req.path });
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Maximum 10 requests per 15 minutes.',
      });
    }

    // Extract token from Authorization header or query param
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      logger.warn('No token provided', { ip: clientIp, path: req.path });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Secret token required. Use Authorization: Bearer <token> or ?token=<token>',
      });
    }

    // Validate token
    const isValid = secretAuthService.validateToken(token, clientIp);

    if (!isValid) {
      logger.warn('Invalid or expired token', { ip: clientIp, path: req.path, token: token.substring(0, 8) + '...' });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }

    req.clientToken = token;
    logger.debug('Token validated', { ip: clientIp, path: req.path });

    next();
  } catch (error) {
    logger.error('Auth middleware error', { error: (error as Error).message, path: req.path });
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication check failed',
    });
  }
};

/**
 * Route to generate new token (call this once at startup or manually)
 */
export const generateTokenRoute = (req: AuthenticatedRequest, res: Response) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || 'unknown';

    // Rate limit token generation
    if (!secretAuthService.checkRateLimit(clientIp)) {
      logger.warn('Token generation rate limit exceeded', { ip: clientIp });
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded',
      });
    }

    const token = secretAuthService.generateToken();
    secretAuthService.storeToken(token, clientIp);

    logger.info('Token generated via API', { ip: clientIp, token: token.substring(0, 8) + '...' });

    return res.status(200).json({
      token,
      expiresIn: 3600,
      message: 'Use this token in Authorization header: Bearer <token>',
    });
  } catch (error) {
    logger.error('Token generation error', { error: (error as Error).message });
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate token',
    });
  }
};

/**
 * Route to get auth stats
 */
export const getAuthStatsRoute = (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = secretAuthService.getStats();
    logger.debug('Auth stats requested', stats);
    return res.status(200).json(stats);
  } catch (error) {
    logger.error('Stats endpoint error', { error: (error as Error).message });
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
};
