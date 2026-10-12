import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class StreamMonitorService {
  private logger = new Logger('StreamMonitorService');
  private streamMetrics = new Map<string, StreamMetrics>();
  private clientMetrics = new Map<string, ClientMetrics>();
  private alerts = new Map<string, StreamAlert[]>();

  recordStreamMetric(
    streamId: string,
    metric: StreamMetricData,
  ): void {
    if (!this.streamMetrics.has(streamId)) {
      this.streamMetrics.set(streamId, {
        streamId,
        startTime: new Date(),
        bitrate: [],
        latency: [],
        bufferEvents: [],
        errors: [],
        qualityChanges: [],
      });
    }

    const metrics = this.streamMetrics.get(streamId);
    const timestamp = new Date();

    if (metric.bitrate) {
      metrics.bitrate.push({
        value: metric.bitrate,
        timestamp,
      });
      this.checkBitrateThreshold(streamId, metric.bitrate);
    }

    if (metric.latency) {
      metrics.latency.push({
        value: metric.latency,
        timestamp,
      });
      this.checkLatencyThreshold(streamId, metric.latency);
    }

    if (metrics.bitrate.length > 1000) metrics.bitrate.shift();
    if (metrics.latency.length > 1000) metrics.latency.shift();
  }

  recordClientMetric(clientId: string, metric: ClientMetricData): void {
    if (!this.clientMetrics.has(clientId)) {
      this.clientMetrics.set(clientId, {
        clientId,
        startTime: new Date(),
        bandwidth: [],
        packetLoss: [],
        jitter: [],
        fps: [],
      });
    }

    const metrics = this.clientMetrics.get(clientId);
    const timestamp = new Date();

    if (metric.bandwidth) {
      metrics.bandwidth.push({
        value: metric.bandwidth,
        timestamp,
      });
    }

    if (metric.packetLoss) {
      metrics.packetLoss.push({
        value: metric.packetLoss,
        timestamp,
      });
    }

    if (metric.jitter) {
      metrics.jitter.push({
        value: metric.jitter,
        timestamp,
      });
    }

    if (metric.fps) {
      metrics.fps.push({
        value: metric.fps,
        timestamp,
      });
    }

    const maxLength = 1000;
    if (metrics.bandwidth.length > maxLength) metrics.bandwidth.shift();
    if (metrics.packetLoss.length > maxLength) metrics.packetLoss.shift();
    if (metrics.jitter.length > maxLength) metrics.jitter.shift();
    if (metrics.fps.length > maxLength) metrics.fps.shift();
  }

  private checkBitrateThreshold(streamId: string, bitrate: number): void {
    const threshold = 500;

    if (bitrate < threshold) {
      this.createAlert(streamId, 'LOW_BITRATE', {
        current: bitrate,
        threshold,
        severity: 'warning',
      });
    }
  }

  private checkLatencyThreshold(streamId: string, latency: number): void {
    const threshold = 5000;

    if (latency > threshold) {
      this.createAlert(streamId, 'HIGH_LATENCY', {
        current: latency,
        threshold,
        severity: 'error',
      });
    }
  }

  private createAlert(
    streamId: string,
    type: string,
    data: any,
  ): void {
    if (!this.alerts.has(streamId)) {
      this.alerts.set(streamId, []);
    }

    const alert: StreamAlert = {
      type,
      data,
      timestamp: new Date(),
      resolved: false,
    };

    const streamAlerts = this.alerts.get(streamId);
    streamAlerts.push(alert);

    if (streamAlerts.length > 500) {
      streamAlerts.shift();
    }

    this.logger.warn(`⚠️ Alert on ${streamId}: ${type} - ${JSON.stringify(data)}`);
  }

  resolveAlert(streamId: string, alertIndex: number): void {
    const alerts = this.alerts.get(streamId);
    if (alerts && alerts[alertIndex]) {
      alerts[alertIndex].resolved = true;
      this.logger.log(`✅ Alert resolved on ${streamId}`);
    }
  }

  getStreamMetrics(streamId: string): StreamMetrics | null {
    return this.streamMetrics.get(streamId) || null;
  }

  getStreamMetricsStats(streamId: string): StreamMetricsStats {
    const metrics = this.streamMetrics.get(streamId);
    if (!metrics) {
      return this.getEmptyStats();
    }

    return {
      streamId,
      duration: this.calculateDuration(metrics.startTime),
      bitrate: this.calculateStats(metrics.bitrate),
      latency: this.calculateStats(metrics.latency),
      bufferCount: metrics.bufferEvents.length,
      errorCount: metrics.errors.length,
      qualityChanges: metrics.qualityChanges.length,
      health: this.calculateStreamHealth(streamId),
    };
  }

  getClientMetrics(clientId: string): ClientMetrics | null {
    return this.clientMetrics.get(clientId) || null;
  }

  getClientMetricsStats(clientId: string): ClientMetricsStats {
    const metrics = this.clientMetrics.get(clientId);
    if (!metrics) {
      return this.getEmptyClientStats();
    }

    return {
      clientId,
      duration: this.calculateDuration(metrics.startTime),
      bandwidth: this.calculateStats(metrics.bandwidth),
      packetLoss: this.calculateStats(metrics.packetLoss),
      jitter: this.calculateStats(metrics.jitter),
      fps: this.calculateStats(metrics.fps),
      quality: this.calculateClientQuality(clientId),
    };
  }

  getStreamAlerts(streamId: string, unresolved: boolean = false): StreamAlert[] {
    const alerts = this.alerts.get(streamId) || [];
    return unresolved ? alerts.filter((a) => !a.resolved) : alerts;
  }

  private calculateStats(
    measurements: Array<{ value: number; timestamp: Date }>,
  ): MetricStats {
    if (measurements.length === 0) {
      return { avg: 0, min: 0, max: 0, current: 0 };
    }

    const values = measurements.map((m) => m.value);
    return {
      avg: values.reduce((a, b) => a + b) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      current: values[values.length - 1],
    };
  }

  private calculateDuration(startTime: Date): number {
    return Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
  }

  private calculateStreamHealth(streamId: string): number {
    const metrics = this.streamMetrics.get(streamId);
    if (!metrics) return 100;

    let health = 100;
    const bitrateStats = this.calculateStats(metrics.bitrate);
    const latencyStats = this.calculateStats(metrics.latency);

    if (bitrateStats.avg < 500) health -= 30;
    else if (bitrateStats.avg < 1000) health -= 15;

    if (latencyStats.avg > 5000) health -= 20;
    else if (latencyStats.avg > 2000) health -= 10;

    health -= Math.min(metrics.bufferEvents.length * 5, 30);
    health -= Math.min(metrics.errors.length * 10, 40);

    return Math.max(health, 0);
  }

  private calculateClientQuality(clientId: string): string {
    const metrics = this.clientMetrics.get(clientId);
    if (!metrics) return 'unknown';

    const fpsStats = this.calculateStats(metrics.fps);
    const lossStats = this.calculateStats(metrics.packetLoss);

    if (fpsStats.avg < 20 || lossStats.avg > 5) return 'poor';
    if (fpsStats.avg < 30 || lossStats.avg > 2) return 'fair';
    if (fpsStats.avg >= 50 && lossStats.avg < 1) return 'excellent';
    return 'good';
  }

  private getEmptyStats(): StreamMetricsStats {
    return {
      streamId: '',
      duration: 0,
      bitrate: { avg: 0, min: 0, max: 0, current: 0 },
      latency: { avg: 0, min: 0, max: 0, current: 0 },
      bufferCount: 0,
      errorCount: 0,
      qualityChanges: 0,
      health: 100,
    };
  }

  private getEmptyClientStats(): ClientMetricsStats {
    return {
      clientId: '',
      duration: 0,
      bandwidth: { avg: 0, min: 0, max: 0, current: 0 },
      packetLoss: { avg: 0, min: 0, max: 0, current: 0 },
      jitter: { avg: 0, min: 0, max: 0, current: 0 },
      fps: { avg: 0, min: 0, max: 0, current: 0 },
      quality: 'unknown',
    };
  }

  @Cron('0 */6 * * *')
  cleanupOldMetrics(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000;

    this.streamMetrics.forEach((metrics, streamId) => {
      if (now.getTime() - metrics.startTime.getTime() > maxAge) {
        this.streamMetrics.delete(streamId);
      }
    });

    this.clientMetrics.forEach((metrics, clientId) => {
      if (now.getTime() - metrics.startTime.getTime() > maxAge) {
        this.clientMetrics.delete(clientId);
      }
    });

    this.logger.log('🧹 Cleaned up old metrics');
  }

  @Cron('0 0 * * *')
  generateMetricsReport(): void {
    const report = {
      timestamp: new Date(),
      totalStreams: this.streamMetrics.size,
      totalClients: this.clientMetrics.size,
      totalAlerts: Array.from(this.alerts.values()).reduce(
        (sum, alerts) => sum + alerts.length,
        0,
      ),
    };

    this.logger.log(`📊 Metrics Report: ${JSON.stringify(report)}`);
  }
}

