import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { StreamService } from '../stream/stream.service';
import { AuthService } from '../auth/auth.service';

interface ClientInfo {
  userId: string;
  username: string;
  streamId?: string;
  quality: string;
  connectedAt: Date;
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/api/streams',
  transports: ['websocket', 'polling'],
})
@Injectable()
export class StreamingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger = new Logger('StreamingGateway');
  private clients = new Map<string, ClientInfo>();
  private streamWatchers = new Map<string, Set<string>>();
  private activeStreams = new Map<string, StreamStatus>();

  constructor(
    private streamService: StreamService,
    private authService: AuthService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('✅ WebSocket Gateway initialized');
    
    setInterval(() => {
      this.server.emit('heartbeat', {
        timestamp: new Date(),
        activeClients: this.clients.size,
        activeStreams: this.activeStreams.size,
      });
    }, 30000);
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`🔌 Client connected: ${client.id}`);
    
    const token = client.handshake.auth.token;
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const user = this.authService.validateToken(token);
      const clientInfo: ClientInfo = {
        userId: user.id,
        username: user.username,
        quality: client.handshake.query.quality as string || '720p',
        connectedAt: new Date(),
      };

      this.clients.set(client.id, clientInfo);
      
      this.server.emit('user_joined', {
        userId: user.id,
        username: user.username,
        totalOnline: this.clients.size,
      });

    } catch (error) {
      this.logger.error(`Authentication failed for ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.clients.get(client.id);
    if (!clientInfo) return;

    this.logger.log(`❌ Client disconnected: ${client.id}`);

    if (clientInfo.streamId) {
      const watchers = this.streamWatchers.get(clientInfo.streamId);
      if (watchers) {
        watchers.delete(client.id);
        if (watchers.size === 0) {
          this.streamWatchers.delete(clientInfo.streamId);
          this.activeStreams.delete(clientInfo.streamId);
        } else {
          this.updateStreamStatus(clientInfo.streamId);
        }
      }
    }

    this.clients.delete(client.id);

    this.server.emit('user_left', {
      userId: clientInfo.userId,
      username: clientInfo.username,
      totalOnline: this.clients.size,
    });
  }

  @SubscribeMessage('watch_stream')
  handleWatchStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { streamId: string; quality: string },
  ) {
    const clientInfo = this.clients.get(client.id);
    if (!clientInfo) return;

    const { streamId, quality } = payload;
    clientInfo.streamId = streamId;
    clientInfo.quality = quality;

    if (!this.streamWatchers.has(streamId)) {
      this.streamWatchers.set(streamId, new Set());
    }
    this.streamWatchers.get(streamId).add(client.id);

    client.join(`stream:${streamId}`);

    const streamStatus = this.getOrCreateStreamStatus(streamId);
    client.emit('stream_status', streamStatus);

    this.server.to(`stream:${streamId}`).emit('watcher_joined', {
      userId: clientInfo.userId,
      username: clientInfo.username,
      quality,
      totalWatchers: this.streamWatchers.get(streamId).size,
    });

    this.logger.log(
      `👁️ User ${clientInfo.username} watching ${streamId} at ${quality}`,
    );
  }

  @SubscribeMessage('stop_watching')
  handleStopWatching(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { streamId: string },
  ) {
    const clientInfo = this.clients.get(client.id);
    if (!clientInfo) return;

    const { streamId } = payload;

    const watchers = this.streamWatchers.get(streamId);
    if (watchers) {
      watchers.delete(client.id);
      if (watchers.size === 0) {
        this.streamWatchers.delete(streamId);
        this.activeStreams.delete(streamId);
      }
    }

    client.leave(`stream:${streamId}`);
    clientInfo.streamId = null;

    this.server.to(`stream:${streamId}`).emit('watcher_left', {
      userId: clientInfo.userId,
      username: clientInfo.username,
      totalWatchers: watchers?.size || 0,
    });

    this.logger.log(`✋ User ${clientInfo.username} stopped watching ${streamId}`);
  }

  @SubscribeMessage('update_quality')
  handleUpdateQuality(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { streamId: string; quality: string },
  ) {
    const clientInfo = this.clients.get(client.id);
    if (!clientInfo) return;

    const { streamId, quality } = payload;

    const validQualities = ['480p', '720p', '1080p', '4K'];
    if (!validQualities.includes(quality)) {
      client.emit('error', { message: 'Invalid quality' });
      return;
    }

    clientInfo.quality = quality;

    this.server.to(`stream:${streamId}`).emit('watcher_quality_changed', {
      userId: clientInfo.userId,
      newQuality: quality,
    });

    this.logger.log(`📺 User ${clientInfo.username} changed quality to ${quality}`);
  }

  @SubscribeMessage('stream_event')
  handleStreamEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: StreamEventPayload,
  ) {
    const clientInfo = this.clients.get(client.id);
    if (!clientInfo) return;

    const { streamId, event, data } = payload;

    this.server.to(`stream:${streamId}`).emit('stream_event', {
      userId: clientInfo.userId,
      username: clientInfo.username,
      event,
      data,
      timestamp: new Date(),
    });

    this.logger.log(
      `📢 Event ${event} on stream ${streamId}: ${JSON.stringify(data)}`,
    );
  }

  @SubscribeMessage('get_stream_stats')
  handleGetStreamStats(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { streamId: string },
  ): void {
    const { streamId } = payload;
    const watchers = this.streamWatchers.get(streamId) || new Set();
    const stats = this.calculateStreamStats(streamId, watchers);

    client.emit('stream_stats', stats);
  }

  @SubscribeMessage('send_message')
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { streamId: string; message: string },
  ) {
    const clientInfo = this.clients.get(client.id);
    if (!clientInfo) return;

    const { streamId, message } = payload;

    if (message.length > 500) {
      client.emit('error', { message: 'Message too long' });
      return;
    }

    this.server.to(`stream:${streamId}`).emit('chat_message', {
      userId: clientInfo.userId,
      username: clientInfo.username,
      message,
      timestamp: new Date(),
    });

    this.logger.log(`💬 Chat on ${streamId}: ${clientInfo.username}`);
  }

  private getOrCreateStreamStatus(streamId: string): StreamStatus {
    if (!this.activeStreams.has(streamId)) {
      this.activeStreams.set(streamId, {
        streamId,
        status: 'active',
        startTime: new Date(),
        totalWatchers: 0,
        avgBitrate: 0,
        avgLatency: 0,
      });
    }
    return this.activeStreams.get(streamId);
  }

  private updateStreamStatus(streamId: string): void {
    const watchers = this.streamWatchers.get(streamId);
    const status = this.activeStreams.get(streamId);

    if (status && watchers) {
      status.totalWatchers = watchers.size;
      this.server.to(`stream:${streamId}`).emit('stream_status', status);
    }
  }

  private calculateStreamStats(
    streamId: string,
    watchers: Set<string>,
  ): StreamStatistics {
    const qualityCounts = new Map<string, number>();
    let totalBitrate = 0;
    let totalLatency = 0;

    watchers.forEach((clientId) => {
      const client = this.clients.get(clientId);
      if (client) {
        const count = qualityCounts.get(client.quality) || 0;
        qualityCounts.set(client.quality, count + 1);
        totalBitrate += this.getQualityBitrate(client.quality);
        totalLatency += 50;
      }
    });

    return {
      streamId,
      totalWatchers: watchers.size,
      qualityDistribution: Object.fromEntries(qualityCounts),
      avgBitrate: watchers.size > 0 ? totalBitrate / watchers.size : 0,
      avgLatency: watchers.size > 0 ? totalLatency / watchers.size : 0,
      peakWatchers: this.getPeakWatchers(streamId),
      duration: this.getStreamDuration(streamId),
    };
  }

  private getQualityBitrate(quality: string): number {
    const bitrates: Record<string, number> = {
      '480p': 1500,
      '720p': 4500,
      '1080p': 8000,
      '4K': 15000,
    };
    return bitrates[quality] || 4500;
  }

  private getPeakWatchers(streamId: string): number {
    return this.streamWatchers.get(streamId)?.size || 0;
  }

  private getStreamDuration(streamId: string): number {
    const status = this.activeStreams.get(streamId);
    if (!status) return 0;
    return Math.floor(
      (new Date().getTime() - status.startTime.getTime()) / 1000,
    );
  }

  broadcastStreamUpdate(streamId: string, update: any): void {
    this.server.to(`stream:${streamId}`).emit('stream_update', update);
  }

  broadcastSourceChange(streamId: string, source: any): void {
    this.server
      .to(`stream:${streamId}`)
      .emit('source_changed', { source, timestamp: new Date() });
  }

  broadcastNotification(userId: string, notification: any): void {
    const clientIds = Array.from(this.clients.entries())
      .filter(([_, info]) => info.userId === userId)
      .map(([id]) => id);

    clientIds.forEach((clientId) => {
      this.server.to(clientId).emit('notification', notification);
    });
  }

  notifyAllUsers(message: any): void {
    this.server.emit('broadcast', message);
  }

  getActiveClients(): number {
    return this.clients.size;
  }

  getStreamWatchers(streamId: string): number {
    return this.streamWatchers.get(streamId)?.size || 0;
  }

  getAllActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys());
  }

  getClientInfo(clientId: string): ClientInfo | undefined {
    return this.clients.get(clientId);
  }
}

interface StreamEventPayload {
  streamId: string;
  event: string;
  data: any;
}

interface StreamStatus {
  streamId: string;
  status: 'active' | 'inactive';
  startTime: Date;
  totalWatchers: number;
  avgBitrate: number;
  avgLatency: number;
}

interface StreamStatistics {
  streamId: string;
  totalWatchers: number;
  qualityDistribution: Record<string, number>;
  avgBitrate: number;
  avgLatency: number;
  peakWatchers: number;
  duration: number;
}
