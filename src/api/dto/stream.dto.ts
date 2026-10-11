/**
 * Stream API DTOs (Data Transfer Objects)
 * Validation schemas pour les requêtes/réponses API
 */

// ============= REQUEST DTOs =============

export interface SearchStreamRequestDTO {
  query: string;
  type?: 'fuzzy' | 'exact' | 'autocomplete';
  limit?: number;
  offset?: number;
  sortBy?: 'popularity' | 'rating' | 'relevance';
}

export interface GetStreamRequestDTO {
  id: string;
  preferredLanguage?: 'vf' | 'vostfr' | 'vo';
  preferredQuality?: 'PepitoCiné' | 'PepitoDuVoyage' | 'Pepito' | 'PepitoMacqueen';
  maxLatency?: number; // en ms
}

export interface StreamOptionsRequestDTO {
  qualityProfiles?: Array<'PepitoCiné' | 'PepitoDuVoyage' | 'Pepito' | 'PepitoMacqueen'>;
  preferredLanguages?: Array<'vf' | 'vostfr' | 'vo'>;
  maxFileSize?: number; // en Go
  enableFailover?: boolean;
  cacheTTL?: number; // en secondes
}

export interface BulkSearchRequestDTO {
  queries: string[];
  limit?: number;
  type?: 'fuzzy' | 'exact' | 'autocomplete';
}

// ============= RESPONSE DTOs =============

export interface AudioTrackResponseDTO {
  language: 'fr' | 'en' | 'es' | 'de' | 'it' | string;
  type: 'vf' | 'vostfr' | 'vo';
  codec: 'AC3' | 'DTS' | 'AAC' | 'FLAC' | 'TrueHD' | 'DDP';
  channels: '2.0' | '5.1' | '7.1' | 'Atmos';
  bitrate: number; // en kbps
  score: number; // 0-100
  isDefault: boolean;
}

export interface SourceResponseDTO {
  id: string;
  tracker: string; // YGG, C411, Tr4ker, etc.
  magnet?: string;
  hash?: string;
  seeders: number;
  peers: number;
  latency: number; // en ms
  score: number; // 0-100
  status: 'online' | 'offline' | 'slow';
}

export interface FileMetadataResponseDTO {
  filename: string;
  size: number; // en bytes
  resolution: '720p' | '1080p' | '4K' | '8K';
  codec: 'H.264' | 'H.265' | 'VP9' | string;
  bitrate: number; // en Mbps
  duration?: number; // en secondes
  audioTracks: AudioTrackResponseDTO[];
  subtitles?: Array<{
    language: string;
    format: 'srt' | 'ass' | 'vtt';
  }>;
}

export interface StreamResponseDTO {
  id: string;
  title: string;
  type: 'movie' | 'series';
  season?: number;
  episode?: number;
  releaseYear?: number;
  rating?: number;
  popularity?: number;
  
  quality: {
    profile: 'PepitoCiné' | 'PepitoDuVoyage' | 'Pepito' | 'PepitoMacqueen';
    resolution: string;
    codec: string;
    bitrate: number;
    score: number;
  };
  
  audio: AudioTrackResponseDTO;
  
  file: FileMetadataResponseDTO;
  
  sources: SourceResponseDTO[];
  
  failoverSources?: SourceResponseDTO[];
  
  estimatedPlayTime: number; // en ms
  cacheHitRate: number; // 0-100
}

export interface SearchResultResponseDTO {
  query: string;
  type: 'fuzzy' | 'exact' | 'autocomplete';
  totalResults: number;
  results: Array<{
    id: string;
    title: string;
    type: 'movie' | 'series';
    season?: number;
    episode?: number;
    rating?: number;
    relevanceScore: number; // 0-100
  }>;
  processingTime: number; // en ms
  cacheHit: boolean;
}

export interface BulkSearchResponseDTO {
  queries: Array<{
    query: string;
    results: SearchResultResponseDTO;
  }>;
  totalProcessingTime: number;
}

export interface CacheStatsResponseDTO {
  totalItems: number;
  memoryUsed: number; // en bytes
  memoryUsedPercent: number; // 0-100
  cacheHitRate: number; // 0-100
  missRate: number; // 0-100
  avgAccessTime: number; // en ms
  
  topItems: Array<{
    key: string;
    accessCount: number;
    lastAccessed: Date;
    size: number;
  }>;
  
  ttlStats: {
    expired: number;
    active: number;
    avgTTL: number;
  };
}

export interface HealthResponseDTO {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number; // en ms
  timestamp: Date;
  
  services: {
    cache: {
      status: 'ok' | 'error';
      responseTime: number;
    };
    search: {
      status: 'ok' | 'error';
      responseTime: number;
    };
    quality: {
      status: 'ok' | 'error';
      responseTime: number;
    };
    audio: {
      status: 'ok' | 'error';
      responseTime: number;
    };
  };
  
  metrics: {
    requestsPerSecond: number;
    avgResponseTime: number;
    errorRate: number; // 0-100
  };
}

export interface ErrorResponseDTO {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: Date;
    requestId: string;
  };
}

// ============= VALIDATION HELPERS =============

export class DTOValidator {
  static validateSearchRequest(dto: any): SearchStreamRequestDTO {
    if (!dto.query || typeof dto.query !== 'string' || dto.query.trim().length === 0) {
      throw new Error('Query must be a non-empty string');
    }
    
    if (dto.type && !['fuzzy', 'exact', 'autocomplete'].includes(dto.type)) {
      throw new Error('Invalid search type');
    }
    
    if (dto.limit && (dto.limit < 1 || dto.limit > 100)) {
      throw new Error('Limit must be between 1 and 100');
    }
    
    return {
      query: dto.query.trim(),
      type: dto.type || 'fuzzy',
      limit: Math.min(dto.limit || 10, 100),
      offset: Math.max(0, dto.offset || 0),
      sortBy: dto.sortBy || 'relevance',
    };
  }
  
  static validateGetStreamRequest(dto: any): GetStreamRequestDTO {
    if (!dto.id || typeof dto.id !== 'string') {
      throw new Error('Stream ID is required');
    }
    
    if (dto.preferredLanguage && !['vf', 'vostfr', 'vo'].includes(dto.preferredLanguage)) {
      throw new Error('Invalid language preference');
    }
    
    if (dto.preferredQuality && !['PepitoCiné', 'PepitoDuVoyage', 'Pepito', 'PepitoMacqueen'].includes(dto.preferredQuality)) {
      throw new Error('Invalid quality preference');
    }
    
    return {
      id: dto.id,
      preferredLanguage: dto.preferredLanguage || 'vf',
      preferredQuality: dto.preferredQuality || 'Pepito',
      maxLatency: Math.max(0, dto.maxLatency || 10000),
    };
  }
  
  static validateStreamOptions(dto: any): StreamOptionsRequestDTO {
    if (dto.maxFileSize && (dto.maxFileSize < 0.5 || dto.maxFileSize > 100)) {
      throw new Error('Max file size must be between 0.5 GB and 100 GB');
    }
    
    return {
      qualityProfiles: dto.qualityProfiles || ['Pepito', 'PepitoCiné'],
      preferredLanguages: dto.preferredLanguages || ['vf', 'vostfr'],
      maxFileSize: dto.maxFileSize || 2,
      enableFailover: dto.enableFailover !== false,
      cacheTTL: Math.max(60, dto.cacheTTL || 3600),
    };
  }
}
