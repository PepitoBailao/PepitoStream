import { Module, Global } from '@nestjs/common';
import { CacheStrategies } from './cache.strategies';
import { DistributedCacheService } from './distributed-cache.service';
import { CacheCompressionService } from './cache-compression.service';
import { CacheController } from './cache.controller';

@Global()
@Module({
  providers: [
    {
      provide: CacheStrategies,
      useFactory: () =>
        new CacheStrategies({
          maxSize: 100 * 1024 * 1024, // 100MB
          defaultTtl: 3600000, // 1 hour
          maxEntries: 10000,
          strategy: 'LRU',
        }),
    },
    {
      provide: DistributedCacheService,
      useFactory: () =>
        new DistributedCacheService({
          type: 'hybrid',
          redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
            keyPrefix: 'pepito:',
          },
          memcached: {
            servers: (process.env.MEMCACHED_SERVERS || 'localhost:11211').split(
              ',',
            ),
          },
          syncInterval: 30000, // 30 seconds
        }),
    },
    {
      provide: CacheCompressionService,
      useFactory: () =>
        new CacheCompressionService({
          enabled: true,
          algorithm: 'brotli',
          level: 6,
          threshold: 1024, // 1KB
        }),
    },
  ],
  controllers: [CacheController],
  exports: [CacheStrategies, DistributedCacheService, CacheCompressionService],
})
export class CacheModule {}
