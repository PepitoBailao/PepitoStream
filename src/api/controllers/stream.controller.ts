/**
 * Stream Controller - Gère tous les endpoints stream
 * NestJS Controller Pattern
 */

import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  HttpCode,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CacheService } from '../../cache/cacheService';
import { SearchService } from '../../search/searchService';
import { QualityService } from '../../quality/qualityService';
import { AudioService } from '../../audio/audioService';
import { StreamService } from '../../stream/streamService';
import {
  SearchStreamRequestDTO,
  GetStreamRequestDTO,
  StreamResponseDTO,
  SearchResultResponseDTO,
  BulkSearchResponseDTO,
  DTOValidator,
  ErrorResponseDTO,
} from '../dto/stream.dto';

@Controller('api/v1/streams')
export class StreamController {
  constructor(
    private cacheService: CacheService,
    private searchService: SearchService,
    private qualityService: QualityService,
    private audioService: AudioService,
    private streamService: StreamService,
  ) {}

  /**
   * GET /api/v1/streams/search
   * Recherche des streams par requête
   * 
   * @param query - Terme de recherche
   * @param type - Type de recherche (fuzzy|exact|autocomplete)
   * @param limit - Nombre de résultats max (1-100)
   * @param offset - Offset pour pagination
   * @param sortBy - Tri (popularity|rating|relevance)
   * 
   * @example
   * GET /api/v1/streams/search?query=Breaking%20Bad&type=fuzzy&limit=20
   * Response: { query, type, totalResults, results[], processingTime, cacheHit }
   */
  @Get('search')
  @HttpCode(200)
  async searchStreams(
    @Query('query') query?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sortBy') sortBy?: string,
  ): Promise<SearchResultResponseDTO> {
    try {
      const startTime = Date.now();
      
      // Validation
      const dto = DTOValidator.validateSearchRequest({
        query,
        type,
        limit: parseInt(limit || '10'),
        offset: parseInt(offset || '0'),
        sortBy,
      });

      // Vérifier le cache
      const cacheKey = `search:${dto.query}:${dto.type}:${dto.limit}:${dto.offset}`;
      const cached = this.cacheService.get(cacheKey);
      
      if (cached) {
        return {
          ...cached,
          processingTime: Date.now() - startTime,
          cacheHit: true,
        };
      }

      // Recherche
      const results = await this.searchService.search(
        dto.query,
        dto.type as any,
        dto.limit,
        dto.offset,
        dto.sortBy as any,
      );

      const response: SearchResultResponseDTO = {
        query: dto.query,
        type: dto.type as any,
        totalResults: results.length,
        results: results.slice(0, dto.limit),
        processingTime: Date.now() - startTime,
        cacheHit: false,
      };

      // Cacher le résultat 1h
      this.cacheService.set(cacheKey, response, 3600);

      return response;
    } catch (error) {
      throw new BadRequestException({
        error: {
          code: 'SEARCH_ERROR',
          message: error.message,
          timestamp: new Date(),
          requestId: Math.random().toString(36).substring(7),
        },
      });
    }
  }

