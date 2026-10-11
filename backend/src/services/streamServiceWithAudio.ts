/**
 * Stream Service with Audio Integration
 * Combines quality profiles, audio selection, and failover
 */

import { AudioService, AudioTrack, AudioPreference, Language } from './audioService';
import { QualityProfile, QualityProfileService } from './qualityProfiles';

export interface StreamSource {
  id: string;
  name: string;
  url: string;
  torrentHash?: string;
  tracker?: string;
  fileSize: number; // in bytes
  bitrate?: number; // in Mb/s
  audioTracks: AudioTrack[];
  quality: string; // 2160p, 1080p, 720p, etc
  release: string; // BluRay, WEB-DL, etc
  codec: string; // HEVC, H264, etc
  verified: boolean; // extracted from file
  latency?: number; // in ms
}

export interface StreamSelection {
  primary: StreamSource;
  fallbacks: StreamSource[];
  audioTrack: {
    primary: AudioTrack;
    fallback: AudioTrack | null;
  };
  qualityProfile: QualityProfile;
  totalScore: number; // 0-100
  estimatedLoadTime: number; // in seconds
}

export interface StreamRequest {
  contentId: string;
  contentType: 'movie' | 'episode';
  quality: QualityProfile;
  audioPreference: AudioPreference;
  maxFileSize?: number;
  maxLatency?: number;
}

export interface StreamCandidate {
  source: StreamSource;
  qualityScore: number;
  audioScore: number;
  totalScore: number;
  audioAnalysis: any; // AudioAnalysis from AudioService
}

export class StreamServiceWithAudio {
  /**
   * Select best stream with audio optimization
   * 1. Filter by quality profile
   * 2. Select audio tracks
   * 3. Score and rank
   * 4. Prepare fallback chain
   */
  static selectStream(
    sources: StreamSource[],
    request: StreamRequest
  ): StreamSelection {
    // Step 1: Score each source by quality profile
    const qualityScored = sources.map(source => ({
      source,
      qualityScore: QualityProfileService.scoreStream(source, request.quality),
    }));

    // Filter minimum quality threshold
    const qualified = qualityScored.filter(item => item.qualityScore >= 30);

    if (qualified.length === 0) {
      throw new Error('No sources meet minimum quality threshold');
    }

    // Step 2: Analyze audio for each qualified source
    const audioAnalyzed: StreamCandidate[] = qualified.map(item => {
      const audioAnalysis = AudioService.selectAudioTrack(
        item.source.audioTracks,
        request.audioPreference
      );

      return {
        source: item.source,
        qualityScore: item.qualityScore,
        audioScore: audioAnalysis.score,
        totalScore: (item.qualityScore * 0.6) + (audioAnalysis.score * 0.4),
        audioAnalysis,
      };
    });

    // Step 3: Sort by total score
    audioAnalyzed.sort((a, b) => b.totalScore - a.totalScore);

    const best = audioAnalyzed[0];
    const fallbacks = audioAnalyzed.slice(1, 4).map(item => item.source);

    // Step 4: Calculate load time estimate
    const estimatedLoadTime = this.estimateLoadTime(best.source, request.quality);

    return {
      primary: best.source,
      fallbacks,
      audioTrack: {
        primary: best.audioAnalysis.primaryTrack!,
        fallback: best.audioAnalysis.fallbackTrack,
      },
      qualityProfile: request.quality,
      totalScore: best.totalScore,
      estimatedLoadTime,
    };
  }

  /**
   * Get detailed ranking of all sources
   * Useful for UI to show alternatives
   */
  static rankSources(
    sources: StreamSource[],
    request: StreamRequest
  ): StreamCandidate[] {
    const candidates: StreamCandidate[] = sources.map(source => {
      const qualityScore = QualityProfileService.scoreStream(source, request.quality);
      const audioAnalysis = AudioService.selectAudioTrack(
        source.audioTracks,
        request.audioPreference
      );

      return {
        source,
        qualityScore,
        audioScore: audioAnalysis.score,
        totalScore: (qualityScore * 0.6) + (audioAnalysis.score * 0.4),
        audioAnalysis,
      };
    });

    candidates.sort((a, b) => b.totalScore - a.totalScore);
    return candidates;
  }

