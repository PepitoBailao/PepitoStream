# Audio Selection & Language Preferences

## Overview

PepitoStream implements an **intelligent audio selection system** that:
- ✅ Extracts audio tracks directly from files (verified, not guessed)
- ✅ Supports VF/VOSTFR/VO with smart fallback
- ✅ Scores and ranks audio quality (codec, channels, bitrate)
- ✅ Integrates with quality profiles for optimal streaming
- ✅ Handles failover if primary audio unavailable

---

## Audio Priorities

### 1. **VF First** (`vf-first`)
```
VF > VOSTFR > VO > MULTI
```

**Use case:** French users who prefer French audio when available
- Primary: VF (100% points)
- Fallback: VOSTFR (50% points)
- Last resort: VO (25% points)

### 2. **VOSTFR First** (`vostfr-first`)
```
VOSTFR > VF > VO > MULTI
```

**Use case:** Users who prefer original audio with French subtitles
- Primary: VOSTFR (100% points)
- Fallback: VF (50% points)
- Last resort: VO (25% points)

### 3. **VO First** (`vo-first`)
```
VO > VOSTFR > VF > MULTI
```

**Use case:** English speakers or original language enthusiasts
- Primary: VO (100% points)
- Fallback: VOSTFR (50% points)
- Last resort: VF (25% points)

---

## Audio Quality Scoring

Each audio track is scored 0-100 based on:

| Factor | Points | Description |
|--------|--------|-------------|
| Language Match | 40 | Primary language preference |
| Verified | 10 | Extracted from file metadata |
| Codec | 20 | Preferred codec family |
| Channels | 15 | 7.1 > 5.1 > 2.0 |
| Atmos | 15 | TrueHD Atmos, E-AC3 Atmos |

**Example Scoring:**

```
Track: VF • AC3 • 5.1 • ✓ (Verified)
With preference: vf-first

- Language (VF): 40 points
- Verified: +10 points
- Codec (AC3): +10 points (mid-tier)
- Channels (5.1): +10 points
- Atmos: 0 points

TOTAL: 70/100 ✅ Excellent
```

```
Track: VOSTFR • AAC • 2.0 (Not verified)
With preference: vf-first

- Language (VOSTFR): 20 points (fallback)
- Verified: 0 points
- Codec (AAC): +5 points (lower tier)
- Channels (2.0): +5 points
- Atmos: 0 points

TOTAL: 30/100 ⚠️ Emergency fallback
```

---

## Audio Tracks & Codecs

### Supported Languages

| Code | Full Name | Use |
|------|-----------|-----|
| `VF` | Version Française | French dub |
| `VOSTFR` | V.O. Sous-Titrée FR | Original + French subs |
| `VO` | Version Originale | Original audio (English, etc) |
| `MULTI` | Multiple | Multiple languages mixed |

### Audio Codecs (Ranked)

| Codec | Quality | Channels | Use Case |
|-------|---------|----------|----------|
| **TrueHD Atmos** | 🌟🌟🌟🌟🌟 | 7.1+ Atmos | Cinema experience |
| **DTS-HD MA** | 🌟🌟🌟🌟 | 7.1 | Blu-ray lossless |
| **FLAC** | 🌟🌟🌟🌟 | Up to 8ch | Lossless, open-source |
| **AC3** | 🌟🌟🌟 | 5.1 | Standard surround |
| **AAC** | 🌟🌟 | Stereo | Web/streaming |
| **MP3** | 🌟 | Stereo | Legacy, compressed |

### Channel Configurations

```
2.0  = Stereo (Left, Right)
5.1  = Surround (L, C, R, Ls, Rs, LFE) ← Most common
7.1  = Full Surround (5.1 + side channels)
Atmos = Height channels + spatial audio
```

---

## API Usage

### Basic Selection

```typescript
import { AudioService, AudioPreference } from './audioService';

const audioTracks = [
  { language: 'VF', codec: 'AC3', channels: '5.1', verified: true },
  { language: 'VOSTFR', codec: 'AAC', channels: '2.0', verified: true },
];

const preference: AudioPreference = {
  priority: 'vf-first',
};

const result = AudioService.selectAudioTrack(audioTracks, preference);

console.log(result.primaryTrack);     // VF • AC3 • 5.1
console.log(result.fallbackTrack);    // VOSTFR • AAC • 2.0
console.log(result.score);             // 70/100
```

### Advanced Selection

```typescript
const strictPreference: AudioPreference = {
  priority: 'vf-first',
  requireVerified: true,         // Only extracted from file
  requireMultichannel: true,      // Minimum 5.1
  requireAtmos: false,            // Optional Atmos
  excludeCodecs: ['MP3'],         // No compressed audio
  preferredCodecs: ['AC3', 'FLAC', 'DTS-HD', 'TrueHD'],
};

const result = AudioService.selectAudioTrack(audioTracks, strictPreference);
```

### Stream Selection with Audio

```typescript
import { StreamServiceWithAudio, StreamRequest } from './streamServiceWithAudio';

const request: StreamRequest = {
  contentId: 'dune-2024',
  contentType: 'movie',
  quality: QualityProfile.PepitoCiné,
  audioPreference: {
    priority: 'vf-first',
    requireVerified: true,
    requireMultichannel: true,
  },
};

const selection = StreamServiceWithAudio.selectStream(sources, request);

console.log(selection.primary.name);           // "YGG - Dune 4K"
console.log(selection.audioTrack.primary);     // VF • AC3 • 5.1 • ✓
console.log(selection.audioTrack.fallback);    // VOSTFR • AAC • 2.0
console.log(selection.totalScore);             // 85/100
```

