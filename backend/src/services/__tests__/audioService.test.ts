import { AudioService, AudioTrack, AudioPreference, Language } from '../audioService';

describe('AudioService', () => {
  const mockVFTrack: AudioTrack = {
    language: 'VF',
    codec: 'AC3',
    channels: '5.1',
    verified: true,
  };

  const mockVOSTFRTrack: AudioTrack = {
    language: 'VOSTFR',
    codec: 'AAC',
    channels: '2.0',
    verified: true,
  };

  const mockVOTrack: AudioTrack = {
    language: 'VO',
    codec: 'FLAC',
    channels: '7.1',
    verified: true,
  };

  const mockAtmosTrack: AudioTrack = {
    language: 'VF',
    codec: 'ATMOS',
    channels: 'Atmos',
    verified: true,
  };

  const mockUnverifiedTrack: AudioTrack = {
    language: 'VF',
    codec: 'MP3',
    channels: '2.0',
    verified: false,
  };

  describe('parseAudioTracks', () => {
    it('should normalize language codes correctly', () => {
      const tracks = [
        { language: 'fr' as Language, codec: 'ac3', channels: '5.1', verified: true },
        { language: 'en' as Language, codec: 'aac', channels: '2.0', verified: true },
      ];

      const parsed = AudioService.parseAudioTracks(tracks);

      expect(parsed[0].language).toBe('VF');
      expect(parsed[1].language).toBe('VO');
    });

    it('should uppercase codec', () => {
      const tracks = [{ language: 'VF' as Language, codec: 'ac3', channels: '5.1', verified: true }];
      const parsed = AudioService.parseAudioTracks(tracks);

      expect(parsed[0].codec).toBe('AC3');
    });
  });

  describe('selectAudioTrack - VF First Priority', () => {
    it('should prefer VF over VOSTFR and VO', () => {
      const tracks = [mockVOTrack, mockVFTrack, mockVOSTFRTrack];
      const preference: AudioPreference = { priority: 'vf-first' };

      const result = AudioService.selectAudioTrack(tracks, preference);

      expect(result.primaryTrack?.language).toBe('VF');
      expect(result.fallbackTrack?.language).toBe('VOSTFR');
    });

    it('should fallback to VOSTFR when VF not available', () => {
      const tracks = [mockVOTrack, mockVOSTFRTrack];
      const preference: AudioPreference = { priority: 'vf-first' };

      const result = AudioService.selectAudioTrack(tracks, preference);

      expect(result.primaryTrack?.language).toBe('VOSTFR');
      expect(result.fallbackReason).toBe('No VF found');
    });

    it('should fallback to VO when VF and VOSTFR not available', () => {
      const tracks = [mockVOTrack];
      const preference: AudioPreference = { priority: 'vf-first' };

      const result = AudioService.selectAudioTrack(tracks, preference);

      expect(result.primaryTrack?.language).toBe('VO');
      expect(result.fallbackReason).toBe('No VF found');
    });
  });

  describe('selectAudioTrack - VOSTFR First Priority', () => {
    it('should prefer VOSTFR over VF and VO', () => {
      const tracks = [mockVOTrack, mockVFTrack, mockVOSTFRTrack];
      const preference: AudioPreference = { priority: 'vostfr-first' };

      const result = AudioService.selectAudioTrack(tracks, preference);

      expect(result.primaryTrack?.language).toBe('VOSTFR');
      expect(result.fallbackTrack?.language).toBe('VF');
    });

    it('should fallback to VF when VOSTFR not available', () => {
      const tracks = [mockVOTrack, mockVFTrack];
      const preference: AudioPreference = { priority: 'vostfr-first' };

      const result = AudioService.selectAudioTrack(tracks, preference);

      expect(result.primaryTrack?.language).toBe('VF');
      expect(result.fallbackReason).toBe('No VOSTFR found');
    });
  });

  describe('selectAudioTrack - VO First Priority', () => {
    it('should prefer VO over VF and VOSTFR', () => {
      const tracks = [mockVOTrack, mockVFTrack, mockVOSTFRTrack];
      const preference: AudioPreference = { priority: 'vo-first' };

      const result = AudioService.selectAudioTrack(tracks, preference);

      expect(result.primaryTrack?.language).toBe('VO');
    });

    it('should fallback to VOSTFR when VO not available', () => {
      const tracks = [mockVFTrack, mockVOSTFRTrack];
      const preference: AudioPreference = { priority: 'vo-first' };

      const result = AudioService.selectAudioTrack(tracks, preference);

      expect(result.primaryTrack?.language).toBe('VOSTFR');
      expect(result.fallbackReason).toBe('No VO found');
    });
  });

  describe('selectAudioTrack - Filtering & Constraints', () => {
    it('should filter out unverified tracks when required', () => {
      const tracks = [mockUnverifiedTrack, mockVFTrack];
      const preference: AudioPreference = {
        priority: 'vf-first',
        requireVerified: true,
      };

      const result = AudioService.selectAudioTrack(tracks, preference);

      expect(result.primaryTrack?.verified).toBe(true);
    });

    it('should filter out excluded codecs', () => {
      const tracks = [mockVFTrack, mockAtmosTrack];
      const preference: AudioPreference = {
        priority: 'vf-first',
        excludeCodecs: ['AC3'],
      };

      const result = AudioService.selectAudioTrack(tracks, preference);

      expect(result.primaryTrack?.codec).toBe('ATMOS');
    });

    it('should require multichannel (5.1+) when specified', () => {
      const tracks = [mockVOSTFRTrack, mockVFTrack];
      const preference: AudioPreference = {
        priority: 'vf-first',
        requireMultichannel: true,
      };

      const result = AudioService.selectAudioTrack(tracks, preference);

      expect(result.primaryTrack?.channels).not.toBe('2.0');
    });

    it('should require Atmos when specified', () => {
      const tracks = [mockVFTrack, mockAtmosTrack];
      const preference: AudioPreference = {
        priority: 'vf-first',
        requireAtmos: true,
      };

      const result = AudioService.selectAudioTrack(tracks, preference);

      expect(result.primaryTrack?.codec).toContain('ATMOS');
    });
  });

  describe('selectAudioTrack - Scoring & Ranking', () => {
    it('should score VF higher than VOSTFR with vf-first priority', () => {
      const tracks = [mockVFTrack, mockVOSTFRTrack];
      const preference: AudioPreference = { priority: 'vf-first' };

      const result = AudioService.selectAudioTrack(tracks, preference);

      expect(result.score).toBeGreaterThan(25);
      expect(result.primaryTrack?.language).toBe('VF');
    });

    it('should bonus verified tracks', () => {
      const verifiedTrack = { ...mockVFTrack, verified: true };
      const unverifiedTrack = { ...mockVFTrack, verified: false };
      const tracks = [verifiedTrack, unverifiedTrack];
      const preference: AudioPreference = { priority: 'vf-first' };

      const result = AudioService.selectAudioTrack(tracks, preference);

      expect(result.primaryTrack?.verified).toBe(true);
    });

    it('should prefer multichannel over stereo', () => {
      const stereoTrack = { ...mockVFTrack, channels: '2.0' };
      const surroundTrack = { ...mockVFTrack, channels: '5.1' };
      const tracks = [stereoTrack, surroundTrack];
      const preference: AudioPreference = { priority: 'vf-first' };

      const result = AudioService.selectAudioTrack(tracks, preference);

      expect(result.primaryTrack?.channels).toBe('5.1');
    });

    it('should prefer Atmos', () => {
      const tracks = [mockVFTrack, mockAtmosTrack];
      const preference: AudioPreference = { priority: 'vf-first' };

      const result = AudioService.selectAudioTrack(tracks, preference);

      expect(result.primaryTrack?.codec).toContain('ATMOS');
    });

    it('should respect codec preferences', () => {
      const tracks = [mockVFTrack, mockAtmosTrack];
      const preference: AudioPreference = {
        priority: 'vf-first',
        preferredCodecs: ['AC3', 'ATMOS'],
      };

      const result = AudioService.selectAudioTrack(tracks, preference);

      // AC3 should be preferred over ATMOS based on preference order
      expect(result.primaryTrack?.codec).toBe('AC3');
    });
  });

  describe('selectAudioTrack - Edge Cases', () => {
    it('should handle empty track list', () => {
      const preference: AudioPreference = { priority: 'vf-first' };
      const result = AudioService.selectAudioTrack([], preference);

      expect(result.primaryTrack).toBeNull();
      expect(result.fallbackTrack).toBeNull();
      expect(result.allTracks).toHaveLength(0);
    });

    it('should handle single track', () => {
      const preference: AudioPreference = { priority: 'vf-first' };
      const result = AudioService.selectAudioTrack([mockVFTrack], preference);

      expect(result.primaryTrack).toBe(mockVFTrack);
      expect(result.fallbackTrack).toBeNull();
    });

    it('should handle multiple fallback options', () => {
      const tracks = [
        { ...mockVFTrack, language: 'VOSTFR' as Language },
        { ...mockVFTrack, language: 'VO' as Language },
        { ...mockVFTrack, language: 'MULTI' as Language },
      ];
      const preference: AudioPreference = { priority: 'vf-first' };

      const result = AudioService.selectAudioTrack(tracks, preference);

      expect(result.primaryTrack?.language).toBe('VOSTFR');
      expect(result.fallbackTrack?.language).toBe('VO');
    });
  });

  describe('describeAudio', () => {
    it('should return human-readable description', () => {
      const desc = AudioService.describeAudio(mockVFTrack);

      expect(desc).toContain('VF');
      expect(desc).toContain('AC3');
      expect(desc).toContain('5.1');
      expect(desc).toContain('✓');
    });

    it('should include Atmos in description', () => {
      const desc = AudioService.describeAudio(mockAtmosTrack);

      expect(desc).toContain('Atmos');
    });
  });

  describe('compareTracks', () => {
    it('should return better track based on preference', () => {
      const preference: AudioPreference = { priority: 'vf-first' };
      const better = AudioService.compareTracks(mockVFTrack, mockVOSTFRTrack, preference);

      expect(better).toBe(mockVFTrack);
    });

    it('should consider channel quality', () => {
      const stereo = { ...mockVFTrack, channels: '2.0' };
      const surround = { ...mockVFTrack, channels: '7.1' };
      const preference: AudioPreference = { priority: 'vf-first' };

      const better = AudioService.compareTracks(stereo, surround, preference);

      expect(better).toBe(surround);
    });
  });
});