  /**
   * Estimate load time based on bitrate and latency
   */
  private static estimateLoadTime(source: StreamSource, profile: QualityProfile): number {
    const bitrate = source.bitrate || 5; // default 5 Mb/s
    const latency = source.latency || 0;

    // For a 2GB file average:
    // Time = (fileSize * 8) / bitrate + latency
    const bufferTime = (source.fileSize * 8) / (bitrate * 1_000_000); // in seconds
    const totalTime = bufferTime + (latency / 1000); // latency is in ms

    return Math.round(totalTime * 100) / 100;
  }

  /**
   * Failover to next source automatically
   * Called when primary fails to load
   */
  static handleFailover(
    selection: StreamSelection,
    failureReason: string
  ): StreamSource | null {
    console.log(`[Failover] Primary failed: ${failureReason}`);

    if (selection.fallbacks.length === 0) {
      return null;
    }

    const nextSource = selection.fallbacks.shift();
    console.log(`[Failover] Switching to: ${nextSource?.name}`);

    return nextSource || null;
  }

  /**
   * Generate human-readable stream description
   * For UI display
   */
  static describeStream(selection: StreamSelection): string {
    const parts: string[] = [];

    // Quality
    parts.push(`${selection.primary.quality} • ${selection.primary.release}`);

    // Audio
    const audioDesc = AudioService.describeAudio(selection.audioTrack.primary);
    parts.push(audioDesc);

    // File size
    const sizeMB = selection.primary.fileSize / (1024 * 1024);
    if (sizeMB < 1024) {
      parts.push(`💾 ${Math.round(sizeMB)} MB`);
    } else {
      const sizeGB = sizeMB / 1024;
      parts.push(`💾 ${(sizeGB).toFixed(1)} GB`);
    }

    // Latency/Speed
    if (selection.primary.bitrate) {
      parts.push(`📶 ${selection.primary.bitrate} Mb/s`);
    }

    // Fallback available
    if (selection.fallbacks.length > 0) {
      parts.push(`[${selection.fallbacks.length} backups]`);
    }

    return parts.join(' • ');
  }

  /**
   * Get streaming URL with smart selection
   * Handles multiple trackers/mirrors
   */
  static getStreamUrl(source: StreamSource, audioTrack: AudioTrack): string {
    // Could be enhanced to:
    // - Use AllDebrid/RealDebrid API
    // - Detect working mirrors
    // - Handle CDN load balancing
    
    const url = new URL(source.url);
    
    // Add audio track parameter if needed
    if (audioTrack.language) {
      url.searchParams.set('audio', audioTrack.language);
    }

    return url.toString();
  }

  /**
   * Validate source availability before streaming
   */
  static async validateSource(source: StreamSource): Promise<boolean> {
    try {
      // Check if torrent is still alive or link is accessible
      const response = await fetch(source.url, { method: 'HEAD', timeout: 5000 });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get cache key for quick lookups
   */
  static getCacheKey(request: StreamRequest): string {
    return `${request.contentId}:${request.quality.name}:${request.audioPreference.priority}`;
  }

  /**
   * Enrich stream sources with audio metadata
   * Parse MKV/MP4 files to extract exact audio tracks
   */
  static enrichAudioMetadata(source: StreamSource, fileMetadata: any): StreamSource {
    if (fileMetadata.audioTracks) {
      const enriched = AudioService.parseAudioTracks(fileMetadata.audioTracks);
      return {
        ...source,
        audioTracks: enriched,
        verified: true, // extracted from actual file
      };
    }

    return source;
  }

  /**
   * Get statistics for a stream selection
   */
  static getStats(selection: StreamSelection): Record<string, any> {
    return {
      qualityProfile: selection.qualityProfile.name,
      primarySource: selection.primary.name,
      fallbackCount: selection.fallbacks.length,
      audioLanguage: selection.audioTrack.primary.language,
      audioCodec: selection.audioTrack.primary.codec,
      fileSize: `${(selection.primary.fileSize / (1024 * 1024 * 1024)).toFixed(1)} GB`,
      bitrate: `${selection.primary.bitrate} Mb/s`,
      estimatedLoadTime: `${selection.estimatedLoadTime}s`,
      totalScore: selection.totalScore,
      recommendedFor: this.getRecommendation(selection),
    };
  }

  /**
   * Recommend best use case for this stream
   */
  private static getRecommendation(selection: StreamSelection): string {
    const score = selection.totalScore;
    const loadTime = selection.estimatedLoadTime;

    if (score >= 90) return '🎬 Best quality, enjoy!';
    if (score >= 75) return '✅ Great choice';
    if (score >= 60) return '👍 Decent option';
    if (score >= 45) return '⚠️ Lower quality';
    return '❌ Emergency fallback only';
  }
}
