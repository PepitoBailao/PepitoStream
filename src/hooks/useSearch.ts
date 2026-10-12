import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

interface SearchResult {
  id: string;
  title: string;
  poster: string;
  rating: number;
  year: number;
  type: 'movie' | 'series' | 'anime';
  sources: number;
}

interface UseSearchOptions {
  debounceMs?: number;
  timeout?: number;
}

export function useSearch({ debounceMs = 300, timeout = 10000 }: UseSearchOptions = {}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [autocomplete, setAutocomplete] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();

  const search = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const response = await axios.get('/api/streams/search', {
          params: { q: searchQuery },
          timeout
        });
        setResults(response.data.results || []);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Search failed');
        setError(error);
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [timeout]
  );

  const getAutocomplete = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setAutocomplete([]);
        return;
      }

      try {
        const response = await axios.get('/api/streams/autocomplete', {
          params: { q: searchQuery },
          timeout
        });
        setAutocomplete(response.data.suggestions || []);
      } catch (err) {
        console.error('Autocomplete error:', err);
        setAutocomplete([]);
      }
    },
    [timeout]
  );

  const handleQueryChange = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      
      // Debounce search
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      
      debounceTimer.current = setTimeout(() => {
        search(newQuery);
      }, debounceMs);

      // Autocomplete without debounce
      getAutocomplete(newQuery);
    },
    [search, getAutocomplete, debounceMs]
  );

  const clearResults = useCallback(() => {
    setQuery('');
    setResults([]);
    setAutocomplete([]);
    setError(null);
  }, []);

  return {
    query,
    results,
    autocomplete,
    isLoading,
    error,
    handleQueryChange,
    clearResults,
    setQuery
  };
}
