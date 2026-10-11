import { StreamServiceWithAudio, StreamSource, StreamRequest, StreamSelection } from '../streamServiceWithAudio';
import { AudioTrack, AudioPreference } from '../audioService';
import { QualityProfile } from '../qualityProfiles';

describe('StreamServiceWithAudio Integration', () => {
  const mockQualityProfile: QualityProfile = {
    name: 'PepitoCiné',
    priority: 95,
    constraints: {
      maxResolution: '4K',
      minBitrate: 5,
      maxBitrate: 150,
      preferredFormats: ['REMUX', 'BluRay'],
      preferredCodecs: ['HEVC', 'H264'],
    },
    weights: {
      bitrate: 0.35,
      resolution: 0.30,
      fileSize: 0.15,
      latency: 0.20,
    },
  };

  const mockAudioTracks: AudioTrack[] = [
    {
      language: 'VF',
      codec: 'AC3',
      channels: '5.1',
      verified: true,
      default: true,
    },
    {
      language: 'VOSTFR',
      codec: 'AAC',
      channels: '2.0',
      verified: true,
    },
  ];

  const mockSource1: StreamSource = {
    id: 'src-1',
    name: 'YGG - Dune Part Two 4K',
    url: 'magnet:?xt=urn:btih:abc123',
    torrentHash: 'abc123',
    tracker: 'YGG',
    fileSize: 54 * 1024 * 1024 * 1024, // 54 GB
    bitrate: 44,
    audioTracks: mockAudioTracks,
    quality: '2160p',
    release: 'BluRay REMUX',
    codec: 'HEVC',
    verified: true,
    latency: 150,
  };

  const mockSource2: StreamSource = {
    id: 'src-2',
    name: 'C411 - Dune Part Two 4K',
    url: 'magnet:?xt=urn:btih:def456',
    torrentHash: 'def456',
    tracker: 'C411',
    fileSize: 54 * 1024 * 1024 * 1024,
    bitrate: 42,
    audioTracks: [
      {
        language: 'VO',
        codec: 'FLAC',
        channels: '7.1',
        verified: true,
      },
    ],
    quality: '2160p',
    release: 'BluRay REMUX',
    codec: 'HEVC',
    verified: true,
    latency: 200,
  };

  const mockSource3: StreamSource = {
    id: 'src-3',
    name: 'Tr4ker - Dune Part Two 1080p',
    url: 'magnet:?xt=urn:btih:ghi789',
    torrentHash: 'ghi789',
    tracker: 'Tr4ker',
    fileSize: 8 * 1024 * 1024 * 1024, // 8 GB
    bitrate: 15,
    audioTracks: mockAudioTracks,
    quality: '1080p',
    release: 'WEB-DL',
    codec: 'H264',
    verified: true,
    latency: 100,
  };

  const mockAudioPreferenceVF: AudioPreference = {
    priority: 'vf-first',
    requireVerified: true,
  };

  describe('selectStream - Best Source Selection', () => {
    it('should select best source by quality profile and audio', () => {
      const request: StreamRequest = {
        contentId: 'dune-2024',
        contentType: 'movie',
        quality: mockQualityProfile,
        audioPreference: mockAudioPreferenceVF,
      };

      const sources = [mockSource1, mockSource2, mockSource3];
      const selection = StreamServiceWithAudio.selectStream(sources, request);

      expect(selection.primary).toBeDefined();
      expect(selection.primary.quality).toBe('2160p');
      expect(selection.audioTrack.primary.language).toBe('VF');
      expect(selection.fallbacks.length).toBeGreaterThan(0);
    });

    it('should include fallback sources', () => {
      const request: StreamRequest = {
        contentId: 'dune-2024',
        contentType: 'movie',
        quality: mockQualityProfile,
        audioPreference: mockAudioPreferenceVF,
      };

      const sources = [mockSource1, mockSource2, mockSource3];
      const selection = StreamServiceWithAudio.selectStream(sources, request);

      expect(selection.fallbacks).toHaveLength(2);
      expect(selection.fallbacks[0]).toBeDefined();
    });

    it('should prioritize by total score (60% quality, 40% audio)', () => {
      const request: StreamRequest = {
        contentId: 'dune-2024',
        contentType: 'movie',
        quality: mockQualityProfile,
        audioPreference: mockAudioPreferenceVF,
      };

      const sources = [mockSource1, mockSource2];
      const selection = StreamServiceWithAudio.selectStream(sources, request);

      // Source1 has VF (better audio), both same quality
      expect(selection.primary.id).toBe('src-1');
    });

    it('should handle preference for VO when available', () => {
      const voPreference: AudioPreference = {
        priority: 'vo-first',
      };

      const request: StreamRequest = {
        contentId: 'dune-2024',
        contentType: 'movie',
        quality: mockQualityProfile,
        audioPreference: voPreference,
      };

      const sources = [mockSource1, mockSource2];
      const selection = StreamServiceWithAudio.selectStream(sources, request);

      expect(selection.audioTrack.primary.language).toBe('VO');
    });

    it('should throw error when no sources meet quality threshold', () => {
      const strictProfile: QualityProfile = {
        ...mockQualityProfile,
        constraints: {
          ...mockQualityProfile.constraints,
          minBitrate: 200, // impossible to meet
        },
      };

      const request: StreamRequest = {
        contentId: 'dune-2024',
        contentType: 'movie',
        quality: strictProfile,
        audioPreference: mockAudioPreferenceVF,
      };

      expect(() => {
        StreamServiceWithAudio.selectStream([mockSource1], request);
      }).toThrow();
    });
  });

  describe('rankSources - Detailed Ranking', () => {
    it('should return ranked candidates', () => {
      const request: StreamRequest = {
        contentId: 'dune-2024',
        contentType: 'movie',
        quality: mockQualityProfile,
        audioPreference: mockAudioPreferenceVF,
      };

      const sources = [mockSource1, mockSource2, mockSource3];
      const ranking = StreamServiceWithAudio.rankSources(sources, request);

      expect(ranking).toHaveLength(3);
      expect(ranking[0].totalScore).toBeGreaterThanOrEqual(ranking[1].totalScore);
      expect(ranking[1].totalScore).toBeGreaterThanOrEqual(ranking[2].totalScore);
    });

    it('should include quality and audio scores', () => {
      const request: StreamRequest = {
        contentId: 'dune-2024',
        contentType: 'movie',
        quality: mockQualityProfile,
        audioPreference: mockAudioPreferenceVF,
      };

      const ranking = StreamServiceWithAudio.rankSources([mockSource1], request);

      expect(ranking[0].qualityScore).toBeGreaterThan(0);
      expect(ranking[0].audioScore).toBeGreaterThan(0);
      expect(ranking[0].totalScore).toBe(
        ranking[0].qualityScore * 0.6 + ranking[0].audioScore * 0.4
      );
    });
  });

  describe('handleFailover - Failover Logic', () => {
    it('should return next fallback source', () => {
      const request: StreamRequest = {
        contentId: 'dune-2024',
        contentType: 'movie',
        quality: mockQualityProfile,
        audioPreference: mockAudioPreferenceVF,
      };

      const sources = [mockSource1, mockSource2, mockSource3];
      const selection = StreamServiceWithAudio.selectStream(sources, request);
      const initialFallbackCount = selection.fallbacks.length;

      const nextSource = StreamServiceWithAudio.handleFailover(
        selection,
        'Torrent dead'
      );

      expect(nextSource).toBeDefined();
      expect(nextSource?.id).toBe(selection.fallbacks[0].id);
      expect(selection.fallbacks.length).toBe(initialFallbackCount - 1);
    });

    it('should return null when no fallbacks remain', () => {
      const request: StreamRequest = {
        contentId: 'dune-2024',
        contentType: 'movie',
        quality: mockQualityProfile,
        audioPreference: mockAudioPreferenceVF,
      };

      const selection = StreamServiceWithAudio.selectStream([mockSource1], request);
      const next = StreamServiceWithAudio.handleFailover(selection, 'Failed');

      expect(next).toBeNull();
    });
  });

  describe('describeStream - Human-Readable Output', () => {
    it('should generate readable stream description', () => {
      const request: StreamRequest = {
        contentId: 'dune-2024',
        contentType: 'movie',
        quality: mockQualityProfile,
        audioPreference: mockAudioPreferenceVF,
      };

      const selection = StreamServiceWithAudio.selectStream([mockSource1], request);
      const desc = StreamServiceWithAudio.describeStream(selection);

      expect(desc).toContain('2160p');
      expect(desc).toContain('BluRay');
      expect(desc).toContain('VF');
      expect(desc).toContain('AC3');
      expect(desc).toContain('📶');
      expect(desc).toContain('💾');
    });

    it('should include fallback indicator', () => {
      const request: StreamRequest = {
        contentId: 'dune-2024',
        contentType: 'movie',
        quality: mockQualityProfile,
        audioPreference: mockAudioPreferenceVF,
      };

      const sources = [mockSource1, mockSource2, mockSource3];
      const selection = StreamServiceWithAudio.selectStream(sources, request);
      const desc = StreamServiceWithAudio.describeStream(selection);

      expect(desc).toContain('backups');
    });
  });

  describe('getCacheKey - Cache Management', () => {
    it('should generate consistent cache key', () => {
      const request: StreamRequest = {
        contentId: 'dune-2024',
        contentType: 'movie',
        quality: mockQualityProfile,
        audioPreference: mockAudioPreferenceVF,
      };

      const key1 = StreamServiceWithAudio.getCacheKey(request);
      const key2 = StreamServiceWithAudio.getCacheKey(request);

      expect(key1).toBe(key2);
      expect(key1).toContain('dune-2024');
      expect(key1).toContain('PepitoCiné');
      expect(key1).toContain('vf-first');
    });

    it('should generate different keys for different preferences', () => {
      const request1: StreamRequest = {
        contentId: 'dune-2024',
        contentType: 'movie',
        quality: mockQualityProfile,
        audioPreference: mockAudioPreferenceVF,
      };

      const request2: StreamRequest = {
        ...request1,
        audioPreference: { priority: 'vo-first' },
      };

      const key1 = StreamServiceWithAudio.getCacheKey(request1);
      const key2 = StreamServiceWithAudio.getCacheKey(request2);

      expect(key1).not.toBe(key2);
    });
  });

  describe('enrichAudioMetadata - File Enrichment', () => {
    it('should enrich source with audio metadata', () => {
      const source = { ...mockSource1, audioTracks: [] };
      const metadata = {
        audioTracks: [
          {
            language: 'VF',
            codec: 'ac3',
            channels: '5.1',
            verified: false,
          },
        ],
      };

      const enriched = StreamServiceWithAudio.enrichAudioMetadata(source, metadata);

      expect(enriched.audioTracks).toHaveLength(1);
      expect(enriched.audioTracks[0].language).toBe('VF');
      expect(enriched.verified).toBe(true);
    });
  });

  describe('getStats - Statistics', () => {
    it('should return comprehensive stats', () => {
      const request: StreamRequest = {
        contentId: 'dune-2024',
        contentType: 'movie',
        quality: mockQualityProfile,
        audioPreference: mockAudioPreferenceVF,
      };

      const selection = StreamServiceWithAudio.selectStream([mockSource1], request);
      const stats = StreamServiceWithAudio.getStats(selection);

      expect(stats.qualityProfile).toBe('PepitoCiné');
      expect(stats.audioLanguage).toBe('VF');
      expect(stats.audioCodec).toBe('AC3');
      expect(stats.bitrate).toBeDefined();
      expect(stats.estimatedLoadTime).toBeDefined();
      expect(stats.recommendedFor).toBeDefined();
    });
  });
});