---

## Fallback Behavior

### Scenario: VF Not Available

```
User Preference: VF First
Available Tracks: [VOSTFR, VO]

Step 1: Look for VF
  → Not found
  
Step 2: Fallback to VOSTFR (second priority)
  → Found! Use VOSTFR as primary
  
Step 3: Next fallback would be VO
  → Available as secondary fallback

Result:
  Primary:  VOSTFR
  Fallback: VO
  Reason:   "No VF found"
```

### Scenario: Multiple VF Options

```
Available Tracks:
  1. VF • AC3 • 5.1 • ✓ (verified)
  2. VF • AAC • 2.0 • ✗ (not verified)
  3. VF • MP3 • 2.0 • ✗ (compressed)

Scoring with vf-first priority:
  Track 1: 70/100 ← SELECTED (best quality)
  Track 2: 45/100
  Track 3: 40/100

Result:
  Primary:  VF • AC3 • 5.1 • ✓
  Fallback: VF • AAC • 2.0
```

---

## Integration with Quality Profiles

Audio selection works **together** with quality profiles:

```
Total Stream Score = Quality Score × 0.6 + Audio Score × 0.4
                     (60% quality)         (40% audio)
```

### Example: PepitoCiné (Max Quality)

```
Source: YGG - Dune 4K
  Quality Score: 95/100
    ✓ 4K resolution
    ✓ REMUX (best quality)
    ✓ 44 Mb/s bitrate

  Audio Score: 85/100
    ✓ VF (primary preference)
    ✓ AC3 codec (mid-high quality)
    ✓ 5.1 surround
    ✓ Verified from file

  Total: (95 × 0.6) + (85 × 0.4) = 57 + 34 = 91/100 ⭐⭐⭐
```

---

## Failover Chain

When streaming fails, PepitoStream:

1. **Tries primary source with primary audio**
   ```
   YGG • VF • AC3 • 5.1
   ```

2. **If fails, same source with fallback audio**
   ```
   YGG • VOSTFR • AAC • 2.0
   ```

3. **If still fails, next source with primary audio**
   ```
   C411 • VF • FLAC • 7.1
   ```

4. **And so on...**
   ```
   Tr4ker • VOSTFR • AC3 • 5.1
   ```

**User sees:** Nothing! Automatic switching during load.

---

## Configuration Examples

### Netflix User (VF Preferred)
```typescript
{
  priority: 'vf-first',
  requireVerified: true,
  requireMultichannel: false,  // Accept stereo
  preferredCodecs: ['AAC', 'AC3'],
}
```

### Cinephile (Best Audio)
```typescript
{
  priority: 'vf-first',
  requireVerified: true,
  requireMultichannel: true,   // 5.1 minimum
  requireAtmos: false,
  preferredCodecs: ['TrueHD', 'FLAC', 'DTS-HD', 'AC3'],
}
```

### Traveler (Low Bandwidth)
```typescript
{
  priority: 'vf-first',
  requireVerified: false,
  requireMultichannel: false,  // Stereo OK
  requireAtmos: false,
  excludeCodecs: [],
  preferredCodecs: ['AAC', 'MP3'],
}
```

### English Speaker
```typescript
{
  priority: 'vo-first',
  requireVerified: true,
  requireMultichannel: true,
  preferredCodecs: ['FLAC', 'DTS-HD', 'AC3'],
}
```

---

## Metrics & Performance

### Response Time
- **Single track selection:** < 1ms
- **Ranking 100 tracks:** < 10ms
- **Full stream ranking:** < 50ms (with caching)

### Cache Key
```
contentId:qualityProfile:audioPreference
```

Example:
```
dune-2024:PepitoCiné:vf-first
```

---

## Testing

Run tests:
```bash
npm test -- audioService.test.ts
npm test -- streamServiceWithAudio.test.ts
```

Coverage:
```
✓ Language normalization
✓ Priority logic (VF/VOSTFR/VO)
✓ Fallback chains
✓ Codec preferences
✓ Multichannel detection
✓ Atmos support
✓ Score calculation
✓ Ranking & sorting
✓ Integration with quality profiles
✓ Edge cases (empty tracks, single track, etc)
```

---

## FAQ

### Q: How does verified vs non-verified differ?
**A:** Verified means the audio track was extracted from the actual file metadata (MKV/MP4), not guessed from the torrent name. Verified tracks are more reliable.

### Q: What if no VF available?
**A:** Automatically falls back to VOSTFR (second priority), then VO. User configured via `priority` setting.

### Q: Can I require Atmos?
**A:** Yes! Set `requireAtmos: true` in preferences.

### Q: How does audio score affect stream selection?
**A:** Total score = 60% quality + 40% audio. A perfect audio track can boost a lower-quality stream.

### Q: Is failover automatic?
**A:** Yes! If primary fails, stream automatically switches to fallback audio or next source without user interaction.

---

## See Also

- [Quality Profiles](./QUALITY_PROFILES.md)
- [API Reference](./API.md)
- [Architecture](./ARCHITECTURE.md)
