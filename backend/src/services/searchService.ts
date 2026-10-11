/**
 * Search Service - Recherche intelligente <10ms
 * Indexation + Trie + Fuzzy matching
 */

import { CacheService } from './cacheService';

interface SearchIndex {
  term: string;
  type: 'movie' | 'series' | 'anime';
  id: string;
  title: string;
  metadata: {
    year?: number;
    rating?: number;
    genres?: string[];
    popularity?: number;
  };
  weight: number; // Pour ranking
}

interface SearchResult {
  id: string;
  title: string;
  type: 'movie' | 'series' | 'anime';
  metadata: any;
  score: number; // 0-100
  responseTime: number;
}

interface SearchOptions {
  limit?: number;
  type?: 'movie' | 'series' | 'anime' | 'all';
  fuzzy?: boolean;
  autocomplete?: boolean;
}

export class SearchService {
  private cache: CacheService;
  private index: Map<string, SearchIndex[]> = new Map();
  private trie: TrieNode = new TrieNode();
  private stats = {
    indexSize: 0,
    searchCount: 0,
    avgSearchTime: 0,
  };

  constructor(cacheService: CacheService) {
    this.cache = cacheService;
  }

  /**
   * Index un élément (film/série/anime)
   */
  async indexItem(item: {
    id: string;
    title: string;
    type: 'movie' | 'series' | 'anime';
    metadata?: any;
  }): Promise<void> {
    const normalized = this.normalize(item.title);
    const terms = this.tokenize(normalized);

    // Calculer le weight basé sur popularity/rating
    const weight = (item.metadata?.popularity || 0) * 0.5 + (item.metadata?.rating || 0) * 0.5;

    for (const term of terms) {
      const key = `search:${term}`;
      const existing = this.index.get(key) || [];

      const searchIndex: SearchIndex = {
        term,
        type: item.type,
        id: item.id,
        title: item.title,
        metadata: item.metadata || {},
        weight,
      };

      // Éviter les doublons
      const filtered = existing.filter((e) => e.id !== item.id);
      filtered.push(searchIndex);
      // Trier par weight (meilleurs d'abord)
      filtered.sort((a, b) => b.weight - a.weight);

      this.index.set(key, filtered);

      // Ajouter au Trie pour autocomplete
      this.trie.insert(term, searchIndex);
    }

    this.stats.indexSize = this.index.size;
  }

  /**
   * Recherche simple (cache-aware)
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const startTime = performance.now();
    const limit = options.limit || 10;
    const type = options.type || 'all';
    const fuzzy = options.fuzzy !== false; // Default true
    const autocomplete = options.autocomplete !== false; // Default true

    // Clé de cache
    const cacheKey = `${query}:${type}:${fuzzy}:${autocomplete}`;
    const cached = await this.cache.get<SearchResult[]>('search', cacheKey);

    if (cached.hit) {
      const responseTime = performance.now() - startTime;
      console.log(`[Search] Cache hit for "${query}" (${responseTime.toFixed(2)}ms)`);
      return cached.data!;
    }

    try {
      let results: SearchResult[] = [];
      const normalized = this.normalize(query);

      // 1. Exact match (très rapide)
      const exactKey = `search:${normalized}`;
      if (this.index.has(exactKey)) {
        const matches = this.index.get(exactKey)!;
        results = matches
          .filter((m) => type === 'all' || m.type === type)
          .slice(0, limit)
          .map((m) => ({
            id: m.id,
            title: m.title,
            type: m.type,
            metadata: m.metadata,
            score: 100,
            responseTime: 0,
          }));
      }

      // 2. Si pas de résultat, fuzzy match
      if (results.length === 0 && fuzzy) {
        results = this.fuzzySearch(normalized, type, limit);
      }

      // 3. Si pas de résultat, autocomplete
      if (results.length === 0 && autocomplete) {
        results = this.autocompleteSearch(normalized, type, limit);
      }

      // Cache le résultat
      const responseTime = performance.now() - startTime;
      await this.cache.set('search', cacheKey, results, 1800000); // 30 min cache

      this.stats.searchCount++;
      this.stats.avgSearchTime = (this.stats.avgSearchTime + responseTime) / 2;

      return results.map((r) => ({
        ...r,
        responseTime: Math.round(responseTime * 100) / 100,
      }));
    } catch (error) {
      console.error(`Search error for "${query}":`, error);
      return [];
    }
  }

  /**
   * Fuzzy matching (Levenshtein distance)
   */
  private fuzzySearch(query: string, type: string, limit: number): SearchResult[] {
    const results: Array<{ item: SearchIndex; distance: number }> = [];
    const maxDistance = Math.ceil(query.length * 0.3); // 30% tolerance

    for (const [, items] of this.index.entries()) {
      for (const item of items) {
        if (type !== 'all' && item.type !== type) continue;

        const distance = this.levenshteinDistance(query, item.term);
        if (distance <= maxDistance) {
          results.push({ item, distance });
        }
      }
    }

    return (
      results
        // Trier par distance puis weight
        .sort((a, b) => {
          if (a.distance !== b.distance) {
            return a.distance - b.distance;
          }
          return b.item.weight - a.item.weight;
        })
        .slice(0, limit)
        .map((r) => ({
          id: r.item.id,
          title: r.item.title,
          type: r.item.type,
          metadata: r.item.metadata,
          score: Math.max(0, 100 - r.distance * 5),
          responseTime: 0,
        }))
    );
  }

  /**
   * Autocomplete via Trie
   */
  private autocompleteSearch(prefix: string, type: string, limit: number): SearchResult[] {
    const suggestions = this.trie.autocomplete(prefix, limit * 2);

    return (
      suggestions
        .filter((s) => type === 'all' || s.type === type)
        .slice(0, limit)
        .map((s) => ({
          id: s.id,
          title: s.title,
          type: s.type,
          metadata: s.metadata,
          score: 75,
          responseTime: 0,
        }))
    );
  }

  /**
   * Levenshtein distance (pour fuzzy matching)
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Normalisation (minuscules, accents, etc)
   */
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .trim();
  }

  /**
   * Tokenization
   */
  private tokenize(text: string): string[] {
    return text
      .split(/[\s\-_]+/)
      .filter((t) => t.length > 1)
      .map((t) => t.toLowerCase());
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      indexSize: this.stats.indexSize,
      searchCount: this.stats.searchCount,
      avgSearchTime: Math.round(this.stats.avgSearchTime * 100) / 100,
    };
  }

  /**
   * Clear index
   */
  clearIndex(): void {
    this.index.clear();
    this.trie = new TrieNode();
    this.stats = { indexSize: 0, searchCount: 0, avgSearchTime: 0 };
  }
}

/**
 * Trie Node pour autocomplete
 */
class TrieNode {
  children: Map<string, TrieNode> = new Map();
  items: SearchIndex[] = [];
  isEndOfWord = false;

  insert(word: string, item: SearchIndex): void {
    let node = this;

    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
    }

    node.isEndOfWord = true;
    node.items.push(item);
    node.items.sort((a, b) => b.weight - a.weight);
    node.items = node.items.slice(0, 20); // Top 20 only
  }

  autocomplete(prefix: string, limit: number): SearchIndex[] {
    let node = this;

    // Traverser jusqu'au prefix
    for (const char of prefix) {
      if (!node.children.has(char)) {
        return [];
      }
      node = node.children.get(char)!;
    }

    // Retourner les résultats du nœud courant
    return node.items.slice(0, limit);
  }
}

// Export
export { SearchIndex, SearchResult, SearchOptions };
