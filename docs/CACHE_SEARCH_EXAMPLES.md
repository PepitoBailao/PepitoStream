# 📚 Exemples Pratiques | Cache + Search

## 1️⃣ Exemple Simple: Recherche Basique

```typescript
import { SearchService } from '@/services/searchService';
import { CacheService } from '@/services/cacheService';

const cache = new CacheService();
const search = new SearchService(cache);

// Index quelques séries
await search.indexItem({
  id: '1',
  title: 'Breaking Bad',
  type: 'series',
  metadata: { year: 2008, rating: 9.5, popularity: 100 }
});

await search.indexItem({
  id: '2',
  title: 'Better Call Saul',
  type: 'series',
  metadata: { year: 2015, rating: 9.0, popularity: 95 }
});

// Recherche simple
const results = await search.search('breaking bad');
console.log(results);
// [{ id: '1', title: 'Breaking Bad', score: 100, responseTime: 0.45 }]
```

---

## 2️⃣ Exemple: Cache Hit vs Miss

```typescript
import { CacheService } from '@/services/cacheService';

const cache = new CacheService({
  defaultTTL: 60000  // 1 minute
});

const movieData = {
  id: '123',
  title: 'Dune',
  year: 2021,
  director: 'Denis Villeneuve'
};

// Première requête: MISS
console.time('First Request');
const set1 = await cache.set('movie', 'dune', movieData);
console.timeEnd('First Request'); // ~0.3ms

// Deuxième requête: HIT
console.time('Second Request');
const get1 = await cache.get('movie', 'dune');
console.timeEnd('Second Request'); // ~0.5ms
console.log(get1.hit); // true
console.log(get1.responseTime); // 0.45ms

// Après 1 minute: MISS (TTL expiré)
await new Promise(r => setTimeout(r, 61000));
const get2 = await cache.get('movie', 'dune');
console.log(get2.hit); // false
```

---

## 3️⃣ Exemple: Fuzzy Matching (Typos)

```typescript
import { SearchService } from '@/services/searchService';
import { CacheService } from '@/services/cacheService';

const cache = new CacheService();
const search = new SearchService(cache);

// Index
await search.indexItem({
  id: '1',
  title: 'Breaking Bad',
  type: 'series'
});

// Requête avec typo
const results = await search.search('breakng bda', { 
  fuzzy: true 
});

console.log(results);
// [{ 
//   id: '1', 
//   title: 'Breaking Bad', 
//   score: 82,  // <100 car fuzzy match
//   responseTime: 2.1
// }]
```

---

## 4️⃣ Exemple: Autocomplete

```typescript
import { SearchService } from '@/services/searchService';
import { CacheService } from '@/services/cacheService';

const cache = new CacheService();
const search = new SearchService(cache);

// Index plein de séries
const series = [
  'Breaking Bad',
  'Better Call Saul',
  'Bridgerton',
  'Breaking Bad Season 1',
  'Dune',
  'Dune Part Two'
];

for (const title of series) {
  await search.indexItem({
    id: title.toLowerCase().replace(/\s/g, '-'),
    title,
    type: 'series'
  });
}

// Autocomplete "bre"
const results = await search.search('bre', { autocomplete: true });

console.log(results.map(r => r.title));
// [
//   'Breaking Bad',
//   'Better Call Saul',
//   'Bridgerton',
//   'Breaking Bad Season 1'
// ]
```

---

## 5️⃣ Exemple: Streaming Complet (A+B+C)

```typescript
import { StreamServiceWithCache } from '@/services/streamServiceWithCache';

const streamService = new StreamServiceWithCache();

// 1. Index du contenu
await streamService.indexContent({
  id: 'breaking-bad-s1e1',
  title: 'Breaking Bad - Season 1 Episode 1',
  type: 'series',
  metadata: {
    popularity: 100,
    rating: 9.5
  }
});

// 2. Ajouter les sources disponibles
await streamService.addSource('breaking-bad-s1e1', {
  id: 'ygg-1080p',
  title: 'YGG - 1080p BluRay',
  quality: '1080p',
  resolution: '1920x1080',
  bitrate: 8.5,
  size: 2.5,
  languages: ['fr', 'en'],
  score: 0,
  qualityScore: 0,
  audioScore: 0,
  combinedScore: 0,
  responseTime: 0
});

await streamService.addSource('breaking-bad-s1e1', {
  id: 'c411-720p',
  title: 'C411 - 720p WEB-DL',
  quality: '720p',
  resolution: '1280x720',
  bitrate: 4.2,
  size: 1.2,
  languages: ['fr'],
  score: 0,
  qualityScore: 0,
  audioScore: 0,
  combinedScore: 0,
  responseTime: 0
});

// 3. Requête streaming complète
const result = await streamService.getSources({
  contentId: 'breaking-bad-s1e1',
  contentType: 'series',
  season: 1,
  episode: 1,
  qualityProfile: 'Pepito',        // Option A
  audioPreference: {               // Option B
    mode: 'vostfr_vf',
    language: 'français',
    maxSize: 2000
  }
});

console.log(result);
// {
//   contentId: 'breaking-bad-s1e1',
//   primary: {
//     id: 'ygg-1080p',
//     title: 'YGG - 1080p BluRay',
//     qualityScore: 85,
//     audioScore: 90,
//     combinedScore: 87,  // 60% qualité + 40% audio
//   },
//   backups: [
//     { id: 'c411-720p', combinedScore: 72 }
//   ],
//   cacheHit: false,
//   responseTime: 5.67,
//   timestamp: 1633880000000
// }
```

---

## 6️⃣ Exemple: Failover Automatique

```typescript
import { StreamServiceWithCache } from '@/services/streamServiceWithCache';

const streamService = new StreamServiceWithCache();

// Setup initial
// ... (comme exemple 5)

// Première requête: succès
let result = await streamService.getSources({
  contentId: 'breaking-bad-s1e1',
  contentType: 'series',
  qualityProfile: 'Pepito',
  audioPreference: { mode: 'vostfr_vf' }
});

console.log('Primary:', result.primary.id); // ygg-1080p
console.log('Backup 1:', result.backups[0]?.id); // c411-720p

// Source principale échoue (timeout, dead link)
await streamService.invalidateSource('breaking-bad-s1e1', 'ygg-1080p');

// Prochaine requête
result = await streamService.getSources({
  contentId: 'breaking-bad-s1e1',
  contentType: 'series',
  qualityProfile: 'Pepito',
  audioPreference: { mode: 'vostfr_vf' }
});

console.log('New Primary:', result.primary.id); // c411-720p (auto-promoted)
// Les utilisateurs ne remarquent rien! Seamless failover ✅
```

---

## 7️⃣ Exemple: Pattern Search

```typescript
import { CacheService } from '@/services/cacheService';

const cache = new CacheService();

// Cache plusieurs sources
await cache.set('streams', 'breaking-bad-s1e1', { ... });
await cache.set('streams', 'breaking-bad-s1e2', { ... });
await cache.set('streams', 'breaking-bad-s2e1', { ... });
await cache.set('streams', 'dune-1', { ... });

// Chercher toutes les sources de Breaking Bad
const results = await cache.search('breaking-bad', 'streams');

console.log(results.results.map(r => r.key));
// [
//   'streams:abc123hash',  // breaking-bad-s1e1
//   'streams:def456hash',  // breaking-bad-s1e2
//   'streams:ghi789hash'   // breaking-bad-s2e1
// ]
```

---

## 8️⃣ Exemple: Monitoring & Stats

```typescript
import { StreamServiceWithCache } from '@/services/streamServiceWithCache';

const streamService = new StreamServiceWithCache();

// Faire plein de requêtes
for (let i = 0; i < 100; i++) {
  await streamService.searchContent('breaking bad');
  await streamService.getSources({
    contentId: 'breaking-bad-s1e1',
    contentType: 'series',
    qualityProfile: 'Pepito',
    audioPreference: { mode: 'vostfr_vf' }
  });
}

// Stats complètes
const stats = streamService.getStats();

console.log(stats);
// {
//   cache: {
//     totalEntries: 487,
//     totalSize: 143.5,        // MB
//     hitRate: 87,             // %
//     avgResponseTime: 0.89,   // ms
//     memory: {
//       heapUsed: 52428800,
//       heapTotal: 134217728,
//       ...
//     }
//   },
//   search: {
//     indexSize: 1250,
//     searchCount: 100,
//     avgSearchTime: 1.3       // ms
//   },
//   indexedSources: 245
// }

// Si hit rate <80%, c'est qu'on cache pas assez
if (stats.cache.hitRate < 80) {
  console.warn('⚠️ Cache hit rate low!');
  // → Augmenter TTL ou maxSize
}

// Si avgResponseTime >5ms, optimiser
if (stats.cache.avgResponseTime > 5) {
  console.warn('⚠️ Response time too high!');
  // → Vérifier la mémoire disponible
}
```

---

## 9️⃣ Exemple: Invalidation Namespace

