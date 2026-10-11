# Audio Selection API

Complete API reference for audio selection and stream ranking with audio.

---

## Endpoints

### 1. Stream Search with Audio Preferences

**Endpoint:** `POST /api/v1/streams/search`

Select best stream based on quality profile and audio preference.

**Request:**
```json
{
  "contentId": "dune-2024",
  "contentType": "movie",
  "qualityProfile": "PepitoCiné",
  "audioPreference": {
    "priority": "vf-first",
    "requireVerified": true,
    "requireMultichannel": false,
    "requireAtmos": false,
    "excludeCodecs": [],
    "preferredCodecs": ["AC3", "FLAC", "DTS-HD", "TrueHD"]
  }
}
```

**Response (200 OK):**
```json
{
  "primary": {
    "id": "ygg-dune-4k",
    "name": "YGG - Dune Part Two 4K",
    "url": "magnet:?xt=urn:btih:abc123",
    "tracker": "YGG",
    "quality": "2160p",
    "release": "BluRay REMUX",
    "fileSize": 57982058496,
    "bitrate": 44,
    "codec": "HEVC",
    "verified": true,
    "latency": 150,
    "audioTracks": [
      {
        "language": "VF",
        "codec": "AC3",
        "channels": "5.1",
        "verified": true,
        "default": true
      },
      {
        "language": "VOSTFR",
        "codec": "AAC",
        "channels": "2.0",
        "verified": true
      }
    ]
  },
  "fallbacks": [
    {
      "id": "c411-dune-4k",
      "name": "C411 - Dune Part Two 4K",
      "quality": "2160p",
      "audioTracks": [...]
    },
    {
      "id": "tr4ker-dune-1080p",
      "name": "Tr4ker - Dune Part Two 1080p",
      "quality": "1080p",
      "audioTracks": [...]
    }
  ],
  "audioTrack": {
    "primary": {
      "language": "VF",
      "codec": "AC3",
      "channels": "5.1",
      "verified": true
    },
    "fallback": {
      "language": "VOSTFR",
      "codec": "AAC",
      "channels": "2.0",
      "verified": true
    }
  },
  "qualityProfile": {
    "name": "PepitoCiné",
    "priority": 95
  },
  "totalScore": 92,
  "estimatedLoadTime": 3.5,
  "description": "2160p • BluRay REMUX • VF • AC3 • 5.1 • ✓ • 💾 54.2 GB • 📶 44 Mb/s • [2 backups]"
}
```

---

### 2. Rank All Available Streams

**Endpoint:** `POST /api/v1/streams/rank`

Get detailed ranking of all available streams with scores.

**Request:**
```json
{
  "contentId": "dune-2024",
  "contentType": "movie",
  "qualityProfile": "PepitoCiné",
  "audioPreference": {
    "priority": "vf-first",
    "requireVerified": true
  }
}
```

**Response (200 OK):**
```json
{
  "ranking": [
    {
      "rank": 1,
      "source": {
        "id": "ygg-dune-4k",
        "name": "YGG - Dune Part Two 4K",
        "quality": "2160p",
        "bitrate": 44
      },
      "qualityScore": 95,
      "audioScore": 85,
      "totalScore": 92,
      "audioAnalysis": {
        "primaryTrack": {
          "language": "VF",
          "codec": "AC3",
          "channels": "5.1",
          "verified": true
        },
        "fallbackTrack": {
          "language": "VOSTFR",
          "codec": "AAC",
          "channels": "2.0",
          "verified": true
        },
        "score": 85
      },
      "description": "2160p • BluRay REMUX • VF • AC3 • 5.1 • ✓ • 54.2 GB • 44 Mb/s"
    },
    {
      "rank": 2,
      "source": {
        "id": "c411-dune-4k",
        "name": "C411 - Dune Part Two 4K",
        "quality": "2160p",
        "bitrate": 42
      },
      "qualityScore": 92,
      "audioScore": 60,
      "totalScore": 82,
      "audioAnalysis": {
        "primaryTrack": {
          "language": "VO",
          "codec": "FLAC",
          "channels": "7.1",
          "verified": true
        },
        "fallbackTrack": null,
        "score": 60,
        "fallbackReason": "No VF or VOSTFR available"
      },
      "description": "2160p • BluRay REMUX • VO • FLAC • 7.1 • ✓ • 54.2 GB • 42 Mb/s"
    },
    {
      "rank": 3,
      "source": {
        "id": "tr4ker-dune-1080p",
        "name": "Tr4ker - Dune Part Two 1080p",
        "quality": "1080p",
        "bitrate": 15
      },
      "qualityScore": 65,
      "audioScore": 85,
      "totalScore": 75,
      "audioAnalysis": {
        "primaryTrack": {
          "language": "VF",
          "codec": "AC3",
          "channels": "5.1",
          "verified": true
        },
        "fallbackTrack": null,
        "score": 85
      },
      "description": "1080p • WEB-DL • VF • AC3 • 5.1 • ✓ • 8 GB • 15 Mb/s"
    }
  ],
  "bestRecommendation": "YGG - Dune Part Two 4K (92/100)",
  "estimatedLoadTimes": {
    "rank1": 3.5,
    "rank2": 3.8,
    "rank3": 0.9
  }
}
```

