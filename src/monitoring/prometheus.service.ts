import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, register } from 'prom-client';

@Injectable()
export class PrometheusService {
  // HTTP Metrics
  httpRequestDuration: Histogram;
  httpRequestsTotal: Counter;
  httpErrors: Counter;
  httpStatusCodes: Counter;

  // Stream Metrics
  streamActive: Gauge;
  streamTotal: Counter;
  streamDuration: Histogram;
  streamBitrate: Gauge;
  streamLatency: Gauge;
  streamQualityChanges: Counter;
  streamBufferEvents: Counter;
  streamErrors: Counter;

  // User Metrics
  usersActive: Gauge;
  usersTotal: Counter;
  watchersActive: Gauge;
  watcherJoined: Counter;
  watcherLeft: Counter;
  userLoginTime: Histogram;

  // Database Metrics
  dbQueryDuration: Histogram;
  dbQueriesTotal: Counter;
  dbErrors: Counter;
  dbConnectionsActive: Gauge;
  dbConnectionsTotal: Gauge;

  // Cache Metrics
  cacheHits: Counter;
  cacheMisses: Counter;
  cacheSize: Gauge;
  cacheEvictions: Counter;

  // WebSocket Metrics
  wsConnections: Gauge;
  wsMessages: Counter;
  wsMessageDuration: Histogram;
  wsErrors: Counter;

