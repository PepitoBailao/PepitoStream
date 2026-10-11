import React, { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { SearchIcon, XIcon } from 'lucide-react';

interface SearchProps {
  onSearch?: (query: string) => void;
  autoFocus?: boolean;
}

export const Search: React.FC<SearchProps> = ({ onSearch, autoFocus = true }) => {
  const { searchQuery, setSearchQuery, recentSearches, addRecentSearch } = useStore();
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = useCallback((query: string) => {
    if (query.trim()) {
      setSearchQuery(query);
      addRecentSearch(query);
      onSearch?.(query);
      setIsOpen(false);
    }
  }, [setSearchQuery, addRecentSearch, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch((e.target as HTMLInputElement).value);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
  };

  return (
    <div className="relative w-full max-w-2xl">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder="Rechercher films, séries, animes..."
          autoFocus={autoFocus}
          className="w-full pl-10 pr-10 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition"
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
          >
            <XIcon className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        )}
      </div>

      {/* Dropdown with recent searches */}
      {isOpen && recentSearches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-3">
            <p className="text-xs text-gray-400 uppercase mb-2">Recherches récentes</p>
            {recentSearches.slice(0, 5).map((search, index) => (
              <button
                key={index}
                onClick={() => handleSearch(search)}
                className="block w-full text-left px-3 py-2 text-gray-300 hover:bg-gray-700 rounded transition text-sm"
              >
                {search}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};