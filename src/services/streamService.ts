import { prisma } from '../db/connection';
import { logger } from '../utils/logger';
import { Source } from '@prisma/client';

export interface StreamOption {
  id: string;
  provider: string;
  link: string;
  quality: string;
  language: string;
  isVerified: boolean;
  latency: number | null;
  fileSize: number | null;
  seeders: number | null;
  priority: number;
  encoderInfo?: string;
  score: number;
}

export class StreamService {
  async getSources(contentId: string, episodeId?: string) {
    try {
      const where: any = {
        isActive: true,
        isVerified: true,
      };

      if (episodeId) {
        where.episodeId = episodeId;
      } else {
        where.contentId = contentId;
      }

      const sources = await prisma.source.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { latency: 'asc' },
          { seeders: 'desc' },
        ],
      });

      return this.scoreAndSort(sources);
    } catch (error) {
      logger.error('Get sources failed', { contentId, error: (error as Error).message });
      throw error;
    }
  }

  async getBestSource(contentId: string, episodeId?: string, userPrefs?: any) {
    try {
      const sources = await this.getSources(contentId, episodeId);
      
      if (sources.length === 0) {
        throw new Error('No sources available');
      }

      // Filter by user preferences
      let filtered = sources;
      if (userPrefs) {
        filtered = this.filterByPreferences(sources, userPrefs);
      }

      return filtered[0] || sources[0]; // Best source or fallback
    } catch (error) {
      logger.error('Get best source failed', { contentId, error: (error as Error).message });
      throw error;
    }
  }

  private scoreAndSort(sources: Source[]): StreamOption[] {
    return sources
      .map(source => ({
        id: source.id,
        provider: source.provider,
        link: source.link,
        quality: source.quality || 'unknown',
        language: source.language || 'unknown',
        isVerified: source.isVerified,
        latency: source.latency,
        fileSize: source.fileSize?.toString(),
        seeders: source.seeders,
        priority: source.priority,
        encoderInfo: source.encoderInfo || undefined,
        score: this.calculateScore(source),
      }))
      .sort((a, b) => b.score - a.score);
  }

  private calculateScore(source: Source): number {
    let score = source.priority * 10;

    // Latency bonus (lower is better)
    if (source.latency) {
      score += Math.max(0, 100 - source.latency / 10);
    }

    // Seeders bonus
    if (source.seeders && source.seeders > 0) {
      score += Math.min(50, source.seeders / 2);
    }

    // Verification bonus
    if (source.isVerified) score += 30;

    return score;
  }

  private filterByPreferences(sources: StreamOption[], prefs: any): StreamOption[] {
    let filtered = [...sources];

    // Filter by quality
    if (prefs.quality) {
      filtered = filtered.filter(s => s.quality.includes(prefs.quality));
    }

    // Filter by language
    if (prefs.language) {
      filtered = filtered.filter(s => 
        s.language.toLowerCase() === prefs.language.toLowerCase()
      );
    }

    // Filter by file size
    if (prefs.maxFileSize) {
      filtered = filtered.filter(s => 
        !s.fileSize || parseInt(s.fileSize) <= prefs.maxFileSize
      );
    }

    return filtered.length > 0 ? filtered : sources;
  }

  async recordStreamStart(userId: string, contentId: string, episodeId?: string) {
    try {
      await prisma.watchHistory.upsert({
        where: {
          userId_contentId: {
            userId,
            contentId,
          },
        },
        update: {
          watchedAt: new Date(),
        },
        create: {
          userId,
          contentId,
          episodeId,
          watchedAt: new Date(),
        },
      });

      logger.debug('Stream started', { userId, contentId, episodeId });
    } catch (error) {
      logger.error('Record stream start failed', { error: (error as Error).message });
    }
  }

  async updateStreamProgress(
    userId: string,
    contentId: string,
    watched: number,
    total: number,
    episodeId?: string
  ) {
    try {
      await prisma.watchHistory.update({
        where: {
          userId_contentId: {
            userId,
            contentId,
          },
        },
        data: {
          duration: watched,
          totalDuration: total,
          watchedAt: new Date(),
          episodeId,
        },
      });

      logger.debug('Stream progress updated', { userId, contentId, watched, total });
    } catch (error) {
      logger.error('Update stream progress failed', { error: (error as Error).message });
    }
  }
}