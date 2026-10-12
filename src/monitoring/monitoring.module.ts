import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { PrometheusService } from './prometheus.service';
import { ElasticsearchService } from './elk/elasticsearch.config';
import { MonitoringController } from './monitoring.controller';

@Module({
  providers: [PrometheusService, ElasticsearchService, MonitoringService],
  controllers: [MonitoringController],
  exports: [PrometheusService, ElasticsearchService, MonitoringService],
})
export class MonitoringModule {}
