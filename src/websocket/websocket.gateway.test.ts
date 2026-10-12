import { Test, TestingModule } from '@nestjs/testing';
import { StreamingGateway } from './websocket.gateway';
import { StreamEventsService } from './events.service';
import { StreamMonitorService } from './stream-monitor.service';
import { Socket, Server } from 'socket.io';

describe('StreamingGateway', () => {
  let gateway: StreamingGateway;
  let mockSocket: Partial<Socket>;
  let mockServer: Partial<Server>;

  beforeEach(async () => {
    mockServer = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    };

    mockSocket = {
      id: 'test-socket-id',
      handshake: {
        auth: { token: 'valid-token' },
        query: { quality: '720p' },
      },
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      disconnect: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamingGateway,
        {
          provide: 'STREAM_SERVICE',
          useValue: { getStream: jest.fn() },
        },
        {
          provide: 'AUTH_SERVICE',
          useValue: { validateToken: jest.fn().mockReturnValue({ id: 'user1', username: 'testuser' }) },
        },
      ],
    }).compile();

    gateway = module.get<StreamingGateway>(StreamingGateway);
    gateway.server = mockServer as Server;
  });

  describe('handleConnection', () => {
    it('should connect valid client', () => {
      gateway.handleConnection(mockSocket as Socket);
      expect(gateway.getActiveClients()).toBe(1);
    });

    it('should disconnect client without token', () => {
      mockSocket.handshake.auth = {};
      gateway.handleConnection(mockSocket as Socket);
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('watch_stream', () => {
    beforeEach(() => {
      gateway.handleConnection(mockSocket as Socket);
    });

    it('should add watcher to stream', () => {
      gateway.handleWatchStream(mockSocket as Socket, {
        streamId: 'stream-1',
        quality: '1080p',
      });

      expect(gateway.getStreamWatchers('stream-1')).toBe(1);
    });

    it('should emit stream_status on watch', () => {
      gateway.handleWatchStream(mockSocket as Socket, {
        streamId: 'stream-1',
        quality: '720p',
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'stream_status',
        expect.objectContaining({ streamId: 'stream-1' }),
      );
    });
  });

  describe('stop_watching', () => {
    beforeEach(() => {
      gateway.handleConnection(mockSocket as Socket);
      gateway.handleWatchStream(mockSocket as Socket, {
        streamId: 'stream-1',
        quality: '720p',
      });
    });

    it('should remove watcher from stream', () => {
      gateway.handleStopWatching(mockSocket as Socket, {
        streamId: 'stream-1',
      });

      expect(gateway.getStreamWatchers('stream-1')).toBe(0);
    });
  });

  describe('update_quality', () => {
    beforeEach(() => {
      gateway.handleConnection(mockSocket as Socket);
      gateway.handleWatchStream(mockSocket as Socket, {
        streamId: 'stream-1',
        quality: '720p',
      });
    });

    it('should update quality for valid values', () => {
      gateway.handleUpdateQuality(mockSocket as Socket, {
        streamId: 'stream-1',
        quality: '1080p',
      });

      const client = gateway.getClientInfo(mockSocket.id as string);
      expect(client.quality).toBe('1080p');
    });

    it('should reject invalid quality', () => {
      gateway.handleUpdateQuality(mockSocket as Socket, {
        streamId: 'stream-1',
        quality: 'invalid',
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ message: 'Invalid quality' }),
      );
    });
  });

  describe('send_message', () => {
    beforeEach(() => {
      gateway.handleConnection(mockSocket as Socket);
      gateway.handleWatchStream(mockSocket as Socket, {
        streamId: 'stream-1',
        quality: '720p',
      });
    });

    it('should send chat message', () => {
      gateway.handleChatMessage(mockSocket as Socket, {
        streamId: 'stream-1',
        message: 'Hello!',
      });

      expect(mockServer.to).toHaveBeenCalledWith('stream:stream-1');
    });

    it('should reject message over 500 chars', () => {
      const longMessage = 'a'.repeat(501);
      gateway.handleChatMessage(mockSocket as Socket, {
        streamId: 'stream-1',
        message: longMessage,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ message: 'Message too long' }),
      );
    });
  });

  describe('handleDisconnect', () => {
    it('should remove client on disconnect', () => {
      gateway.handleConnection(mockSocket as Socket);
      expect(gateway.getActiveClients()).toBe(1);

      gateway.handleDisconnect(mockSocket as Socket);
      expect(gateway.getActiveClients()).toBe(0);
    });
  });
});
