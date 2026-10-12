import { Module } from '@nestjs/common';
import { RateLimiterService } from './rate-limiter.service';
import { JWTStrategy } from './jwt.strategy';
import { EncryptionService } from './encryption.service';
import { RedisService } from '../cache/redis.service';
import { Logger } from 'pino';

const logger = require('pino')();

@Module({
  providers: [
    RateLimiterService,
    JWTStrategy,
    EncryptionService,
    {
      provide: 'LOGGER',
      useValue: logger,
    },
    {
      provide: RedisService,
      useValue: new RedisService(logger),
    },
  ],
  exports: [RateLimiterService, JWTStrategy, EncryptionService],
})
export class SecurityModule {}