export interface StreamMetricData {
  bitrate?: number;
  latency?: number;
  bufferTime?: number;
  error?: Error;
}

export interface ClientMetricData {
  bandwidth?: number;
  packetLoss?: number;
  jitter?: number;
  fps?: number;
}

export interface StreamMetrics {
  streamId: string;
  startTime: Date;
  bitrate: Array<{ value: number; timestamp: Date }>;
  latency: Array<{ value: number; timestamp: Date }>;
  bufferEvents: any[];
  errors: any[];
  qualityChanges: any[];
}

export interface ClientMetrics {
  clientId: string;
  startTime: Date;
  bandwidth: Array<{ value: number; timestamp: Date }>;
  packetLoss: Array<{ value: number; timestamp: Date }>;
  jitter: Array<{ value: number; timestamp: Date }>;
  fps: Array<{ value: number; timestamp: Date }>;
}

export interface StreamAlert {
  type: string;
  data: any;
  timestamp: Date;
  resolved: boolean;
}

export interface MetricStats {
  avg: number;
  min: number;
  max: number;
  current: number;
}

export interface StreamMetricsStats {
  streamId: string;
  duration: number;
  bitrate: MetricStats;
  latency: MetricStats;
  bufferCount: number;
  errorCount: number;
  qualityChanges: number;
  health: number;
}

export interface ClientMetricsStats {
  clientId: string;
  duration: number;
  bandwidth: MetricStats;
  packetLoss: MetricStats;
  jitter: MetricStats;
  fps: MetricStats;
  quality: string;
}
