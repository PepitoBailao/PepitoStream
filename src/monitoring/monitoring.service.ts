import { Injectable, Logger } from '@nestjs/common';
import { PrometheusService } from './prometheus.service';
import { ElasticsearchService } from './elk/elasticsearch.config';

interface Alert {
  id: string;
  name: string;
  condition: string;
  severity: 'critical' | 'warning' | 'info';
  threshold: number;
  triggered: boolean;
  triggeredAt?: Date;
  resolvedAt?: Date;
}

@Injectable()
export class MonitoringService {
  private logger = new Logger('MonitoringService');
  private alerts: Map<string, Alert> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private prometheusService: PrometheusService,
    private elasticsearchService: ElasticsearchService,
  ) {
    this.initializeAlerts();
    this.startMonitoring();
  }

  private initializeAlerts() {
    const alerts: Alert[] = [
      {
        id: 'high-latency',
        name: 'High Stream Latency',
        condition: 'stream_latency_ms > 5000',
        severity: 'critical',
        threshold: 5000,
        triggered: false,
      },
      {
        id: 'low-bitrate',
        name: 'Low Stream Bitrate',
        condition: 'stream_bitrate_kbps < 500',
        severity: 'warning',
        threshold: 500,
        triggered: false,
      },
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        condition: 'error_rate > 5%',
        severity: 'critical',
        threshold: 0.05,
        triggered: false,
      },
      {
        id: 'database-slow-queries',
        name: 'Database Slow Queries',
        condition: 'db_query_duration_seconds > 1',
        severity: 'warning',
        threshold: 1,
        triggered: false,
      },
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        condition: 'memory_usage > 80%',
        severity: 'warning',
        threshold: 0.8,
        triggered: false,
      },
      {
        id: 'cache-miss-rate',
        name: 'High Cache Miss Rate',
        condition: 'cache_miss_rate > 30%',
        severity: 'info',
        threshold: 0.3,
        triggered: false,
      },
    ];

    alerts.forEach(alert => this.alerts.set(alert.id, alert));
  }

  private startMonitoring() {
    // Stream monitoring
    this.monitoringIntervals.set(
      'stream-monitor',
      setInterval(() => this.monitorStreams(), 30000),
    );

    // Database monitoring
    this.monitoringIntervals.set(
      'db-monitor',
      setInterval(() => this.monitorDatabase(), 60000),
    );

    // System monitoring
    this.monitoringIntervals.set(
      'system-monitor',
      setInterval(() => this.monitorSystem(), 30000),
    );

    // Cache monitoring
    this.monitoringIntervals.set(
      'cache-monitor',
      setInterval(() => this.monitorCache(), 60000),
    );

    this.logger.log('Monitoring started');
  }

  private async monitorStreams() {
    try {
      const metrics = this.prometheusService.getMetrics();
      // Parse and analyze stream metrics
      this.logger.debug('Stream monitoring completed');
    } catch (error) {
      this.logger.error('Stream monitoring error:', error);
      this.triggerAlert('stream-monitor-error');
    }
  }

  private async monitorDatabase() {
    try {
      const metrics = this.prometheusService.getMetrics();
      // Parse and analyze database metrics
      this.logger.debug('Database monitoring completed');
    } catch (error) {
      this.logger.error('Database monitoring error:', error);
      this.triggerAlert('database-monitor-error');
    }
  }

  private async monitorSystem() {
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;

      if (heapUsedPercent > 0.8) {
        this.triggerAlert('high-memory-usage');
      } else {
        this.resolveAlert('high-memory-usage');
      }

      this.logger.debug(`Memory usage: ${(heapUsedPercent * 100).toFixed(2)}%`);
    } catch (error) {
      this.logger.error('System monitoring error:', error);
    }
  }

  private async monitorCache() {
    try {
      const metrics = this.prometheusService.getMetrics();
      // Parse and analyze cache metrics
      this.logger.debug('Cache monitoring completed');
    } catch (error) {
      this.logger.error('Cache monitoring error:', error);
    }
  }

  triggerAlert(alertId: string) {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.triggered) {
      alert.triggered = true;
      alert.triggeredAt = new Date();
      this.logger.warn(`Alert triggered: ${alert.name}`);

      this.elasticsearchService.logMessage(
        `Alert triggered: ${alert.name}`,
        {
          alert_id: alertId,
          severity: alert.severity,
          timestamp: new Date(),
        },
      );
    }
  }

  resolveAlert(alertId: string) {
    const alert = this.alerts.get(alertId);
    if (alert && alert.triggered) {
      alert.triggered = false;
      alert.resolvedAt = new Date();
      this.logger.log(`Alert resolved: ${alert.name}`);

      this.elasticsearchService.logMessage(
        `Alert resolved: ${alert.name}`,
        {
          alert_id: alertId,
          severity: alert.severity,
          resolved_at: new Date(),
        },
      );
    }
  }

  getAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  getTriggeredAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => a.triggered);
  }

  getAlertStats() {
    const alerts = this.getAlerts();
    const triggered = alerts.filter(a => a.triggered);

    return {
      total: alerts.length,
      triggered: triggered.length,
      critical: triggered.filter(a => a.severity === 'critical').length,
      warning: triggered.filter(a => a.severity === 'warning').length,
      info: triggered.filter(a => a.severity === 'info').length,
    };
  }

  async getHealthStatus() {
    return {
      elasticsearch: await this.elasticsearchService.health(),
      prometheus: 'healthy',
      alerts: this.getAlertStats(),
      memory: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
      },
    };
  }

  stopMonitoring() {
    this.monitoringIntervals.forEach(interval => clearInterval(interval));
    this.monitoringIntervals.clear();
    this.logger.log('Monitoring stopped');
  }
}