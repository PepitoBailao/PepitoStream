/**
 * Audio Language Selection Service
 * Intelligent system for selecting VF/VOSTFR with fallback logic
 */

export type Language = 'VF' | 'VOSTFR' | 'VO' | 'MULTI' | 'UNKNOWN';
export type AudioPriority = 'vf-first' | 'vostfr-first' | 'vo-first';

export interface AudioTrack {
  language: Language;
  codec: string; // AC3, AAC, FLAC, TrueHD, DTS-HD, EAC3, Atmos
  channels: string; // 2.0, 5.1, 7.1, Atmos
  bitrate?: number; // in kbps
  default?: boolean;
  verified?: boolean; // extracted from file, not from title
}

export interface AudioPreference {
  priority: AudioPriority;
  maxSize?: number; // max file size in GB
  requireMultichannel?: boolean; // require 5.1+
  requireAtmos?: boolean;
  requireVerified?: boolean; // only verified from file
  excludeCodecs?: string[];
  preferredCodecs?: string[]; // weighted preference
}

export interface AudioAnalysis {
  primaryTrack: AudioTrack | null;
  fallbackTrack: AudioTrack | null;
  allTracks: AudioTrack[];
  fallbackReason?: string;
  score: number; // 0-100
}

export class AudioService {
  /**
   * Parse audio tracks from file metadata
   * Extracts language info from MKV/MP4 tracks
   */
  static parseAudioTracks(tracks: AudioTrack[]): AudioTrack[] {
    return tracks.map(track => ({
      ...track,
      language: this.normalizeLanguage(track.language),
      codec: track.codec.toUpperCase(),
    }));
  }

  /**
   * Normalize language codes to standard format
   */
  private static normalizeLanguage(lang: Language | string): Language {
    if (!lang) return 'UNKNOWN';

    const normalized = String(lang).toUpperCase().trim();

    if (normalized.includes('FR') || normalized === 'VF') return 'VF';
    if (normalized.includes('VOSTFR') || normalized === 'VOSTFR') return 'VOSTFR';
    if (normalized.includes('EN') || normalized === 'VO') return 'VO';
    if (normalized.includes('MULTI')) return 'MULTI';

    return 'UNKNOWN';
  }

  /**
   * Main logic: Select audio track based on user preference
   * Returns primary track + fallback if primary fails
   */
  static selectAudioTrack(
    tracks: AudioTrack[],
    preference: AudioPreference
  ): AudioAnalysis {
    const parsed = this.parseAudioTracks(tracks);
    const filtered = this.filterTracks(parsed, preference);

    if (filtered.length === 0) {
      // No track matches preference - use fallback chain
      return this.selectWithFallback(parsed, preference);
    }

    // Score and rank matching tracks
    const scored = filtered.map(track => ({
      track,
      score: this.scoreTrack(track, preference),
    }));

    scored.sort((a, b) => b.score - a.score);

    const primary = scored[0].track;
    const fallback = scored[1]?.track || this.getFallbackTrack(parsed, primary, preference);

    return {
      primaryTrack: primary,
      fallbackTrack: fallback,
      allTracks: parsed,
      score: scored[0].score,
    };
  }

  /**
   * Filter tracks based on constraints
   */
  private static filterTracks(tracks: AudioTrack[], preference: AudioPreference): AudioTrack[] {
    return tracks.filter(track => {
      // Only verified tracks if required
      if (preference.requireVerified && !track.verified) {
        return false;
      }

      // Exclude specific codecs
      if (preference.excludeCodecs?.includes(track.codec)) {
        return false;
      }

      // Require multichannel (5.1+, 7.1, Atmos)
      if (preference.requireMultichannel) {
        const channels = this.parseChannels(track.channels);
        if (channels < 5.1) return false;
      }

      // Require Atmos
      if (preference.requireAtmos && !track.codec.includes('ATMOS')) {
        return false;
      }

      return true;
    });
  }

