import { Test, TestingModule } from '@nestjs/testing';
import { StreamEventsService, StreamEventType } from './events.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('StreamEventsService', () => {
  let service: StreamEventsService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamEventsService,
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<StreamEventsService>(StreamEventsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('emitStreamStarted', () => {
    it('should emit stream started event', () => {
      service.emitStreamStarted('stream-1', { title: 'Test Stream' });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'stream.started',
        expect.objectContaining({
          streamId: 'stream-1',
        }),
      );
    });
  });

  describe('emitStreamEnded', () => {
    it('should emit stream ended event', () => {
      service.emitStreamEnded('stream-1', 3600);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'stream.ended',
        expect.objectContaining({
          streamId: 'stream-1',
          duration: 3600,
        }),
      );
    });
  });

  describe('emitQualityChanged', () => {
    it('should emit quality changed event', () => {
      service.emitQualityChanged('stream-1', 'user-1', '1080p');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'quality.changed',
        expect.objectContaining({
          streamId: 'stream-1',
          userId: 'user-1',
          quality: '1080p',
        }),
      );
    });
  });

  describe('Event History', () => {
    it('should record event history', () => {
      service.emitStreamStarted('stream-1', {});
      service.emitQualityChanged('stream-1', 'user-1', '720p');
      service.emitStreamEnded('stream-1', 1800);

      const history = service.getEventHistory('stream-1');
      expect(history.length).toBe(3);
    });

    it('should limit history to specified limit', () => {
      for (let i = 0; i < 100; i++) {
        service.emitStreamStarted('stream-1', {});
      }

      const history = service.getEventHistory('stream-1', 10);
      expect(history.length).toBe(10);
    });

    it('should get event stats', () => {
      service.emitStreamStarted('stream-1', {});
      service.emitQualityChanged('stream-1', 'user-1', '720p');
      service.emitQualityChanged('stream-1', 'user-1', '1080p');

      const stats = service.getEventStats('stream-1');
      expect(stats.totalEvents).toBe(3);
      expect(stats.eventCounts['stream_started']).toBe(1);
      expect(stats.eventCounts['quality_changed']).toBe(2);
    });
  });

  describe('Subscriptions', () => {
    it('should subscribe user to stream', () => {
      service.subscribe('stream-1', 'user-1');

      const subscribers = service.getSubscribers('stream-1');
      expect(subscribers.has('user-1')).toBe(true);
    });

    it('should unsubscribe user from stream', () => {
      service.subscribe('stream-1', 'user-1');
      service.unsubscribe('stream-1', 'user-1');

      const subscribers = service.getSubscribers('stream-1');
      expect(subscribers.has('user-1')).toBe(false);
    });

    it('should get subscription count', () => {
      service.subscribe('stream-1', 'user-1');
      service.subscribe('stream-1', 'user-2');
      service.subscribe('stream-1', 'user-3');

      expect(service.getSubscriptionCount('stream-1')).toBe(3);
    });
  });
});
