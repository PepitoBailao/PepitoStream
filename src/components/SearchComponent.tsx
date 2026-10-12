import React, { useState, useCallback, useMemo } from 'react';
import { debounce } from 'lodash';
import axios from 'axios';
import './SearchComponent.css';

interface SearchResult {
  id: string;
  title: string;
  poster: string;
  rating: number;
  year: number;
  type: 'movie' | 'series' | 'anime';
  sources: number;
}

interface SearchComponentProps {
  onSelect?: (result: SearchResult) => void;
  placeholder?: string;
  initialQuery?: string;
}

export const SearchComponent: React.FC<SearchComponentProps> = ({
  onSelect,
  placeholder = 'Chercher un film, série...',
  initialQuery = ''
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [autocomplete, setAutocomplete] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filters, setFilters] = useState({
    type: 'all' as 'all' | 'movie' | 'series' | 'anime',
    minRating: 0,
    year: null as number | null,
    minSources: 1
  });

  // Debounced search
  const performSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      try {
        setIsLoading(true);
        const response = await axios.get('/api/streams/search', {
          params: {
            q: searchQuery,
            type: filters.type !== 'all' ? filters.type : undefined,
            minRating: filters.minRating,
            year: filters.year,
            minSources: filters.minSources
          },
          timeout: 10000
        });
        setResults(response.data.results || []);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [filters]
  );

  // Debounced autocomplete
  const performAutocomplete = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setAutocomplete([]);
        return;
      }

      try {
        const response = await axios.get('/api/streams/autocomplete', {
          params: { q: searchQuery },
          timeout: 5000
        });
        setAutocomplete(response.data.suggestions || []);
      } catch (error) {
        console.error('Autocomplete error:', error);
        setAutocomplete([]);
      }
    }, 200),
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    performAutocomplete(value);
    performSearch(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelectResult(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setResults([]);
        setAutocomplete([]);
        break;
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    onSelect?.(result);
    setQuery(result.title);
    setResults([]);
    setAutocomplete([]);
  };

  const handleSelectAutocomplete = (suggestion: string) => {
    setQuery(suggestion);
    performSearch(suggestion);
    setAutocomplete([]);
  };

  const filteredResults = useMemo(() => {
    return results.filter(r => {
      if (filters.type !== 'all' && r.type !== filters.type) return false;
      if (r.rating < filters.minRating) return false;
      if (filters.year && r.year !== filters.year) return false;
      if (r.sources < filters.minSources) return false;
      return true;
    });
  }, [results, filters]);

  return (
    <div className="search-container">
      <div className="search-header">
        <div className="search-input-wrapper">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="search-input"
            autoComplete="off"
          />
          {isLoading && <div className="search-loader">⏳</div>}
        </div>

        {/* Autocomplete Dropdown */}
        {autocomplete.length > 0 && (
          <div className="autocomplete-dropdown">
            {autocomplete.map((suggestion, idx) => (
              <div
                key={idx}
                className="autocomplete-item"
                onClick={() => handleSelectAutocomplete(suggestion)}
              >
                🔍 {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="search-filters">
        <select
          value={filters.type}
          onChange={e => setFilters({ ...filters, type: e.target.value as any })}
          className="filter-select"
        >
          <option value="all">Tous les types</option>
          <option value="movie">Films</option>
          <option value="series">Séries</option>
          <option value="anime">Anime</option>
        </select>

        <input
          type="range"
          min="0"
          max="10"
          step="0.5"
          value={filters.minRating}
          onChange={e => setFilters({ ...filters, minRating: parseFloat(e.target.value) })}
          className="filter-range"
          title="Rating minimum"
        />
        <span className="filter-value">⭐ {filters.minRating.toFixed(1)}+</span>

        <input
          type="number"
          placeholder="Année"
          value={filters.year || ''}
          onChange={e => setFilters({ ...filters, year: e.target.value ? parseInt(e.target.value) : null })}
          className="filter-input"
        />

        <input
          type="number"
          min="1"
          placeholder="Min sources"
          value={filters.minSources}
          onChange={e => setFilters({ ...filters, minSources: parseInt(e.target.value) || 1 })}
          className="filter-input"
        />
      </div>

      {/* Results */}
      <div className="search-results">
        {filteredResults.length === 0 && query && !isLoading && (
          <div className="no-results">
            <p>Aucun résultat pour "{query}"</p>
          </div>
        )}

        {filteredResults.map((result, idx) => (
          <div
            key={result.id}
            className={`result-card ${selectedIndex === idx ? 'selected' : ''}`}
            onClick={() => handleSelectResult(result)}
          >
            <img src={result.poster} alt={result.title} className="result-poster" />
            <div className="result-info">
              <h3 className="result-title">{result.title}</h3>
              <div className="result-meta">
                <span className="badge">{result.type}</span>
                <span className="rating">⭐ {result.rating}/10</span>
                <span className="year">{result.year}</span>
              </div>
              <div className="result-sources">
                📺 {result.sources} sources disponibles
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchComponent;