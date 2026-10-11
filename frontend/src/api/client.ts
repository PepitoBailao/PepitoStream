import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(email: string, password: string) {
    const res = await this.client.post('/auth/login', { email, password });
    if (res.data.token) {
      localStorage.setItem('token', res.data.token);
    }
    return res.data;
  }

  async register(email: string, username: string, password: string) {
    return this.client.post('/auth/register', { email, username, password });
  }

  async getCurrentUser() {
    return this.client.get('/auth/me');
  }

  // Search
  async search(query: string, options?: any) {
    return this.client.get('/search', { params: { q: query, ...options } });
  }

  async getTrending(options?: any) {
    return this.client.get('/content/trending', { params: options });
  }

  async getPopular(options?: any) {
    return this.client.get('/content/popular', { params: options });
  }

  // Content
  async getContent(id: string) {
    return this.client.get(`/content/${id}`);
  }

  async getSources(contentId: string, episodeId?: string) {
    const params = episodeId ? { episodeId } : {};
    return this.client.get(`/content/${contentId}/sources`, { params });
  }

  // User
  async getFavorites() {
    return this.client.get('/user/favorites');
  }

  async addFavorite(contentId: string) {
    return this.client.post('/user/favorites', { contentId });
  }

  async removeFavorite(contentId: string) {
    return this.client.delete(`/user/favorites/${contentId}`);
  }

  async getWatchHistory() {
    return this.client.get('/user/watch-history');
  }

  async updateStreamProgress(contentId: string, watched: number, total: number) {
    return this.client.post('/stream/progress', { contentId, watched, total });
  }
}

export const apiClient = new ApiClient();