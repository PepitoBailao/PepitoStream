import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';

export type StreamEventType =
  | 'stream_started'
  | 'stream_ended'
  | 'quality_changed'
  | 'source_switched'
  | 'buffer_started'
  | 'buffer_ended'
  | 'error_occurred'
  | 'stream_paused'
  | 'stream_resumed';

@Injectable()
export class StreamEventsService {
  private logger = new Logger('StreamEventsService');
  private eventHistory = new Map<string, StreamEvent[]>();
  private eventSubscriptions = new Map<string, Set<string>>();

  constructor(private eventEmitter: EventEmitter2) {}

  emitStreamStarted(streamId: string, metadata: any): void {
    this.logEvent('stream_started', streamId, metadata);
    this.eventEmitter.emit('stream.started', {
      streamId,
      timestamp: new Date(),
      metadata,
    });
  }

  emitStreamEnded(streamId: string, duration: number): void {
    this.logEvent('stream_ended', streamId, { duration });
    this.eventEmitter.emit('stream.ended', {
      streamId,
      timestamp: new Date(),
      duration,
    });
  }

  emitQualityChanged(
    streamId: string,
    userId: string,
    quality: string,
  ): void {
    this.logEvent('quality_changed', streamId, { userId, quality });
    this.eventEmitter.emit('quality.changed', {
      streamId,
      userId,
      quality,
      timestamp: new Date(),
    });
  }

  emitSourceSwitched(streamId: string, source: string, reason: string): void {
    this.logEvent('source_switched', streamId, { source, reason });
    this.eventEmitter.emit('source.switched', {
      streamId,
      source,
      reason,
      timestamp: new Date(),
    });
  }

  emitBufferStarted(streamId: string, userId: string): void {
    this.logEvent('buffer_started', streamId, { userId });
    this.eventEmitter.emit('buffer.started', {
      streamId,
      userId,
      timestamp: new Date(),
    });
  }

  emitBufferEnded(streamId: string, userId: string, duration: number): void {
    this.logEvent('buffer_ended', streamId, { userId, duration });
    this.eventEmitter.emit('buffer.ended', {
      streamId,
      userId,
      duration,
      timestamp: new Date(),
    });
  }

  emitError(streamId: string, error: Error, context?: any): void {
    this.logEvent('error_occurred', streamId, { error: error.message, context });
    this.eventEmitter.emit('stream.error', {
      streamId,
      error: error.message,
      context,
      timestamp: new Date(),
    });
  }

  emitStreamPaused(streamId: string, userId: string, position: number): void {
    this.logEvent('stream_paused', streamId, { userId, position });
    this.eventEmitter.emit('stream.paused', {
      streamId,
      userId,
      position,
      timestamp: new Date(),
    });
  }

  emitStreamResumed(streamId: string, userId: string, position: number): void {
    this.logEvent('stream_resumed', streamId, { userId, position });
    this.eventEmitter.emit('stream.resumed', {
      streamId,
      userId,
      position,
      timestamp: new Date(),
    });
  }

  private logEvent(type: StreamEventType, streamId: string, data: any): void {
    if (!this.eventHistory.has(streamId)) {
      this.eventHistory.set(streamId, []);
    }

    const event: StreamEvent = {
      type,
      streamId,
      data,
      timestamp: new Date(),
    };

    const history = this.eventHistory.get(streamId);
    history.push(event);

    if (history.length > 1000) {
      history.shift();
    }

    this.logger.log(`📝 Event logged: ${type} on ${streamId}`);
  }

  getEventHistory(streamId: string, limit: number = 50): StreamEvent[] {
    const history = this.eventHistory.get(streamId) || [];
    return history.slice(-limit);
  }

  clearEventHistory(streamId: string): void {
    this.eventHistory.delete(streamId);
  }

  getEventStats(streamId: string): EventStats {
    const events = this.eventHistory.get(streamId) || [];
    const stats: EventStats = {
      totalEvents: events.length,
      eventCounts: {},
      lastEvent: events[events.length - 1] || null,
      firstEvent: events[0] || null,
    };

    events.forEach((event) => {
      stats.eventCounts[event.type] =
        (stats.eventCounts[event.type] || 0) + 1;
    });

    return stats;
  }

  subscribe(streamId: string, userId: string): void {
    if (!this.eventSubscriptions.has(streamId)) {
      this.eventSubscriptions.set(streamId, new Set());
    }
    this.eventSubscriptions.get(streamId).add(userId);
    this.logger.log(`🔔 ${userId} subscribed to ${streamId} events`);
  }

  unsubscribe(streamId: string, userId: string): void {
    const subscribers = this.eventSubscriptions.get(streamId);
    if (subscribers) {
      subscribers.delete(userId);
      if (subscribers.size === 0) {
        this.eventSubscriptions.delete(streamId);
      }
    }
    this.logger.log(`🔕 ${userId} unsubscribed from ${streamId} events`);
  }

  getSubscribers(streamId: string): Set<string> {
    return this.eventSubscriptions.get(streamId) || new Set();
  }

  getSubscriptionCount(streamId: string): number {
    return this.eventSubscriptions.get(streamId)?.size || 0;
  }

  @Cron('0 */6 * * *')
  cleanupOldEvents(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000;

    this.eventHistory.forEach((events, streamId) => {
      const filtered = events.filter(
        (e) => now.getTime() - e.timestamp.getTime() < maxAge,
      );
      if (filtered.length > 0) {
        this.eventHistory.set(streamId, filtered);
      } else {
        this.eventHistory.delete(streamId);
      }
    });

    this.logger.log('🧹 Cleaned up old events');
  }

  @Cron('0 0 * * *')
  generateDailyReport(): void {
    const report = {
      timestamp: new Date(),
      totalStreams: this.eventHistory.size,
      totalEvents: Array.from(this.eventHistory.values()).reduce(
        (sum, events) => sum + events.length,
        0,
      ),
      streamIds: Array.from(this.eventHistory.keys()),
    };

    this.logger.log(`📊 Daily Report: ${JSON.stringify(report)}`);
  }
}

export interface StreamEvent {
  type: StreamEventType;
  streamId: string;
  data: any;
  timestamp: Date;
}

export interface EventStats {
  totalEvents: number;
  eventCounts: Record<StreamEventType, number>;
  lastEvent: StreamEvent | null;
  firstEvent: StreamEvent | null;
}
