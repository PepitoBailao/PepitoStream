/**
 * Main NestJS Application Module
 * Configure tous les services, controllers et middlewares
 */

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { StreamController } from './controllers/stream.controller';
import { HealthController } from './controllers/health.controller';

// Services
import { CacheService } from '../cache/cacheService';
import { SearchService } from '../search/searchService';
import { QualityService } from '../quality/qualityService';
import { AudioService } from '../audio/audioService';
import { StreamService } from '../stream/streamService';

// Middleware
import {
  RateLimitMiddleware,
  LoggingMiddleware,
  ValidationMiddleware,
  CacheBypassMiddleware,
  ErrorHandlerMiddleware,
} from './middleware/request.middleware';

// Interceptors
import {
  TimeoutInterceptor,
  PerformanceInterceptor,
  CompressionInterceptor,
} from './middleware/request.middleware';

import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [StreamController, HealthController],
  providers: [
    CacheService,
    SearchService,
    QualityService,
    AudioService,
    StreamService,

    // Interceptors globaux
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CompressionInterceptor,
    },

    // Exception filters
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
  exports: [CacheService, SearchService, QualityService, AudioService, StreamService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        LoggingMiddleware,
        ValidationMiddleware,
        CacheBypassMiddleware,
        RateLimitMiddleware,
        ErrorHandlerMiddleware,
      )
      .forRoutes('*');
  }
}
