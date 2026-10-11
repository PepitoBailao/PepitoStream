/**
 * Request Middleware & Interceptors
 * Gère logging, rate limiting, validation, performance tracking
 */

import {
  Injectable,
  NestMiddleware,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  TooManyRequestsException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Observable } from 'rxjs';
import { tap, timeout, catchError } from 'rxjs/operators';

// ============= RATE LIMITING =============

interface ClientRateLimit {
  requestCount: number;
  resetTime: number;
  blocked: boolean;
  blockUntil?: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private clientLimits = new Map<string, ClientRateLimit>();
  
  private readonly REQUESTS_PER_MINUTE = 60;
  private readonly REQUESTS_PER_HOUR = 1000;
  private readonly BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes

  use(req: Request, res: Response, next: NextFunction) {
    const clientIp = this.getClientIp(req);
    const now = Date.now();

    // Récupérer ou créer le limite du client
    let limit = this.clientLimits.get(clientIp);
    
    if (!limit) {
      limit = {
        requestCount: 0,
        resetTime: now + 60000, // 1 minute
        blocked: false,
      };
      this.clientLimits.set(clientIp, limit);
    }

    // Vérifier si le client est bloqué
    if (limit.blocked && now < limit.blockUntil!) {
      throw new TooManyRequestsException({
        error: {
          code: 'RATE_LIMIT_BLOCKED',
          message: `Too many requests. Try again in ${Math.ceil((limit.blockUntil! - now) / 1000)} seconds`,
          resetTime: new Date(limit.blockUntil!),
        },
      });
    }

    // Réinitialiser si la fenêtre est expirée
    if (now > limit.resetTime) {
      limit.requestCount = 0;
      limit.resetTime = now + 60000;
      limit.blocked = false;
    }

    // Incrémenter le compteur
    limit.requestCount++;

    // Vérifier les limites
    if (limit.requestCount > this.REQUESTS_PER_MINUTE) {
      limit.blocked = true;
      limit.blockUntil = now + this.BLOCK_DURATION;
      
      throw new TooManyRequestsException({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          limit: this.REQUESTS_PER_MINUTE,
          window: '1 minute',
        },
      });
    }

    // Ajouter les headers de rate limit
    res.set('X-RateLimit-Limit', String(this.REQUESTS_PER_MINUTE));
    res.set('X-RateLimit-Remaining', String(this.REQUESTS_PER_MINUTE - limit.requestCount));
    res.set('X-RateLimit-Reset', String(Math.ceil(limit.resetTime / 1000)));

    next();
  }

  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }
}

// ============= LOGGING MIDDLEWARE =============

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, url, query, body } = req;

    // Enregistrer la réponse
    const originalSend = res.send;
    res.send = function (data) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      console.log({
        timestamp: new Date().toISOString(),
        method,
        url,
        query,
        statusCode,
        duration: `${duration}ms`,
        size: Buffer.byteLength(data || ''),
        clientIp: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      });

      return originalSend.call(this, data);
    };

    next();
  }
}

// ============= VALIDATION MIDDLEWARE =============

@Injectable()
export class ValidationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Valider les paramètres de requête
    if (req.method === 'GET') {
      const { query } = req;

      // Vérifier la taille des paramètres
      if (query.limit && parseInt(query.limit as string) > 1000) {
        throw new BadRequestException('Limit parameter too large (max: 1000)');
      }

      // Vérifier les valeurs valides
      if (query.type && !['fuzzy', 'exact', 'autocomplete'].includes(query.type as string)) {
        throw new BadRequestException('Invalid search type');
      }

      if (query.sortBy && !['popularity', 'rating', 'relevance', 'latency', 'seeders', 'score'].includes(query.sortBy as string)) {
        throw new BadRequestException('Invalid sort field');
      }
    }

    next();
  }
}

// ============= TIMEOUT INTERCEPTOR =============

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(30000), // 30 secondes de timeout
      catchError((error) => {
        if (error.name === 'TimeoutError') {
          throw new BadRequestException({
            error: {
              code: 'TIMEOUT',
              message: 'Request timeout after 30 seconds',
              timestamp: new Date(),
            },
          });
        }
        throw error;
      }),
    );
  }
}

// ============= PERFORMANCE INTERCEPTOR =============

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private metrics = {
    totalRequests: 0,
    totalDuration: 0,
    slowRequests: 0,
    errors: 0,
  };

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.metrics.totalRequests++;
        this.metrics.totalDuration += duration;

        // Marquer comme lent si > 1 seconde
        if (duration > 1000) {
          this.metrics.slowRequests++;
        }

        // Ajouter les headers de performance
        response.set('X-Response-Time', `${duration}ms`);
        response.set('X-Process-Time', `${duration}ms`);

        if (duration > 500) {
          console.warn(`Slow request: ${request.method} ${request.url} - ${duration}ms`);
        }
      }),
      catchError((error) => {
        this.metrics.errors++;
        const duration = Date.now() - startTime;
        console.error(`Request error: ${request.method} ${request.url} - ${duration}ms`, error);
        throw error;
      }),
    );
  }

  getMetrics() {
    return {
      ...this.metrics,
      avgDuration: this.metrics.totalRequests > 0 
        ? Math.round(this.metrics.totalDuration / this.metrics.totalRequests)
        : 0,
      errorRate: this.metrics.totalRequests > 0
        ? ((this.metrics.errors / this.metrics.totalRequests) * 100).toFixed(2) + '%'
        : '0%',
      slowRequestRate: this.metrics.totalRequests > 0
        ? ((this.metrics.slowRequests / this.metrics.totalRequests) * 100).toFixed(2) + '%'
        : '0%',
    };
  }
}

// ============= COMPRESSION INTERCEPTOR =============

@Injectable()
export class CompressionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();
    
    return next.handle().pipe(
      tap((data) => {
        // Ajouter les headers de compression
        response.set('Content-Encoding', 'gzip');
        response.set('Vary', 'Accept-Encoding');

        if (typeof data === 'object') {
          const size = Buffer.byteLength(JSON.stringify(data));
          response.set('X-Original-Size', String(size));
        }
      }),
    );
  }
}

// ============= CACHE BYPASS HEADER =============

@Injectable()
export class CacheBypassMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Permettre de bypass le cache avec un header
    if (req.headers['cache-control'] === 'no-cache') {
      res.locals.bypassCache = true;
    }

    // Ajouter des headers de cache
    const cacheControl = req.path.includes('search') || req.path.includes('autocomplete')
      ? 'public, max-age=3600' // 1h
      : 'public, max-age=1800'; // 30 min

    res.set('Cache-Control', cacheControl);

    next();
  }
}

// ============= ERROR HANDLER MIDDLEWARE =============

@Injectable()
export class ErrorHandlerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const originalJson = res.json;

    res.json = function (data) {
      // Si c'est une erreur, formater correctement
      if (res.statusCode >= 400) {
        const formattedError = {
          error: {
            code: data.error?.code || `ERROR_${res.statusCode}`,
            message: data.error?.message || data.message || 'An error occurred',
            details: data.error?.details || undefined,
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || Math.random().toString(36).substring(7),
            path: req.url,
            method: req.method,
          },
        };

        return originalJson.call(this, formattedError);
      }

      return originalJson.call(this, data);
    };

    next();
  }
}
