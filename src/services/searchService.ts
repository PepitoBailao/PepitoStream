import { prisma } from '../db/connection';
import { logger } from '../utils/logger';
import { cacheService } from './cacheService';
import { ContentType } from '@prisma/client';

export interface SearchOptions {
  type?: ContentType;
  limit?: number;
  offset?: number;
  sort?: 'relevance' | 'rating' | 'recent';
  isAnime?: boolean;
}

export class SearchService {
  private readonly CACHE_TTL = 3600; // 1 hour

  async search(query: string, options: SearchOptions = {}) {
    const {
      type,
      limit = 20,
      offset = 0,
      sort = 'relevance',
      isAnime,
    } = options;

    const cacheKey = `search:${query}:${type}:${limit}:${offset}:${sort}`;
    
    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Search cache hit', { query, cacheKey });
      return cached;
    }

    try {
      const where: any = {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      };

      if (type) where.type = type;
      if (isAnime !== undefined) where.isAnime = isAnime;

      const [results, total] = await Promise.all([
        prisma.content.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: this.getOrderBy(sort),
          include: {
            animeInfo: true,
            sources: {
              where: { isActive: true },
              take: 3,
              orderBy: { priority: 'desc' },
            },
          },
        }),
        prisma.content.count({ where }),
      ]);

      const response = { results, total, query };
      await cacheService.set(cacheKey, response, this.CACHE_TTL);
      
      logger.info('Search completed', { query, count: results.length });
      return response;
    } catch (error) {
      logger.error('Search failed', { query, error: (error as Error).message });
      throw error;
    }
  }

  async getPopular(options: SearchOptions = {}) {
    const { limit = 20, isAnime } = options;
    const cacheKey = `popular:${limit}:${isAnime}`;

    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      const where: any = { isActive: true };
      if (isAnime !== undefined) where.isAnime = isAnime;

      const results = await prisma.content.findMany({
        where,
        take: limit,
        orderBy: { rating: 'desc' },
        include: {
          animeInfo: true,
          sources: {
            where: { isActive: true },
            take: 3,
          },
        },
      });

      await cacheService.set(cacheKey, results, this.CACHE_TTL);
      return results;
    } catch (error) {
      logger.error('Get popular failed', { error: (error as Error).message });
      throw error;
    }
  }

  async getTrending(options: SearchOptions = {}) {
    const { limit = 20, isAnime } = options;
    const cacheKey = `trending:${limit}:${isAnime}`;

    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      const where: any = {
        watchHistory: { some: { watchedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
      };
      if (isAnime !== undefined) where.isAnime = isAnime;

      const results = await prisma.content.findMany({
        where,
        take: limit,
        orderBy: { watchHistory: { _count: 'desc' } },
        include: {
          animeInfo: true,
          sources: { take: 3 },
          _count: { select: { watchHistory: true } },
        },
      });

      await cacheService.set(cacheKey, results, 3600);
      return results;
    } catch (error) {
      logger.error('Get trending failed', { error: (error as Error).message });
      throw error;
    }
  }

  private getOrderBy(sort: string): any {
    switch (sort) {
      case 'rating':
        return { rating: 'desc' };
      case 'recent':
        return { releaseDate: 'desc' };
      case 'relevance':
      default:
        return { updatedAt: 'desc' };
    }
  }

  async clearCache(pattern?: string) {
    if (pattern) {
      await cacheService.deletePattern(`search:${pattern}*`);
    } else {
      await cacheService.deletePattern('search:*');
      await cacheService.deletePattern('popular:*');
      await cacheService.deletePattern('trending:*');
    }
    logger.info('Search cache cleared', { pattern });
  }
}