# PepitoStream API - Usage Examples

## 🚀 Quick Start

### Installation

```bash
npm install axios
```

---

## 📋 Complete Examples

### 1. Search Streams

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.pepito-stream.com/api/v1',
  timeout: 5000,
});

// Basic search
async function basicSearch() {
  try {
    const response = await api.get('/streams/search', {
      params: {
        query: 'Breaking Bad',
        type: 'fuzzy',
        limit: 10,
      },
    });

    console.log(`Found ${response.data.totalResults} results`);
    console.log(`Processing time: ${response.data.processingTime}ms`);
    console.log(`Cache hit: ${response.data.cacheHit}`);

    return response.data.results;
  } catch (error) {
    console.error('Search error:', error.response?.data?.error);
  }
}

// Exact search
async function exactSearch() {
  const response = await api.get('/streams/search', {
    params: {
      query: 'Breaking Bad',
      type: 'exact',
      sortBy: 'rating',
    },
  });
  return response.data;
}

// With pagination
async function paginatedSearch(query: string, page: number = 1, pageSize: number = 20) {
  const offset = (page - 1) * pageSize;
  const response = await api.get('/streams/search', {
    params: {
      query,
      limit: pageSize,
      offset,
      sortBy: 'relevance',
    },
  });
  return {
    ...response.data,
    page,
    pageSize,
    totalPages: Math.ceil(response.data.totalResults / pageSize),
  };
}
```

---

### 2. Autocomplete

```typescript
// Simple autocomplete
async function getAutocomplete(query: string) {
  const response = await api.get('/streams/autocomplete', {
    params: {
      q: query,
      limit: 10,
    },
  });
  return response.data.suggestions;
}

// Autocomplete with debounce (React example)
import { useCallback, useState } from 'react';
import debounce from 'lodash/debounce';

