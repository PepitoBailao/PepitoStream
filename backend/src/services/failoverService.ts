import axios, { AxiosError } from 'axios';

/**
 * Failover service for streaming with up to 3 copies per release.
 * Implements retry logic, provider blacklisting, and timeout handling.
 */

interface StreamCopy {
  provider: string; // e.g., "YGG", "1337x", "C411"
  url: string;
  latency: number; // ms
}

interface TorBoxError {
  type:
    | 'rate_limit'
    | 'invalid_key'
    | 'expired_subscription'
    | 'not_cached'
    | 'dead_link'
    | 'unknown';
  message: string;
  code?: number;
}

class FailoverService {
  private blacklistedProviders: Map<string, { until: number }> = new Map();
  private blacklistDuration = 3600000; // 1 hour
  private timeoutPerCopy = 10000; // 10 seconds per copy
  private maxCopies = 3;

  /**
   * Attempt to stream from multiple copies, with failover.
   * @param copies - array of available copies
   * @returns URL of the first successful copy
   * @throws Error if all copies fail
   */
  async getStreamWithFailover(copies: StreamCopy[]): Promise<string> {
    if (!copies || copies.length === 0) {
      throw new Error('No copies available');
    }

    // Sort by latency (lowest first) and filter blacklisted providers
    const validCopies = copies
      .filter((c) => !this.isBlacklisted(c.provider))
      .sort((a, b) => a.latency - b.latency)
      .slice(0, this.maxCopies);

    if (validCopies.length === 0) {
      throw new Error('All providers are blacklisted');
    }

    const errors: { provider: string; error: TorBoxError }[] = [];

    for (const copy of validCopies) {
      try {
        const url = await this.attemptStream(copy.url);
        return url;
      } catch (error) {
        const torboxError = this.parseTorBoxError(error);
        errors.push({ provider: copy.provider, error: torboxError });

        // Blacklist provider on certain errors
        if (
          torboxError.type === 'invalid_key' ||
          torboxError.type === 'expired_subscription' ||
          torboxError.type === 'dead_link'
        ) {
          this.blacklistProvider(copy.provider);
        }

        // Continue to next copy
      }
    }

    // All copies failed
    const errorSummary = errors
      .map((e) => `${e.provider}: ${e.error.message}`)
      .join('; ');
    throw new Error(`All copies failed: ${errorSummary}`);
  }

  /**
   * Attempt to fetch stream URL from TorBox API.
   * @param torboxUrl - TorBox instant availability URL
   * @returns stream URL
   */
  private async attemptStream(torboxUrl: string): Promise<string> {
    try {
      const response = await axios.get(torboxUrl, {
        timeout: this.timeoutPerCopy,
        headers: {
          'User-Agent': 'PepitoStream/1.0',
        },
      });

      // Assuming TorBox returns a URL or a response with a URL field
      if (response.data && response.data.url) {
        return response.data.url;
      } else if (typeof response.data === 'string') {
        return response.data;
      }

      throw new Error('Invalid TorBox response format');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Parse TorBox-specific error responses.
   * @param error - axios error or generic error
   * @returns TorBoxError object
   */
  private parseTorBoxError(error: any): TorBoxError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status || 0;
      const data = axiosError.response?.data as Record<string, any> || {};

      if (status === 429 || data.error?.includes('rate')) {
        return {
          type: 'rate_limit',
          message: 'TorBox rate limit exceeded',
          code: 429,
        };
      }

      if (status === 401 || data.error?.includes('key')) {
        return {
          type: 'invalid_key',
          message: 'Invalid TorBox API key',
          code: 401,
        };
      }

      if (status === 403 || data.error?.includes('subscription')) {
        return {
          type: 'expired_subscription',
          message: 'TorBox subscription expired or inactive',
          code: 403,
        };
      }

      if (status === 404 || data.error?.includes('not found')) {
        return {
          type: 'not_cached',
          message: 'Content not cached on TorBox',
          code: 404,
        };
      }

      if (data.error?.includes('dead') || data.error?.includes('torrent')) {
        return {
          type: 'dead_link',
          message: 'Torrent is dead or unreachable',
        };
      }

      if (axiosError.code === 'ECONNABORTED' || status === 408) {
        return {
          type: 'not_cached',
          message: 'Request timeout (content not cached)',
          code: 408,
        };
      }

      return {
        type: 'unknown',
        message: `HTTP ${status}: ${data.error || axiosError.message}`,
        code: status,
      };
    }

    return {
      type: 'unknown',
      message: error?.message || 'Unknown error',
    };
  }

  /**
   * Blacklist a provider for a set duration.
   * @param provider - provider name
   */
  private blacklistProvider(provider: string): void {
    this.blacklistedProviders.set(provider, {
      until: Date.now() + this.blacklistDuration,
    });
  }

  /**
   * Check if a provider is currently blacklisted.
   * @param provider - provider name
   * @returns true if blacklisted
   */
  private isBlacklisted(provider: string): boolean {
    const record = this.blacklistedProviders.get(provider);
    if (!record) {
      return false;
    }

    if (Date.now() > record.until) {
      this.blacklistedProviders.delete(provider);
      return false;
    }

    return true;
  }

  /**
   * Get blacklist status (for debugging).
   */
  getBlacklistStatus() {
    const now = Date.now();
    return Array.from(this.blacklistedProviders.entries())
      .filter(([_, record]) => now <= record.until)
      .map(([provider, record]) => ({
        provider,
        unblockAt: new Date(record.until),
      }));
  }

  /**
   * Clear all blacklisted providers (for testing).
   */
  clearBlacklist(): void {
    this.blacklistedProviders.clear();
  }
}

export default new FailoverService();
