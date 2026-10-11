# PepitoStream API Documentation

## 📚 Table of Contents
1. [Base URL](#base-url)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Endpoints](#endpoints)
5. [Examples](#examples)
6. [Rate Limiting](#rate-limiting)
7. [Performance](#performance)

---

## Base URL

```
https://api.pepito-stream.com/api/v1
```

All endpoints require the prefix `/api/v1`

---

## Authentication

Currently no authentication required. Rate limiting is applied per IP address.

Future versions will support:
- API Keys
- OAuth2
- JWT Bearer tokens

---

## Error Handling

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {},
    "timestamp": "2026-10-11T17:52:00Z",
    "requestId": "abc123def456",
    "path": "/api/v1/streams/search",
    "method": "GET",
    "statusCode": 400
  }
}
```

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `BAD_REQUEST` | 400 | Invalid parameters |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `SEARCH_ERROR` | 500 | Search service error |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

---

## Endpoints

### Search Endpoints

#### 1. Search Streams
```
GET /streams/search
```

**Description:** Search for streams with fuzzy/exact/autocomplete matching

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | ✓ | - | Search term (min 1 char) |
| `type` | string | | `fuzzy` | Search type: `fuzzy`, `exact`, `autocomplete` |
| `limit` | number | | `10` | Results count (1-100) |
| `offset` | number | | `0` | Pagination offset |
| `sortBy` | string | | `relevance` | Sort by: `relevance`, `popularity`, `rating` |

**Response:**
```json
{
  "query": "breaking bad",
  "type": "fuzzy",
  "totalResults": 42,
  "results": [
    {
      "id": "tt0903747",
      "title": "Breaking Bad",
      "type": "series",
      "season": null,
      "episode": null,
      "rating": 9.5,
      "relevanceScore": 99
    }
  ],
  "processingTime": 45,
  "cacheHit": false
}
```

**Example:**
```bash
curl "https://api.pepito-stream.com/api/v1/streams/search?query=breaking%20bad&type=fuzzy&limit=10"
```

---

#### 2. Bulk Search
```
POST /streams/search/bulk
```

**Description:** Search multiple queries in one request

**Request Body:**
```json
{
  "queries": ["Breaking Bad", "Game of Thrones", "Stranger Things"],
  "limit": 10,
  "type": "fuzzy"
}
```

**Response:**
```json
{
  "queries": [
    {
      "query": "Breaking Bad",
      "results": {
        "totalResults": 42,
        "results": [...]
      }
    }
  ],
  "totalProcessingTime": 120
}
```

**Constraints:**
- Maximum 50 queries per request
- Returns error if exceeded

**Example:**
```bash
curl -X POST "https://api.pepito-stream.com/api/v1/streams/search/bulk" \
  -H "Content-Type: application/json" \
  -d '{
    "queries": ["Breaking Bad", "Game of Thrones"],
    "limit": 5
  }'
```

---

#### 3. Autocomplete
```
GET /streams/autocomplete
```

**Description:** Get autocomplete suggestions

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | ✓ | - | Query start (min 1 char) |
| `limit` | number | | `10` | Suggestions count (max 50) |

**Response:**
```json
{
  "suggestions": [
    "Breaking Bad",
    "Breaking Point",
    "Breaking Glass",
    "Breaking Dawn"
  ]
}
```

**Example:**
```bash
curl "https://api.pepito-stream.com/api/v1/streams/autocomplete?q=break&limit=5"
```

---

### Stream Details

#### 4. Get Stream
```
GET /streams/:id
```

**Description:** Get complete stream details with quality and audio

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | ✓ | Stream ID (IMDb ID, etc.) |

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `preferredLanguage` | string | | `vf` | Preferred: `vf`, `vostfr`, `vo` |
| `preferredQuality` | string | | `Pepito` | Quality: `PepitoCiné`, `PepitoDuVoyage`, `Pepito`, `PepitoMacqueen` |
| `maxLatency` | number | | `10000` | Max latency in ms |

**Response:**
```json
{
  "id": "tt0903747",
  "title": "Breaking Bad",
  "type": "series",
  "season": 1,
  "episode": 1,
  "rating": 9.5,
  "popularity": 98,
  
  "quality": {
    "profile": "Pepito",
    "resolution": "1080p",
    "codec": "H.265",
    "bitrate": 8,
    "score": 85
  },
  
  "audio": {
    "language": "fr",
    "type": "vf",
    "codec": "AC3",
    "channels": "5.1",
    "score": 90,
    "isDefault": true
  },
  
  "file": {
    "filename": "Breaking.Bad.S01E01.Pilot.1080p.BluRay.x265-GroupName.mkv",
    "size": 1658821632,
    "resolution": "1080p",
    "codec": "H.265",
    "audioTracks": [
      {
        "language": "fr",
        "type": "vf",
        "codec": "AC3",
        "channels": "5.1",
        "bitrate": 448
      },
      {
        "language": "en",
        "type": "vo",
        "codec": "AC3",
        "channels": "5.1",
        "bitrate": 640
      }
    ]
  },
  
  "sources": [
    {
      "id": "source1",
      "tracker": "YGG",
      "seeders": 150,
      "peers": 45,
      "latency": 50,
      "score": 95,
      "status": "online"
    }
  ],
  
  "failoverSources": [
    {
      "id": "source2",
      "tracker": "C411",
      "seeders": 80,
      "peers": 20,
      "latency": 120,
      "score": 85,
      "status": "online"
    }
  ],
  
  "estimatedPlayTime": 342,
  "cacheHitRate": 75
}
```

**Example:**
```bash
curl "https://api.pepito-stream.com/api/v1/streams/tt0903747?preferredLanguage=vf&preferredQuality=PepitoCiné"
```

---

#### 5. Get Sources
```
GET /streams/:id/sources
```

**Description:** Get all available sources for a stream

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sortBy` | string | | `latency` | Sort by: `latency`, `seeders`, `score` |

**Response:**
```json
{
  "id": "tt0903747",
  "sources": [
    {
      "id": "source1",
      "tracker": "YGG",
      "magnet": "magnet:?xt=urn:...",
      "seeders": 150,
      "peers": 45,
      "latency": 50,
      "score": 95,
      "status": "online"
    }
  ],
  "totalSources": 25
}
```

**Example:**
```bash
curl "https://api.pepito-stream.com/api/v1/streams/tt0903747/sources?sortBy=seeders"
```

---

#### 6. Get Audio Tracks
```
GET /streams/:id/audio
```

**Description:** Get all audio tracks available

**Response:**
```json
{
  "id": "tt0903747",
  "audioTracks": [
    {
      "language": "fr",
      "type": "vf",
      "codec": "AC3",
      "channels": "5.1",
      "bitrate": 448,
      "score": 90,
      "isDefault": true
    },
    {
      "language": "en",
      "type": "vo",
      "codec": "DTS",
      "channels": "7.1",
      "bitrate": 768,
      "score": 95,
      "isDefault": false
    }
  ]
}
```

---

#### 7. Compare Profiles
```
GET /streams/:id/compare
```

**Description:** Compare all quality profiles for a stream

**Response:**
```json
{
  "id": "tt0903747",
  "profiles": [
    {
      "name": "PepitoCiné",
      "quality": {
        "profile": "PepitoCiné",
        "resolution": "4K",
        "codec": "H.265",
        "bitrate": 25,
        "score": 99
      },
      "audio": {
        "language": "fr",
        "type": "vf",
        "codec": "TrueHD",
        "channels": "Atmos",
        "score": 95
      }
    },
    {
      "name": "Pepito",
      "quality": {...},
      "audio": {...}
    }
  ]
}
```

---

### Health & Monitoring

#### 8. Health Check
```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-10-11T17:52:00Z",
  "uptime": 86400
}
```

---

#### 9. Detailed Health
```
GET /health/detailed
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-10-11T17:52:00Z",
  "uptime": 86400,
  "responseTime": "45ms",
  "services": {
    "cache": {
      "status": "ok",
      "itemsCount": 5000,
      "hitRate": "92.15%"
    },
    "search": {
      "status": "ok"
    },
    "quality": {
      "status": "ok",
      "availableProfiles": 4
    },
    "audio": {
      "status": "ok",
      "availableLanguages": 3
    }
  }
}
```

---

#### 10. Metrics
```
GET /health/metrics
```

**Response:**
```json
{
  "timestamp": "2026-10-11T17:52:00Z",
  "memory": {
    "total": "16384 MB",
    "free": "8192 MB",
    "used": "8192 MB",
    "usedPercent": "50%"
  },
  "cache": {
    "totalItems": 5000,
    "hitRate": 92.15,
    "missRate": 7.85,
    "avgAccessTime": 1.2
  },
  "nodejs": {
    "version": "v18.0.0",
    "uptime": "86400s",
    "pid": 12345
  }
}
```

---

## Rate Limiting

### Limits

| Type | Limit | Window |
|------|-------|--------|
| Requests | 60 | 1 minute |
| Requests | 1000 | 1 hour |
| Block duration | 15 minutes | After exceeded |

### Headers

All responses include rate limit headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1602430320
```

### Status Code

When rate limit exceeded:
```
HTTP 429 Too Many Requests
```

Response:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "limit": 60,
    "window": "1 minute"
  }
}
```

---

## Performance

### Response Times

| Endpoint | Target | Status |
|----------|--------|--------|
| Search (cached) | <2ms | ✅ |
| Search (fresh) | <10ms | ✅ |
| Get Stream | <10ms | ✅ |
| Get Sources | <5ms | ✅ |
| Health | <5ms | ✅ |

### Caching Strategy

| Endpoint | TTL | Cache Key |
|----------|-----|-----------|
| Search | 1 hour | `search:{query}:{type}:{limit}` |
| Get Stream | 30 min | `stream:{id}:{lang}:{quality}` |
| Get Sources | 5 min | `sources:{id}:{sortBy}` |
| Autocomplete | 1 hour | `autocomplete:{q}:{limit}` |

---

## SDK Examples

### JavaScript/Node.js

```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.pepito-stream.com/api/v1',
});

// Search
async function search(query: string) {
  const response = await apiClient.get('/streams/search', {
    params: { query, type: 'fuzzy', limit: 10 },
  });
  return response.data;
}

// Get Stream
async function getStream(id: string) {
  const response = await apiClient.get(`/streams/${id}`, {
    params: {
      preferredLanguage: 'vf',
      preferredQuality: 'Pepito',
    },
  });
  return response.data;
}
```

### Python

```python
import requests

BASE_URL = 'https://api.pepito-stream.com/api/v1'

def search(query: str, limit: int = 10):
    response = requests.get(
        f'{BASE_URL}/streams/search',
        params={'query': query, 'limit': limit}
    )
    return response.json()

def get_stream(stream_id: str):
    response = requests.get(
        f'{BASE_URL}/streams/{stream_id}',
        params={
            'preferredLanguage': 'vf',
            'preferredQuality': 'Pepito'
        }
    )
    return response.json()
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Server Error |

---

## Support

For issues or questions, please open an issue on GitHub: https://github.com/PepitoBailao/PepitoStream
