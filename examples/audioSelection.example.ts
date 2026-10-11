/**
 * Audio Selection Examples
 * Real-world usage scenarios
 */

import { AudioService, AudioPreference } from '../backend/src/services/audioService';
import { StreamServiceWithAudio, StreamRequest } from '../backend/src/services/streamServiceWithAudio';
import { QualityProfileService, QualityProfile } from '../backend/src/services/qualityProfiles';

// ============================================================================
// EXAMPLE 1: Simple Audio Selection
// ============================================================================

console.log('\n=== EXAMPLE 1: Simple Audio Selection ===\n');

const audioTracks = [
  {
    language: 'VF' as const,
    codec: 'AC3',
    channels: '5.1',
    verified: true,
    default: true,
  },
  {
    language: 'VOSTFR' as const,
    codec: 'AAC',
    channels: '2.0',
    verified: true,
  },
  {
    language: 'VO' as const,
    codec: 'FLAC',
    channels: '7.1',
    verified: true,
  },
];

// User prefers VF, but will accept fallbacks
const vfPreference: AudioPreference = {
  priority: 'vf-first',
};

const result = AudioService.selectAudioTrack(audioTracks, vfPreference);

console.log('📌 User Preference: VF First');
console.log('✓ Primary Audio:', AudioService.describeAudio(result.primaryTrack!));
console.log('↪️ Fallback Audio:', result.fallbackTrack ? AudioService.describeAudio(result.fallbackTrack) : 'None');
console.log('📊 Score:', result.score + '/100');

// ============================================================================
// EXAMPLE 2: Fallback When Primary Not Available
// ============================================================================

console.log('\n=== EXAMPLE 2: Fallback When Primary Not Available ===\n');

const limitedTracks = [
  {
    language: 'VOSTFR' as const,
    codec: 'AAC',
    channels: '2.0',
    verified: true,
  },
  {
    language: 'VO' as const,
    codec: 'FLAC',
    channels: '7.1',
    verified: true,
  },
];

const result2 = AudioService.selectAudioTrack(limitedTracks, vfPreference);

console.log('📌 User Preference: VF First');
console.log('⚠️ Fallback Reason:', result2.fallbackReason);
console.log('✓ Selected Audio:', AudioService.describeAudio(result2.primaryTrack!));
console.log('📊 Score:', result2.score + '/100');

// ============================================================================
// EXAMPLE 3: Strict Audio Requirements
// ============================================================================

console.log('\n=== EXAMPLE 3: Strict Audio Requirements (Cinephile) ===\n');

const strictPreference: AudioPreference = {
  priority: 'vf-first',
  requireVerified: true,        // Only from file metadata
  requireMultichannel: true,    // 5.1 minimum
  requireAtmos: false,
  excludeCodecs: ['MP3', 'AAC'],
  preferredCodecs: ['TrueHD', 'FLAC', 'DTS-HD', 'AC3'],
};

const cinephileAudioTracks = [
  {
    language: 'VF' as const,
    codec: 'TrueHD',
    channels: 'Atmos',
    verified: true,
  },
  {
    language: 'VF' as const,
    codec: 'AC3',
    channels: '5.1',
    verified: true,
  },
  {
    language: 'VF' as const,
    codec: 'AAC',
    channels: '2.0',
    verified: true,
  },
];

const result3 = AudioService.selectAudioTrack(cinephileAudioTracks, strictPreference);

console.log('🎬 Cinephile Preference: VF + Verified + 5.1+ + Good Codec');
console.log('✓ Primary Audio:', AudioService.describeAudio(result3.primaryTrack!));
console.log('↪️ Fallback Audio:', result3.fallbackTrack ? AudioService.describeAudio(result3.fallbackTrack) : 'None');
console.log('📊 Score:', result3.score + '/100');

// ============================================================================
// EXAMPLE 4: Full Stream Selection with Audio
// ============================================================================

console.log('\n=== EXAMPLE 4: Full Stream Selection with Audio ===\n');

const mockSources = [
  {
    id: 'ygg-4k',
    name: 'YGG - Dune Part Two 4K',
    url: 'magnet:?xt=urn:btih:abc123',
    torrentHash: 'abc123',
    tracker: 'YGG',
    fileSize: 54 * 1024 * 1024 * 1024,
    bitrate: 44,
    audioTracks: [
      { language: 'VF' as const, codec: 'AC3', channels: '5.1', verified: true },
      { language: 'VOSTFR' as const, codec: 'AAC', channels: '2.0', verified: true },
    ],
    quality: '2160p',
    release: 'BluRay REMUX',
    codec: 'HEVC',
    verified: true,
    latency: 150,
  },
  {
    id: 'c411-4k',
    name: 'C411 - Dune Part Two 4K',
    url: 'magnet:?xt=urn:btih:def456',
    torrentHash: 'def456',
    tracker: 'C411',
    fileSize: 54 * 1024 * 1024 * 1024,
    bitrate: 42,
    audioTracks: [
      { language: 'VO' as const, codec: 'FLAC', channels: '7.1', verified: true },
    ],
    quality: '2160p',
    release: 'BluRay REMUX',
    codec: 'HEVC',
    verified: true,
    latency: 200,
  },
  {
    id: 'tr4ker-1080p',
    name: 'Tr4ker - Dune Part Two 1080p',
    url: 'magnet:?xt=urn:btih:ghi789',
    torrentHash: 'ghi789',
    tracker: 'Tr4ker',
    fileSize: 8 * 1024 * 1024 * 1024,
    bitrate: 15,
    audioTracks: [
      { language: 'VF' as const, codec: 'AC3', channels: '5.1', verified: true },
    ],
    quality: '1080p',
    release: 'WEB-DL',
    codec: 'H264',
    verified: true,
    latency: 100,
  },
];

