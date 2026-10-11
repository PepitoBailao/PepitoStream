import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { logger } from './utils/logger';
import { secretAuthMiddleware, generateTokenRoute, getAuthStatsRoute } from './middleware/secretAuth';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logging middleware
app.use((req, res, next) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
});

// Public routes (no auth required)
app.post('/api/auth/generate', generateTokenRoute);
app.get('/api/auth/stats', getAuthStatsRoute);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected routes (require secret token)
app.use('/api/stream', secretAuthMiddleware);
app.use('/api/search', secretAuthMiddleware);

// Placeholder routes (will be connected to actual services)
app.post('/api/stream/search', (req, res) => {
  logger.info('Search request', { body: req.body });
  res.json({ message: 'Search endpoint - connect to searchService' });
});

app.post('/api/stream/get', (req, res) => {
  logger.info('Stream request', { body: req.body });
  res.json({ message: 'Stream endpoint - connect to streamService' });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  logger.warn('Route not found', { method: req.method, path: req.path });
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Start server
app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
  });
});

export default app;
