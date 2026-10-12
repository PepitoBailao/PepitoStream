import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface UseStreamOptions {
  streamId: string;
  autoFetch?: boolean;
  timeout?: number;
}

interface StreamData {
  id: string;
  title: string;
  poster: string;
  synopsis: string;
  rating: number;
  year: number;
  genres: string[];
  runtime: number;
  director: string;
  cast: string[];
  sources: any[];
  bestSource: any;
  availableAudio: any[];
}

export function useStream({ streamId, autoFetch = true, timeout = 10000 }: UseStreamOptions) {
  const [data, setData] = useState<StreamData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStream = useCallback(async () => {
    if (!streamId) return;

    try {
      setIsLoading(true);
      setError(null);
      const response = await axios.get(`/api/streams/${streamId}`, { timeout });
      setData(response.data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error('Stream fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [streamId, timeout]);

  useEffect(() => {
    if (autoFetch) {
      fetchStream();
    }
  }, [autoFetch, fetchStream]);

  const refetch = useCallback(() => {
    fetchStream();
  }, [fetchStream]);

  return { data, isLoading, error, refetch };
}