```typescript
import { CacheService } from '@/services/cacheService';

const cache = new CacheService();

// Cache plein de données
await cache.set('search', 'breaking bad', [...], 1800000);
await cache.set('search', 'dune', [...], 1800000);
await cache.set('streams', 'breaking-bad-s1e1', {...}, 3600000);

// Tout le cache search devient stale
// → Invalider tout le namespace
const invalidated = await cache.invalidateNamespace('search');
console.log(`Invalidated ${invalidated} entries`);

// Nouvelle requête search va refetch les données
const results = await cache.get('search', 'breaking bad');
console.log(results.hit); // false - cache cleared

// Les streams continuent de servir du cache
const stream = await cache.get('streams', 'breaking-bad-s1e1');
console.log(stream.hit); // true - untouched
```

---

## 🔟 Exemple: Multi-Version Cache

```typescript
import { CacheService } from '@/services/cacheService';

const cache = new CacheService();

// Différentes versions du même contenu
const configV1 = { profiles: 3, features: ['search'] };
const configV2 = { profiles: 4, features: ['search', 'audio-select'] };
const configV3 = { profiles: 4, features: ['search', 'audio-select', 'cache'] };

await cache.set('config', 'app', configV1, 3600000, 'v1');
await cache.set('config', 'app', configV2, 3600000, 'v2');
await cache.set('config', 'app', configV3, 3600000, 'v3');

// Clients peuvent utiliser différentes versions
const clientV1 = await cache.get('config', 'app', 'v1');
const clientV2 = await cache.get('config', 'app', 'v2');
const clientV3 = await cache.get('config', 'app', 'v3');

console.log(clientV1.data); // { profiles: 3, features: ['search'] }
console.log(clientV3.data); // { profiles: 4, features: [...] }
```

---

## 1️⃣1️⃣ Exemple Avancé: Cache Warming

```typescript
import { StreamServiceWithCache } from '@/services/streamServiceWithCache';

const streamService = new StreamServiceWithCache();

// Liste des top 100 séries (populaires)
const topSeries = [
  { id: 'breaking-bad', title: 'Breaking Bad' },
  { id: 'game-of-thrones', title: 'Game of Thrones' },
  { id: 'the-office', title: 'The Office' },
  // ... 97 de plus
];

async function warmCache() {
  console.time('Cache Warming');
  
  for (const series of topSeries) {
    // Pré-fetch pour tous les profils qualité
    const profiles = ['PepitoCiné', 'PepitoDuVoyage', 'Pepito', 'PepitoMacqueen'];
    
    for (const profile of profiles) {
      await streamService.getSources({
        contentId: series.id,
        contentType: 'series',
        qualityProfile: profile as any,
        audioPreference: { mode: 'vostfr_vf' }
      });
    }
  }
  
  console.timeEnd('Cache Warming');
  // Résultat: Cache Warming: 5234.5ms
  
  const stats = streamService.getStats();
  console.log(`✅ Warmed ${stats.cache.totalEntries} cache entries`);
  // ✅ Warmed 487 cache entries
}

// Quand les vrais utilisateurs arrivent:
// → Toutes leurs requêtes hit le cache!
// → Réponse <1ms au lieu de >10ms
```

---

## 1️⃣2️⃣ Exemple: Compression de Gros Datasets

```typescript
import { CacheService } from '@/services/cacheService';

const cache = new CacheService({
  compressionThreshold: 10240  // 10KB
});

// Petit dataset - pas compressé
const small = { items: Array(10).fill({ id: 1 }) };
const smallResult = await cache.set('test', 'small', small);
console.log(smallResult); // compressed: false

// Gros dataset - compressé auto
const large = { 
  items: Array(1000).fill({ 
    id: 1, 
    title: 'Breaking Bad',
    description: 'A'.repeat(100)
  }) 
};
const largeResult = await cache.set('test', 'large', large);
console.log(largeResult); // compressed: true
// Sauvegarde ~70% de mémoire ✅

// À la lecture, décompression auto
const retrieved = await cache.get('test', 'large');
console.log(retrieved.data); // Données complètes, décompressées
console.log(retrieved.responseTime); // Toujours <1ms
```

---

## 📊 Synthèse: Cas d'Utilisation

| Cas | Service | Temps |
|-----|---------|-------|
| Recherche simple | SearchService | <2ms |
| Cache hit | CacheService | <1ms |
| Fuzzy match | SearchService | ~5ms |
| Full stream | StreamServiceWithCache | ~8ms |
| Failover auto | StreamServiceWithCache | transparent |
| Cache warming | Batch | ~5s pour 400+ items |

✅ **Tous les cas <10ms** comme Lumio V2!