function SearchInput() {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const fetchSuggestions = useCallback(
    debounce(async (query: string) => {
      if (query.length < 1) {
        setSuggestions([]);
        return;
      }

      try {
        const response = await api.get('/streams/autocomplete', {
          params: { q: query, limit: 10 },
        });
        setSuggestions(response.data.suggestions);
      } catch (error) {
        console.error('Autocomplete error:', error);
      }
    }, 300),
    [],
  );

  return (
    <div>
      <input
        type="text"
        placeholder="Search..."
        onChange={(e) => fetchSuggestions(e.target.value)}
      />
      <ul>
        {suggestions.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

### 3. Get Stream Details

```typescript
// Basic stream retrieval
async function getStream(streamId: string) {
  const response = await api.get(`/streams/${streamId}`, {
    params: {
      preferredLanguage: 'vf',
      preferredQuality: 'Pepito',
      maxLatency: 10000,
    },
  });

  const stream = response.data;
  
  console.log(`Title: ${stream.title}`);
  console.log(`Quality: ${stream.quality.profile} - ${stream.quality.resolution}`);
  console.log(`Audio: ${stream.audio.language} (${stream.audio.type})`);
  console.log(`Best source: ${stream.sources[0].tracker} (latency: ${stream.sources[0].latency}ms)`);
  console.log(`Failover sources: ${stream.failoverSources?.length || 0}`);
  console.log(`Load time: ${stream.estimatedPlayTime}ms`);

  return stream;
}

// Get high quality version
async function getHighQualityStream(streamId: string) {
  return api.get(`/streams/${streamId}`, {
    params: {
      preferredQuality: 'PepitoCiné',
      preferredLanguage: 'vf',
    },
  });
}

// Get fastest loading version
async function getFastestStream(streamId: string) {
  return api.get(`/streams/${streamId}`, {
    params: {
      preferredQuality: 'PepitoMacqueen',
      maxLatency: 1000, // Max 1 second
    },
  });
}

// Accessible version
async function getAccessibleStream(streamId: string) {
  return api.get(`/streams/${streamId}`, {
    params: {
      preferredQuality: 'PepitoDuVoyage',
      preferredLanguage: 'vostfr',
      maxLatency: 5000,
    },
  });
}
```

---

### 4. Get Sources

```typescript
// List all sources sorted by latency
async function getSourcesByLatency(streamId: string) {
  const response = await api.get(`/streams/${streamId}/sources`, {
    params: { sortBy: 'latency' },
  });

  console.log(`Total sources: ${response.data.totalSources}`);
  
  for (const source of response.data.sources) {
    console.log(
      `${source.tracker}: ${source.seeders} seeders, ` +
      `${source.latency}ms latency, score ${source.score}/100`
    );
  }

  return response.data.sources;
}

// List sources sorted by seeders (most available)
async function getMostAvailableSources(streamId: string) {
  const response = await api.get(`/streams/${streamId}/sources`, {
    params: { sortBy: 'seeders' },
  });

  return response.data.sources.filter((s) => s.status === 'online');
}

// List sources sorted by score (best quality)
async function getBestQualitySources(streamId: string) {
  const response = await api.get(`/streams/${streamId}/sources`, {
    params: { sortBy: 'score' },
  });

  return response.data.sources;
}
```

---

### 5. Audio Tracks

```typescript
// Get all audio options
async function getAudioOptions(streamId: string) {
  const response = await api.get(`/streams/${streamId}/audio`);

  console.log('Available audio tracks:');
  for (const track of response.data.audioTracks) {
    console.log(
      `- ${track.language} (${track.type}): ${track.codec} ${track.channels} @ ${track.bitrate}kbps`
    );
  }

  return response.data.audioTracks;
}

// Find VF (French) audio
function getFrenchAudio(audioTracks: any[]) {
  return audioTracks.find((t) => t.type === 'vf' && t.language === 'fr');
}

// Find VOSTFR (French subtitled)
function getFrenchSubtitledAudio(audioTracks: any[]) {
  return audioTracks.find((t) => t.type === 'vostfr' && t.language === 'fr');
}

// Find original audio
function getOriginalAudio(audioTracks: any[]) {
  return audioTracks.find((t) => t.type === 'vo');
}

// Get best audio by score
function getBestAudio(audioTracks: any[]) {
  return audioTracks.reduce((best, current) =>
    current.score > best.score ? current : best
  );
}
```

---

### 6. Bulk Search

```typescript
// Search multiple shows at once
async function bulkSearch(queries: string[]) {
  const response = await api.post('/streams/search/bulk', {
    queries,
    limit: 5,
  });

  const results: { [key: string]: any } = {};

  for (const queryResult of response.data.queries) {
    results[queryResult.query] = queryResult.results.results;
  }

  console.log(`Searched ${queries.length} queries in ${response.data.totalProcessingTime}ms`);

  return results;
}

// Example
const shows = ['Breaking Bad', 'Game of Thrones', 'Stranger Things'];
const results = await bulkSearch(shows);

for (const [show, matches] of Object.entries(results)) {
  console.log(`${show}: ${matches.length} results`);
}
```

---

### 7. Compare Quality Profiles

```typescript
// Compare all quality profiles
async function compareProfiles(streamId: string) {
  const response = await api.get(`/streams/${streamId}/compare`);

  console.log('Quality Profile Comparison:');
  console.log('| Profile | Resolution | Codec | Bitrate | Quality Score | Audio Score |');
  console.log('|---------|-----------|-------|---------|---------------|-------------|');

  for (const profile of response.data.profiles) {
    console.log(
      `| ${profile.name.padEnd(7)} | ` +
      `${profile.quality.resolution.padEnd(9)} | ` +
      `${profile.quality.codec.padEnd(5)} | ` +
      `${profile.quality.bitrate} Mbps | ` +
      `${profile.quality.score}/100 | ` +
      `${profile.audio.score}/100 |`
    );
  }

  return response.data.profiles;
}

// Find best profile for use case
function getBestProfileFor(profiles: any[], useCase: 'cinema' | 'casual' | 'lowbandwidth' | 'quick') {
  const profileMap = {
    cinema: 'PepitoCiné',
    casual: 'Pepito',
    lowbandwidth: 'PepitoDuVoyage',
    quick: 'PepitoMacqueen',
  };

  return profiles.find((p) => p.name === profileMap[useCase]);
}
```

---

### 8. Health & Monitoring

```typescript
// Health check
async function healthCheck() {
  const response = await api.get('/health');
  console.log(`API Status: ${response.data.status}`);
  console.log(`Uptime: ${Math.floor(response.data.uptime / 3600)} hours`);
  return response.data;
}

// Detailed health
async function detailedHealthCheck() {
  const response = await api.get('/health/detailed');

  console.log(`Overall Status: ${response.data.status}`);
  console.log(`\nService Health:`);
  console.log(`- Cache: ${response.data.services.cache.status} (${response.data.services.cache.hitRate}% hit rate)`);
  console.log(`- Search: ${response.data.services.search.status}`);
  console.log(`- Quality: ${response.data.services.quality.status}`);
  console.log(`- Audio: ${response.data.services.audio.status}`);

  return response.data;
}

// Get metrics
async function getMetrics() {
  const response = await api.get('/health/metrics');

  console.log(`Memory: ${response.data.memory.used} / ${response.data.memory.total} (${response.data.memory.usedPercent})`);
  console.log(`Cache Hit Rate: ${response.data.cache.hitRate.toFixed(2)}%`);
  console.log(`Node.js: ${response.data.nodejs.version}`);

  return response.data;
}
```

---

### 9. Error Handling

```typescript
// Comprehensive error handling
async function searchWithErrorHandling(query: string) {
  try {
    const response = await api.get('/streams/search', {
      params: { query },
      timeout: 5000,
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response;

      if (status === 400) {
        console.error('Bad request:', data.error.message);
      } else if (status === 429) {
        console.error('Rate limited. Retry after:', data.error.resetTime);
      } else if (status >= 500) {
        console.error('Server error:', data.error.message);
      }
    } else if (error.request) {
      // Request made but no response
      console.error('No response from server');
    } else {
      // Error in request setup
      console.error('Error:', error.message);
    }

    throw error;
  }
}

// Retry with backoff
async function searchWithRetry(query: string, maxRetries: number = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await api.get('/streams/search', {
        params: { query },
      });
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = Math.pow(2, i) * 1000; // exponential backoff
      console.log(`Retry ${i + 1} after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
```

---

### 10. Rate Limiting Aware

```typescript
// Track rate limit headers
async function trackRateLimit() {
  const response = await api.get('/streams/search', {
    params: { query: 'test' },
  });

  const limit = parseInt(response.headers['x-ratelimit-limit']);
  const remaining = parseInt(response.headers['x-ratelimit-remaining']);
  const reset = parseInt(response.headers['x-ratelimit-reset']);

  console.log(`Rate Limit: ${remaining}/${limit}`);
  console.log(`Resets at: ${new Date(reset * 1000).toISOString()}`);

  return {
    limit,
    remaining,
    reset,
  };
}

// Implement rate limit queue
class RateLimitedQueue {
  private queue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private delayMs = 1000; // 1 request per second

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await fn());
        } catch (error) {
          reject(error);
        }
      });

      this.process();
    });
  }

  private async process() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const fn = this.queue.shift();
      if (fn) {
        await fn();
        await new Promise((r) => setTimeout(r, this.delayMs));
      }
    }

    this.isProcessing = false;
  }
}

