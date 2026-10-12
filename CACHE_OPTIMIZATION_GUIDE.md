# 🔄 Option M - Cache Strategy & Optimization

## 📊 Vue d'ensemble

PepitoStream inclut un système de cache multi-layer sophistiqué avec support pour :
- **Cache local** (LRU, LFU, FIFO, TTL)
- **Cache distribué** (Redis + Memcached)
- **Compression** (Gzip, Brotli, Deflate)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         Application Layer               │
├─────────────────────────────────────────┤
│         Cache Strategies (LRU/LFU)      │  Local Memory
├─────────────────────────────────────────┤
│       Distributed Cache Service         │  Redis/Memcached
├─────────────────────────────────────────┤
│      Compression Service                │  Gzip/Brotli
├─────────────────────────────────────────┤
│    Storage (Redis, Memcached, Disk)    │
└─────────────────────────────────────────┘
```

---

## 📈 Stratégies de Caching

### 1️⃣ LRU (Least Recently Used)
**Meilleur pour:** Applications avec accès uniforme
```typescript
const cache = new CacheStrategies({
  maxSize: 100 * 1024 * 1024, // 100MB
  defaultTtl: 3600000, // 1 hour
  maxEntries: 10000,
  strategy: 'LRU'
});

cache.set('stream:123', streamData);
const data = cache.get('stream:123'); // Marque comme récemment utilisé
```

### 2️⃣ LFU (Least Frequently Used)
**Meilleur pour:** Données populaires à long terme
```typescript
const cache = new CacheStrategies({
  strategy: 'LFU'
});
// Évincera les entrées les moins accédées
```

### 3️⃣ FIFO (First In First Out)
**Meilleur pour:** Données expirantes
```typescript
const cache = new CacheStrategies({
  strategy: 'FIFO'
});
// Évincera les entrées les plus anciennes
```

### 4️⃣ TTL (Time To Live)
**Meilleur pour:** Données temporaires
```typescript
cache.set('session:abc', userData, 1800000); // 30 minutes
// Expirera automatiquement après 30 minutes
```

---

## 🌐 Cache Distribué

### Configuration Redis

```typescript
const distributed = new DistributedCacheService({
  type: 'redis',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: 0,
    keyPrefix: 'pepito:'
  },
  syncInterval: 30000 // 30 secondes
});

// Usage
await distributed.set('user:123', userData, 3600);
const user = await distributed.get('user:123');
```

### Configuration Memcached

```typescript
const distributed = new DistributedCacheService({
  type: 'memcached',
  memcached: {
    servers: ['localhost:11211'],
    options: {
      timeout: 5000,
      retries: 2
    }
  }
});
```

### Mode Hybride (Recommandé)

```typescript
const distributed = new DistributedCacheService({
  type: 'hybrid', // Redis + Memcached
  redis: { /* config */ },
  memcached: { /* config */ }
});

// Redis = primaire, Memcached = fallback
```

---

## 🗜️ Compression

### Configuration

```typescript
const compression = new CacheCompressionService({
  enabled: true,
  algorithm: 'brotli', // 'gzip' | 'brotli' | 'deflate'
  level: 6, // 1-11 pour brotli, 1-9 pour gzip
  threshold: 1024 // 1KB minimum
});
```

### Algorithmes Comparés

| Algorithme | Ratio | Vitesse | Mémoire | Cas d'usage |
|-----------|-------|---------|---------|------------|
| **Gzip** | ~70% | Rapide | Faible | Défaut fiable |
| **Brotli** | ~80% | Modéré | Modéré | Optimal pour web |
| **Deflate** | ~65% | Très rapide | Faible | Temps réel |

### Utilisation

```typescript
// Compression automatique
const { compressed, stats } = await compression.compress(largeData);
console.log(`Ratio: ${stats.compressionRatio}`); // 0.75 = 75% compressed

// Décompression
const { decompressed } = await compression.decompress(compressed);
```

---

## 📊 Statistiques & Monitoring

### Cache Local Stats

```typescript
const stats = cache.getStats();
// {
//   hits: 150,
//   misses: 50,
//   hitRate: 0.75,
//   evictions: 12,
//   totalSize: 45000000, // bytes
//   entryCount: 234,
//   avgAccessTime: 0.5 // ms
// }
```

### Distributed Cache Stats

```typescript
const stats = await distributed.getStats();
// {
//   connected_clients: 5,
//   used_memory: '2.5M',
//   ops_per_sec: 1500,
//   total_commands_processed: 125000
// }
```

### Compression Stats

```typescript
const stats = compression.getStats();
// {
//   totalOriginalSize: 50000000,
//   totalCompressedSize: 10000000,
//   overallCompressionRatio: 0.8,
//   successRate: 0.95,
//   attempts: 1000
// }
```

---

## 🔑 Tagging System

Organiser et nettoyer le cache par tags :

```typescript
// Set with tags
cache.set('user:123', userData, undefined, ['user', 'profile', 'active']);
cache.set('user:456', userData, undefined, ['user', 'profile', 'inactive']);
cache.set('post:789', postData, undefined, ['post', 'trending']);