const streamRequest: StreamRequest = {
  contentId: 'dune-2024',
  contentType: 'movie',
  quality: QualityProfileService.profiles.PepitoCiné,
  audioPreference: vfPreference,
};

const streamSelection = StreamServiceWithAudio.selectStream(mockSources, streamRequest);

console.log('🎬 Movie: Dune Part Two');
console.log('📊 Quality Profile: PepitoCiné (Max Quality)');
console.log('🎙️ Audio Preference: VF First');
console.log('\n✓ Selected Stream:');
console.log('   Source:', streamSelection.primary.name);
console.log('   Description:', StreamServiceWithAudio.describeStream(streamSelection));
console.log('   Total Score:', streamSelection.totalScore + '/100');
console.log('\n📋 Statistics:');
const stats = StreamServiceWithAudio.getStats(streamSelection);
Object.entries(stats).forEach(([key, value]) => {
  console.log(`   ${key}: ${value}`);
});

// ============================================================================
// EXAMPLE 5: Ranking All Sources
// ============================================================================

console.log('\n=== EXAMPLE 5: Ranking All Available Sources ===\n');

const ranking = StreamServiceWithAudio.rankSources(mockSources, streamRequest);

console.log('📊 Available Sources Ranked:\n');
ranking.forEach((candidate, index) => {
  console.log(`${index + 1}. ${candidate.source.name}`);
  console.log(`   Quality: ${candidate.qualityScore.toFixed(0)}/100`);
  console.log(`   Audio: ${candidate.audioScore.toFixed(0)}/100`);
  console.log(`   Total: ${candidate.totalScore.toFixed(0)}/100`);
  console.log(`   Audio: ${AudioService.describeAudio(candidate.audioAnalysis.primaryTrack)}`);
  console.log('');
});

// ============================================================================
// EXAMPLE 6: Failover Scenario
// ============================================================================

console.log('\n=== EXAMPLE 6: Failover Scenario ===\n');

let selection = StreamServiceWithAudio.selectStream(mockSources, streamRequest);

console.log('🎬 Starting playback...');
console.log('Primary Source:', selection.primary.name);
console.log('Audio Track:', AudioService.describeAudio(selection.audioTrack.primary));

// Simulate failure
console.log('\n❌ Playback failed! (Torrent dead)');

const nextSource = StreamServiceWithAudio.handleFailover(selection, 'Torrent dead');

if (nextSource) {
  console.log('✓ Failover activated!');
  console.log('Switching to:', nextSource.name);
} else {
  console.log('⚠️ No more fallbacks available');
}

// ============================================================================
// EXAMPLE 7: Language Preference Comparison
// ============================================================================

console.log('\n=== EXAMPLE 7: Language Preference Comparison ===\n');

const testTracks = [
  { language: 'VF' as const, codec: 'AC3', channels: '5.1', verified: true },
  { language: 'VOSTFR' as const, codec: 'FLAC', channels: '7.1', verified: true },
  { language: 'VO' as const, codec: 'AAC', channels: '2.0', verified: true },
];

const preferences = [
  { name: 'VF First', pref: { priority: 'vf-first' } as AudioPreference },
  { name: 'VOSTFR First', pref: { priority: 'vostfr-first' } as AudioPreference },
  { name: 'VO First', pref: { priority: 'vo-first' } as AudioPreference },
];

preferences.forEach(({ name, pref }) => {
  const res = AudioService.selectAudioTrack(testTracks, pref);
  console.log(`${name}:`);
  console.log(`  ✓ ${AudioService.describeAudio(res.primaryTrack!)}`);
  console.log(`  ↪️  ${AudioService.describeAudio(res.fallbackTrack!)}`);
  console.log(`  Score: ${res.score}/100\n`);
});

// ============================================================================
// EXAMPLE 8: Cache Key Generation
// ============================================================================

console.log('\n=== EXAMPLE 8: Cache Key Generation ===\n');

const cacheKey1 = StreamServiceWithAudio.getCacheKey(streamRequest);
console.log('Cache Key:', cacheKey1);
console.log('Used for:', 'Fast lookup of previous selections');

// ============================================================================
// EXAMPLE 9: Human Descriptions
// ============================================================================

console.log('\n=== EXAMPLE 9: Human-Readable Descriptions ===\n');

const descriptions = [
  AudioService.describeAudio({
    language: 'VF',
    codec: 'AC3',
    channels: '5.1',
    verified: true,
  }),
  AudioService.describeAudio({
    language: 'VOSTFR',
    codec: 'FLAC',
    channels: '7.1',
    verified: true,
  }),
  AudioService.describeAudio({
    language: 'VO',
    codec: 'TrueHD',
    channels: 'Atmos',
    verified: true,
  }),
];

descriptions.forEach((desc, i) => {
  console.log(`Track ${i + 1}: ${desc}`);
});

// ============================================================================
// EXAMPLE 10: Comparing Tracks
// ============================================================================

console.log('\n=== EXAMPLE 10: Comparing Two Tracks ===\n');

const track1 = {
  language: 'VF' as const,
  codec: 'AC3',
  channels: '5.1',
  verified: true,
};

const track2 = {
  language: 'VF' as const,
  codec: 'AAC',
  channels: '2.0',
  verified: true,
};

const pref: AudioPreference = { priority: 'vf-first' };
const better = AudioService.compareTracks(track1, track2, pref);

console.log('Track 1:', AudioService.describeAudio(track1));
console.log('Track 2:', AudioService.describeAudio(track2));
console.log('Better:', AudioService.describeAudio(better));

console.log('\n✅ All examples completed!');
