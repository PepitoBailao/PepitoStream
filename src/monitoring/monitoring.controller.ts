import { Controller, Get } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { PrometheusService } from './prometheus.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(
    private monitoringService: MonitoringService,
    private prometheusService: PrometheusService,
  ) {}

  @Get('/health')
  async health() {
    return this.monitoringService.getHealthStatus();
  }

  @Get('/alerts')
  getAlerts() {
    return this.monitoringService.getAlerts();
  }

  @Get('/alerts/triggered')
  getTriggeredAlerts() {
    return this.monitoringService.getTriggeredAlerts();
  }

  @Get('/alerts/stats')
  getAlertStats() {
    return this.monitoringService.getAlertStats();
  }

  @Get('/metrics')
  getMetrics() {
    return {
      metrics: this.prometheusService.getMetrics(),
      timestamp: new Date(),
    };
  }

  @Get('/metrics/prometheus')
  getPrometheusMetrics() {
    return this.prometheusService.getMetrics();
  }
}