// Clear by tag
cache.clearByTag('inactive'); // Efface 1 entrée
cache.clearByTag('user'); // Efface 2 entrées
```

---

## 🎯 Cas d'Usage

### 1. Streaming Metadata

```typescript
// Cache des métadonnées de films/séries
const cacheKey = `stream:${streamId}`;
let streamData = cache.get(cacheKey);

if (!streamData) {
  streamData = await fetchStreamMetadata(streamId);
  cache.set(cacheKey, streamData, 86400000, ['stream', 'metadata']); // 24h
}
```

### 2. User Sessions

```typescript
// Cache des sessions utilisateur
await distributed.set(
  `session:${userId}`,
  { id, email, preferences },
  1800 // 30 minutes
);
```

### 3. API Responses

```typescript
// Cache des réponses API externes
const cacheKey = `tmdb:movie:${movieId}`;
let movieData = await distributed.get(cacheKey);

if (!movieData) {
  movieData = await tmdbApi.getMovie(movieId);
  await distributed.set(
    cacheKey,
    movieData,
    604800 // 1 week
  );
}
```

### 4. Search Results

```typescript
// Cache des résultats de recherche
cache.set(
  `search:${query}:${page}`,
  results,
  300000, // 5 minutes
  ['search', `query:${query}`]
);
```

---

## ⚙️ Configuration Recommandée

### Développement

```typescript
// .env.development
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=1

// cache.module.ts
new CacheStrategies({
  maxSize: 10 * 1024 * 1024, // 10MB
  defaultTtl: 600000, // 10 minutes
  maxEntries: 1000,
  strategy: 'LRU'
})
```

### Production

```typescript
// .env.production
REDIS_HOST=redis.pepito.prod
REDIS_PORT=6379
REDIS_PASSWORD=secure_password
MEMCACHED_SERVERS=memcached1:11211,memcached2:11211

// cache.module.ts
new CacheStrategies({
  maxSize: 500 * 1024 * 1024, // 500MB
  defaultTtl: 3600000, // 1 hour
  maxEntries: 100000,
  strategy: 'LFU' // Plus fréquent = plus important
})
```

---

## 🚀 Performance Tips

### 1. Sélectionner la bonne stratégie

```typescript
// Streaming (accès uniforme) → LRU
// Contenu populaire → LFU
// Données volatiles → TTL
// Queue de traitement → FIFO
```

### 2. Optimiser la compression

```typescript
// High-value data (APIs, gros fichiers)
compression.algorithm = 'brotli'; // Meilleur ratio
compression.level = 9;

// Real-time data
compression.algorithm = 'gzip'; // Plus rapide
compression.level = 6;
```

### 3. Utiliser le tagging

```typescript
// Au lieu de clearAll()
cache.clearByTag('search'); // Plus performant, plus ciblé
```

### 4. Monitorer les stats

```typescript
setInterval(() => {
  const stats = cache.getStats();
  
  if (stats.hitRate < 0.5) {
    console.warn('Low hit rate:', stats.hitRate);
    // Augmenter TTL ou maxEntries
  }
  
  if (stats.avgAccessTime > 10) {
    console.warn('Slow access:', stats.avgAccessTime, 'ms');
    // Vérifier la performance Redis
  }
}, 60000);
```

---

## 🔧 API Endpoints

```http
GET /api/cache/stats
→ { local: {...}, compression: {...} }

GET /api/cache/get/:key
→ { key, distributed, local }

POST /api/cache/set
{ "key": "...", "value": {...}, "ttl": 3600 }

DELETE /api/cache/delete/:key
→ { key, local: bool, distributed: bool }

DELETE /api/cache/clear-tag/:tag
→ { tag, cleared: number }

DELETE /api/cache/clear
→ { success: bool }

GET /api/cache/compression/stats
→ { totalOriginalSize, totalCompressedSize, ... }

POST /api/cache/compression/test
{ "data": "..." }

GET /api/cache/info
→ { stats: {...} }
```

---

## 📦 Installation

```bash
npm install redis memcached
npm install --save-dev @types/redis @types/memcached
```

### Docker Compose

```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  memcached:
    image: memcached:1.6-alpine
    ports:
      - "11211:11211"

volumes:
  redis-data:
```

---

## ✅ Tests

```bash
npm run test cache.strategies.spec.ts
npm run test distributed-cache.spec.ts
npm run test cache-compression.spec.ts

# Coverage
npm run test:cov cache
```

---

## 🎓 Résumé

| Composant | Fonction | Stratégies |
|-----------|----------|-----------|
| **Local Cache** | RAM rapide | LRU, LFU, FIFO, TTL |
| **Distributed** | Multi-serveur | Redis, Memcached, Hybrid |
| **Compression** | Économiser l'espace | Gzip, Brotli, Deflate |
| **Tagging** | Organisation logique | Nettoyage par tags |
| **Stats** | Monitoring | Hit rate, evictions, size |

**Résultat:** Système de cache ultra-performant et scalable pour PepitoStream ! 🚀
