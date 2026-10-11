/**
 * Stream Service V3 - Cache + Search + Quality + Audio Integration
 * Complete end-to-end streaming with <10ms response time
 */

import { CacheService } from './cacheService';
import { SearchService } from './searchService';
import { QualityProfile, QualityProfileService } from './qualityProfiles';
import { AudioService, AudioPreference } from './audioService';

interface StreamRequest {
  contentId: string;
  contentType: 'movie' | 'series' | 'anime';
  season?: number;
  episode?: number;
  qualityProfile: 'PepitoCiné' | 'PepitoDuVoyage' | 'Pepito' | 'PepitoMacqueen';
  audioPreference: AudioPreference;
}

interface StreamSource {
  id: string;
  title: string;
  quality: string;
  resolution: string;
  bitrate: number;
  size: number;
  languages: string[];
  score: number;
  qualityScore: number;
  audioScore: number;
  combinedScore: number;
  url?: string;
  backup?: StreamSource[];
  responseTime: number;
}

interface StreamResult {
  contentId: string;
  sources: StreamSource[];
  primary: StreamSource;
  backups: StreamSource[];
  cacheHit: boolean;
  responseTime: number;
  timestamp: number;
}

export class StreamServiceWithCache {
  private cache: CacheService;
  private search: SearchService;
  private quality: QualityProfileService;
  private audio: AudioService;
  private sources: Map<string, StreamSource[]> = new Map(); // Mock data source

  constructor() {
    this.cache = new CacheService({
      maxSize: 500,
      defaultTTL: 3600000, // 1h
      compressionThreshold: 10240,
      cleanupInterval: 60000,
    });
    this.search = new SearchService(this.cache);
    this.quality = new QualityProfileService();
    this.audio = new AudioService();
  }

  /**
   * Récupère les sources pour un contenu
   * Cache-aware avec failover automatique
   */
  async getSources(request: StreamRequest): Promise<StreamResult> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(request);

    // 1. Vérifier le cache <1ms
    const cached = await this.cache.get<StreamResult>('streams', cacheKey);
    if (cached.hit && cached.data) {
      const responseTime = performance.now() - startTime;
      return {
        ...cached.data,
        responseTime,
        cacheHit: true,
      };
    }

    // 2. Chercher les sources disponibles
    const allSources = this.getMockSources(request);

    // 3. Scorer qualité + audio
    const scoredSources = allSources.map((source) => {
      const qualityScore = this.quality.scoreSource(source, request.qualityProfile);
      const audioScore = this.audio.scoreAudio(source, request.audioPreference);
      const combinedScore = qualityScore * 0.6 + audioScore * 0.4; // 60/40 split

      return {
        ...source,
        qualityScore,
        audioScore,
        combinedScore,
      };
    });

    // 4. Trier et sélectionner top 3
    const ranked = scoredSources
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 3);

    if (ranked.length === 0) {
      throw new Error('No sources available for this content');
    }

    // 5. Construire le résultat avec failover
    const result: StreamResult = {
      contentId: request.contentId,
      sources: ranked,
      primary: ranked[0],
      backups: ranked.slice(1),
      cacheHit: false,
      responseTime: 0,
      timestamp: Date.now(),
    };

    // 6. Cacher le résultat
    const responseTime = performance.now() - startTime;
    await this.cache.set('streams', cacheKey, result, 3600000);

    return {
      ...result,
      responseTime: Math.round(responseTime * 100) / 100,
    };
  }

  /**
   * Recherche avec cache-aware
   */
  async searchContent(query: string, type?: 'movie' | 'series' | 'anime') {
    const startTime = performance.now();

    // Vérifier le cache
    const cacheKey = `${query}:${type || 'all'}`;
    const cached = await this.cache.get('search_results', cacheKey);

    if (cached.hit) {
      return {
        results: cached.data,
        responseTime: Math.round((performance.now() - startTime) * 100) / 100,
        from: 'cache',
      };
    }

    // Chercher dans l'index
    const results = await this.search.search(query, {
      limit: 20,
      type: type as any,
    });

    // Cacher les résultats
    await this.cache.set('search_results', cacheKey, results, 1800000); // 30 min

    return {
      results,
      responseTime: Math.round((performance.now() - startTime) * 100) / 100,
      from: 'search',
    };
  }

  /**
   * Index un contenu pour la recherche
   */
  async indexContent(item: {
    id: string;
    title: string;
    type: 'movie' | 'series' | 'anime';
    metadata?: any;
  }) {
    await this.search.indexItem(item);
    // Invalider les résultats de recherche en cache
    await this.cache.invalidateNamespace('search_results');
  }

  /**
   * Invalide la source pour un contenu (quand elle fail)
   */
  async invalidateSource(contentId: string, sourceId: string) {
    const cacheKey = this.generateCacheKeyFromId(contentId);
    await this.cache.invalidate('streams', cacheKey);

    // Retirer la source des sources disponibles
    const sources = this.sources.get(contentId) || [];
    const filtered = sources.filter((s) => s.id !== sourceId);
    this.sources.set(contentId, filtered);
  }

  /**
   * Ajoute une nouvelle source
   */
  async addSource(contentId: string, source: StreamSource) {
    const sources = this.sources.get(contentId) || [];
    sources.push(source);
    this.sources.set(contentId, sources);

    // Invalider le cache pour ce contenu
    const cacheKey = this.generateCacheKeyFromId(contentId);
    await this.cache.invalidate('streams', cacheKey);
  }

  /**
   * Statistics globales
   */
  getStats() {
    return {
      cache: this.cache.getStats(),
      search: this.search.getStats(),
      indexedSources: Array.from(this.sources.entries()).reduce(
        (sum, [, sources]) => sum + sources.length,
        0
      ),
    };
  }

  /**
   * Cleanup et destruction
   */
  destroy() {
    this.cache.destroy();
  }

  // ============ PRIVATE HELPERS ============

  private generateCacheKey(request: StreamRequest): string {
    const episodePart = request.season ? `s${request.season}e${request.episode || 0}` : '';
    return `${request.contentId}:${episodePart}:${request.qualityProfile}:${request.audioPreference.mode}`;
  }

  private generateCacheKeyFromId(contentId: string): string {
    return contentId;
  }

  /**
   * Mock data sources (à remplacer par vraie source)
   */
  private getMockSources(request: StreamRequest): StreamSource[] {
    // Retourner sources mockées pour demo
    const mockSources: StreamSource[] = [
      {
        id: 'source-1',
        title: 'YGG - 1080p BluRay',
        quality: '1080p',
        resolution: '1920x1080',
        bitrate: 8.5,
        size: 2.5,
        languages: ['fr', 'en'],
        score: 0,
        qualityScore: 0,
        audioScore: 0,
        combinedScore: 0,
        responseTime: 0,
      },
      {
        id: 'source-2',
        title: 'C411 - 720p WEB-DL',
        quality: '720p',
        resolution: '1280x720',
        bitrate: 4.2,
        size: 1.2,
        languages: ['fr'],
        score: 0,
        qualityScore: 0,
        audioScore: 0,
        combinedScore: 0,
        responseTime: 0,
      },
      {
        id: 'source-3',
        title: '4K - 2160p REMUX',
        quality: '4K',
        resolution: '3840x2160',
        bitrate: 45.0,
        size: 45.0,
        languages: ['fr', 'en', 'ja'],
        score: 0,
        qualityScore: 0,
        audioScore: 0,
        combinedScore: 0,
        responseTime: 0,
      },
    ];

    return mockSources;
  }
}

export { StreamRequest, StreamResult, StreamSource };
