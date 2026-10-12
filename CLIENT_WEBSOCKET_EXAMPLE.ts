import io, { Socket } from 'socket.io-client';

/**
 * PepitoStream WebSocket Client Example
 * Real-time streaming with quality switching and chat
 */

class StreamClient {
  private socket: Socket;
  private currentStreamId: string;
  private currentQuality: string = '720p';

  constructor(private serverUrl: string, private authToken: string) {
    this.socket = io(serverUrl, {
      namespace: '/api/streams',
      auth: { token: authToken },
      query: { quality: this.currentQuality },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });

    this.setupListeners();
  }

  private setupListeners(): void {
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Connected to stream server');
      this.emitHeartbeat();
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`❌ Disconnected: ${reason}`);
    });

    this.socket.on('error', (error) => {
      console.error('🔴 Socket error:', error);
    });

    // User events
    this.socket.on('user_joined', (data) => {
      console.log(`👤 ${data.username} joined (${data.totalOnline} online)`);
    });

    this.socket.on('user_left', (data) => {
      console.log(`👋 ${data.username} left (${data.totalOnline} online)`);
    });

    // Stream events
    this.socket.on('stream_status', (status) => {
      console.log(`📺 Stream Status:`, {
        watchers: status.totalWatchers,
        bitrate: `${status.avgBitrate} kbps`,
        latency: `${status.avgLatency} ms`,
        duration: `${Math.floor(status.duration / 60)} min`,
      });
    });

    this.socket.on('watcher_joined', (data) => {
      console.log(`👁️ ${data.username} watching (${data.totalWatchers} watchers)`);
    });

    this.socket.on('watcher_left', (data) => {
      console.log(`🚶 ${data.username} stopped watching`);
    });

    this.socket.on('watcher_quality_changed', (data) => {
      console.log(`📱 ${data.userId} changed quality to ${data.newQuality}`);
    });

    // Chat events
    this.socket.on('chat_message', (msg) => {
      console.log(`💬 ${msg.username}: ${msg.message}`);
    });

    // Statistics
    this.socket.on('stream_stats', (stats) => {
      console.log(`📊 Stream Statistics:`, {
        totalWatchers: stats.totalWatchers,
        qualities: stats.qualityDistribution,
        health: `${stats.health}%`,
      });
    });

    // Heartbeat
    this.socket.on('heartbeat', (data) => {
      console.log(`💓 Heartbeat: ${data.activeClients} clients, ${data.activeStreams} streams`);
    });
  }

  // Public methods
  public connect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.socket.connected) {
        resolve();
      } else {
        this.socket.once('connect', resolve);
        this.socket.connect();
      }
    });
  }

  public disconnect(): void {
    this.socket.disconnect();
  }

  public watchStream(streamId: string, quality: string = '720p'): void {
    this.currentStreamId = streamId;
    this.currentQuality = quality;

    this.socket.emit('watch_stream', {
      streamId,
      quality,
    });

    console.log(`👁️ Watching ${streamId} at ${quality}`);
  }

  public stopWatching(): void {
    if (!this.currentStreamId) return;

    this.socket.emit('stop_watching', {
      streamId: this.currentStreamId,
    });

    console.log(`✋ Stopped watching ${this.currentStreamId}`);
    this.currentStreamId = null;
  }

  public changeQuality(quality: string): void {
    if (!this.currentStreamId) {
      console.error('Not watching a stream');
      return;
    }

    const validQualities = ['480p', '720p', '1080p', '4K'];
    if (!validQualities.includes(quality)) {
      console.error(`Invalid quality: ${quality}`);
      return;
    }

    this.socket.emit('update_quality', {
      streamId: this.currentStreamId,
      quality,
    });

    this.currentQuality = quality;
    console.log(`📱 Quality changed to ${quality}`);
  }

  public sendMessage(message: string): void {
    if (!this.currentStreamId) {
      console.error('Not watching a stream');
      return;
    }

    if (message.length > 500) {
      console.error('Message too long (max 500 chars)');
      return;
    }

    this.socket.emit('send_message', {
      streamId: this.currentStreamId,
      message,
    });

    console.log(`📨 Message sent: ${message}`);
  }

  public getStreamStats(): void {
    if (!this.currentStreamId) {
      console.error('Not watching a stream');
      return;
    }

    this.socket.emit('get_stream_stats', {
      streamId: this.currentStreamId,
    });
  }

  public reportStreamEvent(
    event: string,
    data: any,
  ): void {
    if (!this.currentStreamId) {
      console.error('Not watching a stream');
      return;
    }

    this.socket.emit('stream_event', {
      streamId: this.currentStreamId,
      event,
      data,
    });

    console.log(`📢 Event reported: ${event}`);
  }

  public getActiveClients(): number {
    // This would need to be exposed via a REST endpoint
    return 0;
  }

  private emitHeartbeat(): void {
    setInterval(() => {
      if (this.socket.connected) {
        this.socket.emit('ping');
      }
    }, 30000);
  }
}

// Usage Example
async function main() {
  const client = new StreamClient(
    'https://api.pepitostream.com',
    'your-jwt-token-here'
  );

  try {
    // Connect to server
    await client.connect();
    console.log('🚀 Connected to PepitoStream');

    // Watch a stream
    client.watchStream('movie-123', '1080p');

    // Simulate quality change after 10 seconds
    setTimeout(() => {
      client.changeQuality('4K');
    }, 10000);

    // Send chat message
    setTimeout(() => {
      client.sendMessage('Amazing stream! 🎬');
    }, 5000);

    // Get statistics
    setTimeout(() => {
      client.getStreamStats();
    }, 15000);

    // Report events
    client.reportStreamEvent('buffer_started', { duration: 2000 });
    client.reportStreamEvent('buffer_ended', { duration: 2000 });

    // Stop watching after 60 seconds
    setTimeout(() => {
      client.stopWatching();
    }, 60000);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Export for use in other modules
export default StreamClient;