  /**
   * POST /api/v1/streams/search/bulk
   * Recherche multiple en une seule requête
   * 
   * @param body - { queries: string[] }
   * 
   * @example
   * POST /api/v1/streams/search/bulk
   * { "queries": ["Breaking Bad", "Game of Thrones"] }
   */
  @Post('search/bulk')
  @HttpCode(200)
  async bulkSearch(@Body() body: any): Promise<BulkSearchResponseDTO> {
    try {
      const startTime = Date.now();

      if (!body.queries || !Array.isArray(body.queries) || body.queries.length === 0) {
        throw new BadRequestException('queries must be a non-empty array');
      }

      if (body.queries.length > 50) {
        throw new BadRequestException('Maximum 50 queries per request');
      }

      const results = await Promise.all(
        body.queries.map((q) =>
          this.searchService.search(
            q,
            'fuzzy',
            Math.min(body.limit || 10, 100),
          ),
        ),
      );

      return {
        queries: body.queries.map((q, i) => ({
          query: q,
          results: {
            query: q,
            type: 'fuzzy',
            totalResults: results[i].length,
            results: results[i],
            processingTime: 0,
            cacheHit: false,
          },
        })),
        totalProcessingTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new BadRequestException({
        error: {
          code: 'BULK_SEARCH_ERROR',
          message: error.message,
          timestamp: new Date(),
          requestId: Math.random().toString(36).substring(7),
        },
      });
    }
  }

  /**
   * GET /api/v1/streams/autocomplete
   * Autocomplete pour les recherches
   * 
   * @param q - Début de la requête
   * @param limit - Nombre de suggestions (default: 10, max: 50)
   * 
   * @example
   * GET /api/v1/streams/autocomplete?q=break&limit=5
   * Response: { suggestions: ["Breaking Bad", "Breakdown", ...] }
   */
  @Get('autocomplete')
  @HttpCode(200)
  async autocomplete(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ): Promise<{ suggestions: string[] }> {
    try {
      if (!q || q.trim().length === 0) {
        throw new BadRequestException('q parameter is required');
      }

      const cacheKey = `autocomplete:${q}:${limit || 10}`;
      const cached = this.cacheService.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      const suggestions = await this.searchService.autocomplete(
        q,
        Math.min(parseInt(limit || '10'), 50),
      );

      const response = { suggestions };
      this.cacheService.set(cacheKey, response, 3600);

      return response;
    } catch (error) {
      throw new BadRequestException({
        error: {
          code: 'AUTOCOMPLETE_ERROR',
          message: error.message,
          timestamp: new Date(),
          requestId: Math.random().toString(36).substring(7),
        },
      });
    }
  }

  /**
   * GET /api/v1/streams/:id
   * Récupère un stream spécifique avec audio et qualité
   * 
   * @param id - ID du stream
   * @param preferredLanguage - vf|vostfr|vo (default: vf)
   * @param preferredQuality - PepitoCiné|Pepito|... (default: Pepito)
   * @param maxLatency - Latence max en ms (default: 10000)
   * 
   * @example
   * GET /api/v1/streams/tt0903747?preferredLanguage=vf&preferredQuality=PepitoCiné
   * Response: { id, title, quality, audio, file, sources[], ... }
   */
  @Get(':id')
  @HttpCode(200)
  async getStream(
    @Param('id') id: string,
    @Query('preferredLanguage') preferredLanguage?: string,
    @Query('preferredQuality') preferredQuality?: string,
    @Query('maxLatency') maxLatency?: string,
  ): Promise<StreamResponseDTO> {
    try {
      const startTime = Date.now();

      // Validation
      const dto = DTOValidator.validateGetStreamRequest({
        id,
        preferredLanguage,
        preferredQuality,
        maxLatency: parseInt(maxLatency || '10000'),
      });

      // Vérifier le cache
      const cacheKey = `stream:${dto.id}:${dto.preferredLanguage}:${dto.preferredQuality}`;
      const cached = this.cacheService.get(cacheKey);
      
      if (cached) {
        return {
          ...cached,
          estimatedPlayTime: Date.now() - startTime,
        };
      }

      // Récupérer le stream
      const stream = await this.streamService.getStream(dto.id);

      if (!stream) {
        throw new HttpException('Stream not found', HttpStatus.NOT_FOUND);
      }

      // Scoring qualité
      const qualityScore = this.qualityService.scoreStream(
        stream,
        dto.preferredQuality as any,
      );

      // Scoring audio
      const audioScore = this.audioService.scoreAudioTracks(
        stream.file.audioTracks,
        dto.preferredLanguage as any,
      );

      // Sélection meilleure source (avec latence)
      const sources = stream.sources.filter(
        (s) => s.latency <= dto.maxLatency,
      );

      if (sources.length === 0) {
        throw new HttpException(
          'No sources available within latency constraint',
          HttpStatus.NOT_FOUND,
        );
      }

      const response: StreamResponseDTO = {
        id: stream.id,
        title: stream.title,
        type: stream.type,
        season: stream.season,
        episode: stream.episode,
        releaseYear: stream.releaseYear,
        rating: stream.rating,
        popularity: stream.popularity,
        quality: qualityScore,
        audio: audioScore,
        file: stream.file,
        sources: sources.slice(0, 3),
        failoverSources: sources.slice(3, 6),
        estimatedPlayTime: Date.now() - startTime,
        cacheHitRate: this.cacheService.getHitRate(),
      };

      // Cacher 30 minutes
      this.cacheService.set(cacheKey, response, 1800);

      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: {
          code: 'GET_STREAM_ERROR',
          message: error.message,
          timestamp: new Date(),
          requestId: Math.random().toString(36).substring(7),
        },
      });
    }
  }

  /**
   * GET /api/v1/streams/:id/sources
   * Récupère les sources disponibles pour un stream
   * 
   * @param id - ID du stream
   * @param sortBy - Tri (latency|seeders|score) - default: latency
   * 
   * @example
   * GET /api/v1/streams/tt0903747/sources?sortBy=seeders
   */
  @Get(':id/sources')
  @HttpCode(200)
  async getSources(
    @Param('id') id: string,
    @Query('sortBy') sortBy: string = 'latency',
  ): Promise<{
    id: string;
    sources: any[];
    totalSources: number;
  }> {
    try {
      const cacheKey = `sources:${id}:${sortBy}`;
      const cached = this.cacheService.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      const stream = await this.streamService.getStream(id);

      if (!stream) {
        throw new HttpException('Stream not found', HttpStatus.NOT_FOUND);
      }

      let sources = [...stream.sources];

      // Tri
      if (sortBy === 'seeders') {
        sources.sort((a, b) => b.seeders - a.seeders);
      } else if (sortBy === 'score') {
        sources.sort((a, b) => b.score - a.score);
      } else {
        sources.sort((a, b) => a.latency - b.latency);
      }

      const response = {
        id,
        sources: sources.slice(0, 20),
        totalSources: sources.length,
      };

      // Cacher 5 minutes
      this.cacheService.set(cacheKey, response, 300);

      return response;
    } catch (error) {
      throw new InternalServerErrorException({
        error: {
          code: 'GET_SOURCES_ERROR',
          message: error.message,
          timestamp: new Date(),
          requestId: Math.random().toString(36).substring(7),
        },
      });
    }
  }

  /**
   * GET /api/v1/streams/:id/audio
   * Récupère les pistes audio disponibles
   * 
   * @param id - ID du stream
   * 
   * @example
   * GET /api/v1/streams/tt0903747/audio
   */
  @Get(':id/audio')
  @HttpCode(200)
  async getAudioTracks(
    @Param('id') id: string,
  ): Promise<{
    id: string;
    audioTracks: any[];
  }> {
    try {
      const stream = await this.streamService.getStream(id);

      if (!stream) {
        throw new HttpException('Stream not found', HttpStatus.NOT_FOUND);
      }

      return {
        id,
        audioTracks: stream.file.audioTracks,
      };
    } catch (error) {
      throw new InternalServerErrorException({
        error: {
          code: 'GET_AUDIO_ERROR',
          message: error.message,
          timestamp: new Date(),
          requestId: Math.random().toString(36).substring(7),
        },
      });
    }
  }

  /**
   * GET /api/v1/streams/:id/compare
   * Compare plusieurs profils de qualité/audio
   * 
   * @param id - ID du stream
   * 
   * @example
   * GET /api/v1/streams/tt0903747/compare
   */
  @Get(':id/compare')
  @HttpCode(200)
  async compareProfiles(
    @Param('id') id: string,
  ): Promise<{
    id: string;
    profiles: any[];
  }> {
    try {
      const stream = await this.streamService.getStream(id);

      if (!stream) {
        throw new HttpException('Stream not found', HttpStatus.NOT_FOUND);
      }

      const profiles = [
        {
          name: 'PepitoCiné',
          quality: this.qualityService.scoreStream(stream, 'PepitoCiné'),
          audio: this.audioService.scoreAudioTracks(stream.file.audioTracks, 'vf'),
        },
        {
          name: 'PepitoDuVoyage',
          quality: this.qualityService.scoreStream(stream, 'PepitoDuVoyage'),
          audio: this.audioService.scoreAudioTracks(stream.file.audioTracks, 'vf'),
        },
        {
          name: 'Pepito',
          quality: this.qualityService.scoreStream(stream, 'Pepito'),
          audio: this.audioService.scoreAudioTracks(stream.file.audioTracks, 'vf'),
        },
        {
          name: 'PepitoMacqueen',
          quality: this.qualityService.scoreStream(stream, 'PepitoMacqueen'),
          audio: this.audioService.scoreAudioTracks(stream.file.audioTracks, 'vf'),
        },
      ];

      return { id, profiles };
    } catch (error) {
      throw new InternalServerErrorException({
        error: {
          code: 'COMPARE_PROFILES_ERROR',
          message: error.message,
          timestamp: new Date(),
          requestId: Math.random().toString(36).substring(7),
        },
      });
    }
  }
}