// Usage
const queue = new RateLimitedQueue();

const searches = [
  'Breaking Bad',
  'Game of Thrones',
  'Stranger Things',
];

for (const query of searches) {
  queue.add(() =>
    api.get('/streams/search', {
      params: { query },
    }),
  );
}
```

---

## 📊 Full Application Example

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.pepito-stream.com/api/v1',
});

class PepitoStreamClient {
  async search(query: string, options = {}) {
    const response = await api.get('/streams/search', {
      params: { query, type: 'fuzzy', limit: 10, ...options },
    });
    return response.data;
  }

  async getStream(id: string, preferences = {}) {
    const response = await api.get(`/streams/${id}`, {
      params: {
        preferredLanguage: 'vf',
        preferredQuality: 'Pepito',
        ...preferences,
      },
    });
    return response.data;
  }

  async autocomplete(q: string) {
    const response = await api.get('/streams/autocomplete', {
      params: { q, limit: 10 },
    });
    return response.data.suggestions;
  }

  async health() {
    const response = await api.get('/health/detailed');
    return response.data;
  }
}

// Usage
const client = new PepitoStreamClient();

async function main() {
  // Search
  const results = await client.search('Breaking Bad');
  const firstResult = results.results[0];

  // Get details
  const stream = await client.getStream(firstResult.id, {
    preferredQuality: 'PepitoCiné',
  });

  console.log(`Title: ${stream.title}`);
  console.log(`Quality: ${stream.quality.resolution}`);
  console.log(`Audio: ${stream.audio.language}`);
  console.log(`Ready to play in ${stream.estimatedPlayTime}ms`);
}

main().catch(console.error);
```

---

## 🔗 Useful Links

- [API Documentation](./API_DOCUMENTATION.md)
- [GitHub Repository](https://github.com/PepitoBailao/PepitoStream)
- [Issues & Support](https://github.com/PepitoBailao/PepitoStream/issues)