  /**
   * Score a track 0-100 based on preference
   */
  private static scoreTrack(track: AudioTrack, preference: AudioPreference): number {
    let score = 0;

    // Language match (40 points max)
    if (preference.priority === 'vf-first') {
      if (track.language === 'VF') score += 40;
      else if (track.language === 'VOSTFR') score += 20;
      else if (track.language === 'VO') score += 10;
    } else if (preference.priority === 'vostfr-first') {
      if (track.language === 'VOSTFR') score += 40;
      else if (track.language === 'VF') score += 20;
      else if (track.language === 'VO') score += 10;
    } else if (preference.priority === 'vo-first') {
      if (track.language === 'VO') score += 40;
      else if (track.language === 'VOSTFR') score += 20;
      else if (track.language === 'VF') score += 10;
    }

    // Verified bonus (10 points)
    if (track.verified) score += 10;

    // Codec preference (20 points max)
    if (preference.preferredCodecs?.length) {
      const index = preference.preferredCodecs.findIndex(codec => track.codec.includes(codec));
      if (index !== -1) {
        score += Math.max(0, 20 - index * 5);
      }
    }

    // Multichannel bonus (15 points)
    const channels = this.parseChannels(track.channels);
    if (channels >= 7.1) score += 15;
    else if (channels >= 5.1) score += 10;
    else if (channels >= 2.0) score += 5;

    // Atmos bonus (15 points)
    if (track.codec.includes('ATMOS')) score += 15;

    return Math.min(score, 100);
  }

  /**
   * Fallback logic when no track matches preference
   * VF → VOSTFR → VO chain
   */
  private static selectWithFallback(
    tracks: AudioTrack[],
    preference: AudioPreference
  ): AudioAnalysis {
    let fallbackChain: Language[] = [];
    let fallbackReason = '';

    if (preference.priority === 'vf-first') {
      fallbackChain = ['VF', 'VOSTFR', 'VO', 'MULTI'];
      fallbackReason = 'No VF found';
    } else if (preference.priority === 'vostfr-first') {
      fallbackChain = ['VOSTFR', 'VF', 'VO', 'MULTI'];
      fallbackReason = 'No VOSTFR found';
    } else if (preference.priority === 'vo-first') {
      fallbackChain = ['VO', 'VOSTFR', 'VF', 'MULTI'];
      fallbackReason = 'No VO found';
    }

    for (const lang of fallbackChain) {
      const matching = tracks.filter(t => t.language === lang);
      if (matching.length > 0) {
        const best = matching.sort((a, b) => this.scoreTrack(b, preference) - this.scoreTrack(a, preference))[0];
        return {
          primaryTrack: best,
          fallbackTrack: this.getFallbackTrack(tracks, best, preference),
          allTracks: tracks,
          fallbackReason,
          score: this.scoreTrack(best, preference),
        };
      }
    }

    // Last resort: any track
    if (tracks.length > 0) {
      return {
        primaryTrack: tracks[0],
        fallbackTrack: tracks[1] || null,
        allTracks: tracks,
        fallbackReason: 'Emergency fallback - any available track',
        score: 0,
      };
    }

    return {
      primaryTrack: null,
      fallbackTrack: null,
      allTracks: [],
      fallbackReason: 'No audio tracks available',
      score: 0,
    };
  }

  /**
   * Get best fallback track (different from primary)
   */
  private static getFallbackTrack(
    tracks: AudioTrack[],
    primary: AudioTrack,
    preference: AudioPreference
  ): AudioTrack | null {
    const others = tracks.filter(t => t !== primary);
    if (others.length === 0) return null;

    others.sort((a, b) => this.scoreTrack(b, preference) - this.scoreTrack(a, preference));
    return others[0];
  }

  /**
   * Parse channel string to numeric value
   * "5.1" → 5.1, "Atmos" → 8
   */
  private static parseChannels(channels: string): number {
    if (!channels) return 2.0;

    if (channels.includes('Atmos') || channels.includes('ATMOS')) return 8;
    if (channels.includes('7.1')) return 7.1;
    if (channels.includes('5.1')) return 5.1;
    if (channels.includes('2.0')) return 2.0;

    return 2.0;
  }

  /**
   * Get human-readable audio description
   */
  static describeAudio(track: AudioTrack): string {
    const parts = [
      track.language,
      track.codec,
      track.channels,
    ];

    if (track.codec.includes('ATMOS')) {
      parts.push('Atmos');
    }

    if (track.verified) {
      parts.push('✓');
    }

    return parts.filter(Boolean).join(' • ');
  }

  /**
   * Compare two tracks and return better one
   */
  static compareTracks(trackA: AudioTrack, trackB: AudioTrack, preference: AudioPreference): AudioTrack {
    const scoreA = this.scoreTrack(trackA, preference);
    const scoreB = this.scoreTrack(trackB, preference);
    return scoreA >= scoreB ? trackA : trackB;
  }
}
