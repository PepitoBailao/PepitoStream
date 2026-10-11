import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
}

export interface Content {
  id: string;
  title: string;
  slug: string;
  type: 'MOVIE' | 'TV_SERIES' | 'ANIME';
  description?: string;
  image?: string;
  rating?: number;
  genres: string[];
  isAnime: boolean;
}

export interface AppState {
  // Auth
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;

  // UI
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Search & Browse
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;

  // Content
  favorites: Content[];
  addFavorite: (content: Content) => void;
  removeFavorite: (contentId: string) => void;
  watchHistory: Content[];
  addToWatchHistory: (content: Content) => void;

  // Preferences
  preferredQuality: string;
  setPreferredQuality: (quality: string) => void;
  preferredLanguage: string;
  setPreferredLanguage: (language: string) => void;

  // Playback
  currentContent: Content | null;
  setCurrentContent: (content: Content | null) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  duration: number;
  setDuration: (duration: number) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth
      user: null,
      token: null,
      isLoggedIn: false,
      setUser: (user) => set({ user, isLoggedIn: !!user }),
      setToken: (token) => set({ token }),
      logout: () => set({ user: null, token: null, isLoggedIn: false }),

      // UI
      theme: 'dark',
      toggleTheme: () => set((state) => ({
        theme: state.theme === 'dark' ? 'light' : 'dark',
      })),
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // Search & Browse
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      recentSearches: [],
      addRecentSearch: (query) => set((state) => ({
        recentSearches: [query, ...state.recentSearches.filter(q => q !== query)].slice(0, 10),
      })),
      clearRecentSearches: () => set({ recentSearches: [] }),

      // Content
      favorites: [],
      addFavorite: (content) => set((state) => ({
        favorites: [...state.favorites, content].filter(
          (item, index, self) => index === self.findIndex(c => c.id === item.id)
        ),
      })),
      removeFavorite: (contentId) => set((state) => ({
        favorites: state.favorites.filter(c => c.id !== contentId),
      })),
      watchHistory: [],
      addToWatchHistory: (content) => set((state) => ({
        watchHistory: [content, ...state.watchHistory.filter(c => c.id !== content.id)].slice(0, 50),
      })),

      // Preferences
      preferredQuality: '1080p',
      setPreferredQuality: (quality) => set({ preferredQuality: quality }),
      preferredLanguage: 'fr',
      setPreferredLanguage: (language) => set({ preferredLanguage: language }),

      // Playback
      currentContent: null,
      setCurrentContent: (content) => set({ currentContent: content }),
      currentTime: 0,
      setCurrentTime: (time) => set({ currentTime: time }),
      duration: 0,
      setDuration: (duration) => set({ duration }),
    }),
    {
      name: 'pepito-stream-store',
      partialize: (state) => ({
        theme: state.theme,
        favorites: state.favorites,
        watchHistory: state.watchHistory,
        recentSearches: state.recentSearches,
        preferredQuality: state.preferredQuality,
        preferredLanguage: state.preferredLanguage,
      }),
    }
  )
);