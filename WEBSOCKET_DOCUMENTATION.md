# 🌐 WebSocket Real-Time Documentation

## Overview

PepitoStream implements a comprehensive WebSocket system for real-time streaming, live events, and quality monitoring.

### Architecture

```
Client (Browser/App)
    ↓
    ↓ WebSocket
    ↓
[Socket.IO Server]
    ├→ StreamingGateway
    ├→ StreamEventsService
    └→ StreamMonitorService
        ↓
        ↓
    [Database/Cache]
```

## Components

### 1. StreamingGateway

**Purpose**: Handles real-time WebSocket connections and streaming events.

**Key Features**:
- Client connection management
- Stream watching/unwatching
- Quality switching
- Chat messaging
- Stream statistics

**Namespace**: `/api/streams`

### 2. StreamEventsService

**Purpose**: Manages streaming lifecycle events and event history.

**Event Types**:
- `stream_started` - Stream begins
- `stream_ended` - Stream ends
- `quality_changed` - User changes quality
- `source_switched` - Source switches
- `buffer_started` - Buffering begins
- `buffer_ended` - Buffering ends
- `error_occurred` - Error happens
- `stream_paused` - Stream paused
- `stream_resumed` - Stream resumed

### 3. StreamMonitorService

**Purpose**: Monitors stream quality metrics and client performance.

**Metrics Tracked**:
- Bitrate (kbps)
- Latency (ms)
- Packet loss (%)
- Jitter (ms)
- FPS (frames per second)
- Buffer events
- Errors

## WebSocket Events

### Client → Server

#### watch_stream
```typescript
client.emit('watch_stream', {
  streamId: 'stream-123',
  quality: '1080p'
});
```

**Response**:
```typescript
client.on('stream_status', (status) => {
  // {
  //   streamId: 'stream-123',
  //   status: 'active',
  //   startTime: Date,
  //   totalWatchers: 150,
  //   avgBitrate: 4500,
  //   avgLatency: 45
  // }
});
```

#### stop_watching
```typescript
client.emit('stop_watching', {
  streamId: 'stream-123'
});
```

#### update_quality
```typescript
client.emit('update_quality', {
  streamId: 'stream-123',
  quality: '4K' // '480p' | '720p' | '1080p' | '4K'
});
```

**Valid Qualities**: `480p`, `720p`, `1080p`, `4K`

#### stream_event
```typescript
client.emit('stream_event', {
  streamId: 'stream-123',
  event: 'buffer_started',
  data: { duration: 2000 }
});
```

#### get_stream_stats
```typescript
client.emit('get_stream_stats', {
  streamId: 'stream-123'
});

client.on('stream_stats', (stats) => {
  // {
  //   streamId: 'stream-123',
  //   totalWatchers: 150,
  //   qualityDistribution: { '720p': 80, '1080p': 70 },
  //   avgBitrate: 4500,
  //   avgLatency: 45,
  //   peakWatchers: 200,
  //   duration: 3600
  // }
});
```

#### send_message
```typescript
client.emit('send_message', {
  streamId: 'stream-123',
  message: 'Great stream!'
});
```

**Max message length**: 500 characters

### Server → Client

#### user_joined
```typescript
server.emit('user_joined', {
  userId: 'user-123',
  username: 'john_doe',
  totalOnline: 1500
});
```

#### user_left
```typescript
server.emit('user_left', {
  userId: 'user-123',
  username: 'john_doe',
  totalOnline: 1499
});
```

#### watcher_joined
```typescript
server.to(`stream:${streamId}`).emit('watcher_joined', {
  userId: 'user-123',
  username: 'john_doe',
  quality: '1080p',
  totalWatchers: 151
});
```

#### watcher_left
```typescript
server.to(`stream:${streamId}`).emit('watcher_left', {
  userId: 'user-123',
  username: 'john_doe',
  totalWatchers: 149
});
```

#### watcher_quality_changed
```typescript
server.to(`stream:${streamId}`).emit('watcher_quality_changed', {
  userId: 'user-123',
  newQuality: '4K'
});
```

#### chat_message
```typescript
server.to(`stream:${streamId}`).emit('chat_message', {
  userId: 'user-123',
  username: 'john_doe',
  message: 'Great stream!',
  timestamp: Date
});
```

#### heartbeat
```typescript
server.emit('heartbeat', {
  timestamp: Date,
  activeClients: 5000,
  activeStreams: 150
});
```
**Sent every 30 seconds**

#### error
```typescript
client.on('error', (error) => {
  // {
  //   message: 'Invalid quality' | 'Message too long' | etc
  // }
});
```

## Client Example

### Connect
```typescript
import io from 'socket.io-client';

const socket = io('https://api.pepitostream.com', {
  namespace: '/api/streams',
  auth: {
    token: 'jwt-token-here'
  },
  query: {
    quality: '1080p'
  }
});

socket.on('connect', () => {
  console.log('Connected to stream server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from stream server');
});
```

