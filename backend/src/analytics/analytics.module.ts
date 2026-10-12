import { Module } from '@nestjs/common';
import { UserAnalyticsService } from './user-analytics.service';
import { ContentAnalyticsService } from './content-analytics.service';
import { AnalyticsController } from './analytics.controller';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { Logger } from 'pino';

const logger = require('pino')();

@Module({
  controllers: [AnalyticsController],
  providers: [
    UserAnalyticsService,
    ContentAnalyticsService,
    {
      provide: 'LOGGER',
      useValue: logger,
    },
    {
      provide: ElasticsearchService,
      useValue: new ElasticsearchService(logger),
    },
  ],
  exports: [UserAnalyticsService, ContentAnalyticsService],
})
export class AnalyticsModule {}
