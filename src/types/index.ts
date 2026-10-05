// User Types
export interface User {
  id: number;
  username: string;
  email: string;
  profilePictureUrl?: string;
  bio?: string;
  isAdmin: boolean;
  isVerified: boolean;
  twoFaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Content Types
export type ContentType = 'movie' | 'tv' | 'anime';

export interface ContentMetadata {
  id: number;
  type: ContentType;
  title: string;
  originalTitle?: string;
  description?: string;
  year?: number;
  rating?: number;
  genre?: string;
  posterUrl?: string;
  backdropUrl?: string;
  tmdbId?: number;
  imdbId?: string;
  jikanId?: number;
  status: 'active' | 'archived' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

// Copy/Source Types
export interface AudioTrack {
  language: string;
  codec: string;
  channels: string;
  bitrate?: number;
}

export interface Copy {
  id: number;
  contentId: number;
  source: string;
  fileName: string;
  fileSize?: number;
  fileHash?: string;
  videoCodec?: string;
  videoResolution?: string;
  audioTracks?: AudioTrack[];
  languages?: string[];
  bitrate?: number;
  durationMinutes?: number;
  seeders?: number;
  leechers?: number;
  isVerified: boolean;
  isAvailable: boolean;
  magnetLink?: string;
  directLink?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  releaseGroup?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Quality Profile Types
export type QualityProfile = 'pepito-cine' | 'pepito' | 'pepito-voyage' | 'pepito-macqueen';
export type Language = 'vf' | 'vo' | 'vostfr';

export interface UserPreferences {
  id: number;
  userId: number;
  preferredLanguage: Language;
  qualityProfile: QualityProfile;
  maxBitrate: number;
  minVideoResolution: string;
  preferredAudioFormat: string;
  allow3d: boolean;
  skipIntros: boolean;
  autoPlayNext: boolean;
  subtitlesEnabled: boolean;
  subtitleLanguage: string;
  createdAt: Date;
  updatedAt: Date;
}

// Watch History Types
export interface StreamHistory {
  id: number;
  userId: number;
  contentId: number;
  copyId?: number;
  startedAt: Date;
  stoppedAt?: Date;
  totalSeconds: number;
  watchedSeconds: number;
  completed: boolean;
  device?: string;
  ipAddress?: string;
  createdAt: Date;
}

// Watchlist Types
export interface WatchlistItem {
  id: number;
  userId: number;
  contentId: number;
  position: number;
  addedAt: Date;
}

// Review Types
export interface Review {
  id: number;
  userId: number;
  contentId: number;
  rating: number;
  comment?: string;
  helpfulCount: number;
  unhelpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Search Types
export interface SearchQuery {
  q: string;
  type?: ContentType;
  year?: number;
  genre?: string;
  language?: Language;
  page?: number;
  limit?: number;
  sort?: 'rating' | 'date' | 'relevance';
}

export interface SearchResult {
  id: number;
  type: ContentType;
  title: string;
  year?: number;
  rating?: number;
  posterUrl?: string;
  matchScore: number;
}