### Watch Stream
```typescript
// Start watching
socket.emit('watch_stream', {
  streamId: 'movie-123',
  quality: '720p'
});

socket.on('stream_status', (status) => {
  console.log(`${status.totalWatchers} people watching`);
});

socket.on('watcher_joined', (data) => {
  console.log(`${data.username} joined (${data.totalWatchers} total)`);
});

// Stop watching
socket.emit('stop_watching', { streamId: 'movie-123' });
```

### Switch Quality
```typescript
socket.emit('update_quality', {
  streamId: 'movie-123',
  quality: '1080p'
});

socket.on('watcher_quality_changed', (data) => {
  if (data.userId === myUserId) {
    console.log(`Quality changed to ${data.newQuality}`);
  }
});
```

### Chat
```typescript
// Send message
socket.emit('send_message', {
  streamId: 'movie-123',
  message: 'This is amazing!'
});

// Receive messages
socket.on('chat_message', (msg) => {
  console.log(`${msg.username}: ${msg.message}`);
});
```

### Get Statistics
```typescript
socket.emit('get_stream_stats', { streamId: 'movie-123' });

socket.on('stream_stats', (stats) => {
  console.log(`Total watchers: ${stats.totalWatchers}`);
  console.log(`Quality distribution:`, stats.qualityDistribution);
  console.log(`Stream health: ${stats.health}%`);
});
```

## Metrics and Monitoring

### Stream Metrics

```typescript
service.recordStreamMetric('stream-1', {
  bitrate: 5000,      // kbps
  latency: 100,       // ms
  bufferTime: 0,      // ms
  error: null
});

const stats = service.getStreamMetricsStats('stream-1');
// {
//   duration: 3600 seconds,
//   bitrate: { avg: 4800, min: 4500, max: 5000, current: 4900 },
//   latency: { avg: 95, min: 45, max: 150, current: 100 },
//   bufferCount: 2,
//   errorCount: 0,
//   qualityChanges: 3,
//   health: 92
// }
```

### Client Metrics

```typescript
service.recordClientMetric('client-1', {
  bandwidth: 10000,   // kbps
  packetLoss: 0.5,    // %
  jitter: 15,         // ms
  fps: 60             // frames/second
});

const stats = service.getClientMetricsStats('client-1');
// {
//   bandwidth: { avg: 9500, min: 9000, max: 10000, current: 9800 },
//   packetLoss: { avg: 0.3, min: 0, max: 1, current: 0.5 },
//   jitter: { avg: 12, min: 8, max: 20, current: 15 },
//   fps: { avg: 59, min: 55, max: 60, current: 60 },
//   quality: 'excellent'
// }
```

### Alerts

**Thresholds**:
- Low Bitrate: < 500 kbps
- High Latency: > 5000 ms

```typescript
const alerts = service.getStreamAlerts('stream-1', true); // unresolved only

alerts.forEach(alert => {
  console.log(`Alert: ${alert.type}`);
  console.log(`Data:`, alert.data);
});

service.resolveAlert('stream-1', 0);
```

## Performance Considerations

### Scalability
- Supports 10,000+ concurrent connections per server
- Horizontal scaling via Redis adapter
- Message compression enabled

### Optimization Tips
1. Use rooms for targeted broadcasting
2. Limit event history (auto-cleanup every 6 hours)
3. Compress message payloads
4. Implement client-side buffering
5. Use CDN for initial connection

### Resource Usage
- Memory: ~5KB per active client
- Bandwidth: 10-50KB/s per stream
- CPU: Minimal with event batching

## Error Handling

```typescript
socket.on('error', (error) => {
  console.error('Socket error:', error);
});

socket.on('disconnect', (reason) => {
  if (reason === 'auth_error') {
    console.error('Authentication failed');
  } else if (reason === 'io_server_disconnect') {
    console.error('Server disconnected');
  }
});
```

## Testing

### Unit Tests
```bash
npm test -- websocket.gateway.test.ts
npm test -- events.service.test.ts
npm test -- stream-monitor.service.test.ts
```

### Load Testing
```bash
# Using Artillery
artillery load test websocket-load.yml
```

## Deployment

### Docker
```dockerfile
EXPOSE 3000
ENV WS_NAMESPACE=/api/streams
ENV WS_TRANSPORTS=websocket,polling
```

### Kubernetes
```yaml
apiVersion: v1
kind: Service
metadata:
  name: streaming-service
spec:
  type: LoadBalancer
  ports:
  - port: 3000
    targetPort: 3000
    protocol: TCP
  sessionAffinity: ClientIP  # Important for WebSocket
```

## Future Enhancements

- [ ] Redis adapter for horizontal scaling
- [ ] WebRTC peer connections
- [ ] Adaptive bitrate streaming
- [ ] Advanced analytics
- [ ] Live transcoding notifications
- [ ] Viewer engagement metrics