---

### 3. Get Audio Tracks for Source

**Endpoint:** `GET /api/v1/streams/:streamId/audio-tracks`

Get all audio tracks available for a specific stream.

**Response (200 OK):**
```json
{
  "streamId": "ygg-dune-4k",
  "streamName": "YGG - Dune Part Two 4K",
  "audioTracks": [
    {
      "id": "audio-1",
      "language": "VF",
      "codec": "AC3",
      "channels": "5.1",
      "bitrate": 384,
      "verified": true,
      "default": true,
      "description": "VF • AC3 • 5.1 • ✓"
    },
    {
      "id": "audio-2",
      "language": "VOSTFR",
      "codec": "AAC",
      "channels": "2.0",
      "bitrate": 128,
      "verified": true,
      "default": false,
      "description": "VOSTFR • AAC • 2.0 • ✓"
    },
    {
      "id": "audio-3",
      "language": "VO",
      "codec": "FLAC",
      "channels": "7.1",
      "bitrate": 768,
      "verified": false,
      "default": false,
      "description": "VO • FLAC • 7.1"
    }
  ],
  "count": 3
}
```

---

### 4. Select Audio for Stream

**Endpoint:** `POST /api/v1/streams/:streamId/select-audio`

Select specific audio track for streaming.

**Request:**
```json
{
  "audioPreference": {
    "priority": "vf-first",
    "requireVerified": true,
    "requireMultichannel": true,
    "preferredCodecs": ["AC3", "FLAC", "DTS-HD"]
  }
}
```

**Response (200 OK):**
```json
{
  "streamId": "ygg-dune-4k",
  "primaryTrack": {
    "id": "audio-1",
    "language": "VF",
    "codec": "AC3",
    "channels": "5.1",
    "verified": true,
    "description": "VF • AC3 • 5.1 • ✓"
  },
  "fallbackTrack": {
    "id": "audio-2",
    "language": "VOSTFR",
    "codec": "AAC",
    "channels": "2.0",
    "verified": true,
    "description": "VOSTFR • AAC • 2.0 • ✓"
  },
  "score": 85,
  "recommendation": "Excellent audio choice"
}
```

---

### 5. Compare Audio Preferences

**Endpoint:** `POST /api/v1/audio/compare-preferences`

Compare how different audio preferences would rank the same sources.

**Request:**
```json
{
  "streamId": "ygg-dune-4k",
  "preferences": [
    {
      "name": "VF First",
      "config": { "priority": "vf-first" }
    },
    {
      "name": "VOSTFR First",
      "config": { "priority": "vostfr-first" }
    },
    {
      "name": "VO First",
      "config": { "priority": "vo-first" }
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "streamId": "ygg-dune-4k",
  "availableAudio": ["VF", "VOSTFR", "VO"],
  "comparisonResults": [
    {
      "preference": "VF First",
      "primaryTrack": {
        "language": "VF",
        "codec": "AC3",
        "channels": "5.1"
      },
      "score": 85,
      "ranking": 1
    },
    {
      "preference": "VOSTFR First",
      "primaryTrack": {
        "language": "VOSTFR",
        "codec": "AAC",
        "channels": "2.0"
      },
      "score": 65,
      "ranking": 2
    },
    {
      "preference": "VO First",
      "primaryTrack": {
        "language": "VO",
        "codec": "FLAC",
        "channels": "7.1"
      },
      "score": 45,
      "ranking": 3
    }
  ]
}
```

---

### 6. Failover to Next Source

**Endpoint:** `POST /api/v1/streams/failover`

Switch to next available source/audio when current fails.

**Request:**
```json
{
  "currentStreamId": "ygg-dune-4k",
  "failureReason": "Torrent dead",
  "fallbacks": [
    "c411-dune-4k",
    "tr4ker-dune-1080p"
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "nextSource": {
    "id": "c411-dune-4k",
    "name": "C411 - Dune Part Two 4K",
    "quality": "2160p",
    "audioTracks": [...]
  },
  "message": "Switched to next source",
  "previousFailure": "Torrent dead",
  "fallbacksRemaining": 1
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "message": "No more fallbacks available",
  "recommendation": "Show user alternatives or offer different quality profile"
}
```

---

