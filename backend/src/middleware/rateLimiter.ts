import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';

const redis = createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

redis.connect().catch(console.error);

export const rateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const key = `rate-limit:${req.ip}`;
  const limit = 100;
  const window = 60; // 1 minute

  try {
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, window);
    }

    if (current > limit) {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: await redis.ttl(key),
      });
      return;
    }

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', limit - current);
    next();
  } catch (err) {
    next();
  }
};