  constructor() {
    // HTTP Metrics
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5],
    });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
    });

    this.httpErrors = new Counter({
      name: 'http_errors_total',
      help: 'Total HTTP errors',
      labelNames: ['method', 'route', 'status'],
    });

    this.httpStatusCodes = new Counter({
      name: 'http_status_codes_total',
      help: 'HTTP status codes',
      labelNames: ['status'],
    });

    // Stream Metrics
    this.streamActive = new Gauge({
      name: 'stream_active',
      help: 'Active streams',
      labelNames: ['type'],
    });

    this.streamTotal = new Counter({
      name: 'stream_total',
      help: 'Total streams created',
      labelNames: ['type'],
    });

    this.streamDuration = new Histogram({
      name: 'stream_duration_minutes',
      help: 'Stream duration in minutes',
      labelNames: ['quality'],
      buckets: [1, 5, 10, 30, 60, 120],
    });

    this.streamBitrate = new Gauge({
      name: 'stream_bitrate_kbps',
      help: 'Stream bitrate in kbps',
      labelNames: ['quality', 'stream_id'],
    });

    this.streamLatency = new Gauge({
      name: 'stream_latency_ms',
      help: 'Stream latency in milliseconds',
      labelNames: ['quality', 'stream_id'],
    });

    this.streamQualityChanges = new Counter({
      name: 'stream_quality_changes_total',
      help: 'Total stream quality changes',
      labelNames: ['from_quality', 'to_quality'],
    });

    this.streamBufferEvents = new Counter({
      name: 'stream_buffer_events_total',
      help: 'Total stream buffer events',
      labelNames: ['stream_id', 'reason'],
    });

    this.streamErrors = new Counter({
      name: 'stream_errors_total',
      help: 'Total stream errors',
      labelNames: ['stream_id', 'error_type'],
    });

    // User Metrics
    this.usersActive = new Gauge({
      name: 'users_active',
      help: 'Active users',
    });

    this.usersTotal = new Counter({
      name: 'users_total',
      help: 'Total users registered',
    });

    this.watchersActive = new Gauge({
      name: 'watchers_active',
      help: 'Active watchers',
      labelNames: ['stream_id'],
    });

    this.watcherJoined = new Counter({
      name: 'watcher_joined_total',
      help: 'Total watchers joined',
      labelNames: ['stream_id'],
    });

    this.watcherLeft = new Counter({
      name: 'watcher_left_total',
      help: 'Total watchers left',
      labelNames: ['stream_id'],
    });

    this.userLoginTime = new Histogram({
      name: 'user_login_duration_seconds',
      help: 'User login duration',
      buckets: [0.1, 0.5, 1, 2, 5],
    });

    // Database Metrics
    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Database query duration',
      labelNames: ['query_type', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1],
    });

    this.dbQueriesTotal = new Counter({
      name: 'db_queries_total',
      help: 'Total database queries',
      labelNames: ['query_type', 'table'],
    });

    this.dbErrors = new Counter({
      name: 'db_errors_total',
      help: 'Total database errors',
      labelNames: ['query_type', 'error_type'],
    });

    this.dbConnectionsActive = new Gauge({
      name: 'db_connections_active',
      help: 'Active database connections',
      labelNames: ['database'],
    });

    this.dbConnectionsTotal = new Gauge({
      name: 'db_connections_total',
      help: 'Total database connections',
      labelNames: ['database'],
    });

    // Cache Metrics
    this.cacheHits = new Counter({
      name: 'cache_hits_total',
      help: 'Total cache hits',
      labelNames: ['cache_name'],
    });

    this.cacheMisses = new Counter({
      name: 'cache_misses_total',
      help: 'Total cache misses',
      labelNames: ['cache_name'],
    });

    this.cacheSize = new Gauge({
      name: 'cache_size_bytes',
      help: 'Cache size in bytes',
      labelNames: ['cache_name'],
    });

    this.cacheEvictions = new Counter({
      name: 'cache_evictions_total',
      help: 'Total cache evictions',
      labelNames: ['cache_name'],
    });

    // WebSocket Metrics
    this.wsConnections = new Gauge({
      name: 'websocket_connections',
      help: 'Active WebSocket connections',
      labelNames: ['event_type'],
    });

    this.wsMessages = new Counter({
      name: 'websocket_messages_total',
      help: 'Total WebSocket messages',
      labelNames: ['event_type'],
    });

    this.wsMessageDuration = new Histogram({
      name: 'websocket_message_duration_seconds',
      help: 'WebSocket message processing time',
      labelNames: ['event_type'],
      buckets: [0.01, 0.05, 0.1, 0.5],
    });

    this.wsErrors = new Counter({
      name: 'websocket_errors_total',
      help: 'Total WebSocket errors',
      labelNames: ['error_type'],
    });
  }

  recordHttpRequest(method: string, route: string, status: number, duration: number) {
    this.httpRequestsTotal.inc({ method, route, status });
    this.httpRequestDuration.observe({ method, route, status }, duration);
    this.httpStatusCodes.inc({ status });
  }

  recordHttpError(method: string, route: string, status: number) {
    this.httpErrors.inc({ method, route, status });
  }

  recordStreamActive(type: string, count: number) {
    this.streamActive.set({ type }, count);
  }

  recordStreamCreated(type: string) {
    this.streamTotal.inc({ type });
  }

  recordStreamDuration(quality: string, duration: number) {
    this.streamDuration.observe({ quality }, duration / 60);
  }

  recordStreamMetrics(streamId: string, quality: string, bitrate: number, latency: number) {
    this.streamBitrate.set({ quality, stream_id: streamId }, bitrate);
    this.streamLatency.set({ quality, stream_id: streamId }, latency);
  }

  recordQualityChange(fromQuality: string, toQuality: string) {
    this.streamQualityChanges.inc({ from_quality: fromQuality, to_quality: toQuality });
  }

  recordBufferEvent(streamId: string, reason: string) {
    this.streamBufferEvents.inc({ stream_id: streamId, reason });
  }

  recordStreamError(streamId: string, errorType: string) {
    this.streamErrors.inc({ stream_id: streamId, error_type: errorType });
  }

  recordActiveUsers(count: number) {
    this.usersActive.set(count);
  }

  recordUserRegistered() {
    this.usersTotal.inc();
  }

  recordActiveWatchers(streamId: string, count: number) {
    this.watchersActive.set({ stream_id: streamId }, count);
  }

  recordWatcherJoined(streamId: string) {
    this.watcherJoined.inc({ stream_id: streamId });
  }

  recordWatcherLeft(streamId: string) {
    this.watcherLeft.inc({ stream_id: streamId });
  }

  recordUserLogin(duration: number) {
    this.userLoginTime.observe(duration);
  }

  recordDbQuery(queryType: string, table: string, duration: number) {
    this.dbQueriesTotal.inc({ query_type: queryType, table });
    this.dbQueryDuration.observe({ query_type: queryType, table }, duration);
  }

  recordDbError(queryType: string, errorType: string) {
    this.dbErrors.inc({ query_type: queryType, error_type: errorType });
  }

  recordDbConnections(database: string, active: number, total: number) {
    this.dbConnectionsActive.set({ database }, active);
    this.dbConnectionsTotal.set({ database }, total);
  }

  recordCacheHit(cacheName: string) {
    this.cacheHits.inc({ cache_name: cacheName });
  }

  recordCacheMiss(cacheName: string) {
    this.cacheMisses.inc({ cache_name: cacheName });
  }

  recordCacheSize(cacheName: string, size: number) {
    this.cacheSize.set({ cache_name: cacheName }, size);
  }

  recordCacheEviction(cacheName: string) {
    this.cacheEvictions.inc({ cache_name: cacheName });
  }

  recordWebSocketConnection(eventType: string, count: number) {
    this.wsConnections.set({ event_type: eventType }, count);
  }

  recordWebSocketMessage(eventType: string, duration: number) {
    this.wsMessages.inc({ event_type: eventType });
    this.wsMessageDuration.observe({ event_type: eventType }, duration);
  }

  recordWebSocketError(errorType: string) {
    this.wsErrors.inc({ error_type: errorType });
  }

  getMetrics(): string {
    return register.metrics();
  }

  getMetricByName(name: string) {
    return register.getSingleMetricAsString(name);
  }
}