### 7. Get Stream Statistics

**Endpoint:** `GET /api/v1/streams/:streamId/stats`

Get detailed statistics about a stream and its audio.

**Response (200 OK):**
```json
{
  "streamId": "ygg-dune-4k",
  "streamName": "YGG - Dune Part Two 4K",
  "statistics": {
    "qualityProfile": "PepitoCiné",
    "primarySource": "YGG - Dune Part Two 4K",
    "fallbackCount": 2,
    "audioLanguage": "VF",
    "audioCodec": "AC3",
    "audioChannels": "5.1",
    "fileSize": "54.2 GB",
    "bitrate": "44 Mb/s",
    "estimatedLoadTime": "3.5s",
    "totalScore": 92,
    "recommendedFor": "🎬 Best quality, enjoy!"
  },
  "audioStats": {
    "availableLanguages": ["VF", "VOSTFR", "VO"],
    "bestCodec": "AC3",
    "highestChannels": "7.1",
    "verifiedTracks": 2,
    "unverifiedTracks": 1
  }
}
```

---

## Audio Preference Schema

```typescript
interface AudioPreference {
  priority: 'vf-first' | 'vostfr-first' | 'vo-first';
  maxSize?: number;                    // in GB
  requireMultichannel?: boolean;       // require 5.1+
  requireAtmos?: boolean;
  requireVerified?: boolean;           // extract from file only
  excludeCodecs?: string[];            // ['MP3', 'AAC']
  preferredCodecs?: string[];          // ['AC3', 'FLAC', 'DTS-HD']
}
```

---

## Audio Track Schema

```typescript
interface AudioTrack {
  language: 'VF' | 'VOSTFR' | 'VO' | 'MULTI' | 'UNKNOWN';
  codec: string;                       // AC3, AAC, FLAC, TrueHD, DTS-HD
  channels: string;                    // 2.0, 5.1, 7.1, Atmos
  bitrate?: number;                    // in kbps
  default?: boolean;
  verified?: boolean;                  // extracted from file
}
```

---

## Stream Selection Schema

```typescript
interface StreamSelection {
  primary: StreamSource;
  fallbacks: StreamSource[];
  audioTrack: {
    primary: AudioTrack;
    fallback: AudioTrack | null;
  };
  qualityProfile: QualityProfile;
  totalScore: number;                  // 0-100
  estimatedLoadTime: number;           // in seconds
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid audio preference",
  "details": "requireMultichannel requires Atmos or 5.1+ channel support",
  "code": "INVALID_PREFERENCE"
}
```

### 404 Not Found
```json
{
  "error": "Stream not found",
  "streamId": "invalid-id",
  "code": "STREAM_NOT_FOUND"
}
```

### 422 Unprocessable Entity
```json
{
  "error": "No sources meet quality threshold",
  "minScore": 30,
  "maxFound": 15,
  "suggestion": "Lower quality profile or audio requirements",
  "code": "NO_VIABLE_SOURCES"
}
```

---

## Query Parameters

All `POST` endpoints also support these query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `includeStats` | boolean | false | Include detailed statistics |
| `includeFallbacks` | boolean | true | Include fallback options |
| `maxFallbacks` | number | 3 | Maximum fallbacks to return |
| `cacheKey` | string | auto | Custom cache key |
| `useCached` | boolean | true | Use cached results |

---

## Rate Limiting

- **Unauth:** 10 requests/minute
- **Authenticated:** 100 requests/minute
- **Premium:** Unlimited

Header response:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1665432000
```

---

## Caching

Results are cached with key:
```
contentId:qualityProfile:audioPreference
```

Example:
```
dune-2024:PepitoCiné:vf-first
```

Cache TTL: **5 minutes** (configurable)

---

## Examples

### cURL - Select Best Stream

```bash
curl -X POST https://api.pepitostream.com/api/v1/streams/search \
  -H "Content-Type: application/json" \
  -d '{
    "contentId": "dune-2024",
    "contentType": "movie",
    "qualityProfile": "PepitoCiné",
    "audioPreference": {
      "priority": "vf-first",
      "requireVerified": true
    }
  }'
```

### JavaScript - Rank Sources

```javascript
const response = await fetch('/api/v1/streams/rank', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contentId: 'dune-2024',
    contentType: 'movie',
    qualityProfile: 'PepitoCiné',
    audioPreference: { priority: 'vf-first' }
  })
});

const data = await response.json();
console.log('Top source:', data.ranking[0].source.name);
console.log('Audio quality:', data.ranking[0].audioScore);
```

---

## See Also

- [Audio Selection Guide](./AUDIO_SELECTION.md)
- [Quality Profiles](./QUALITY_PROFILES.md)
- [Architecture](./ARCHITECTURE.md)
