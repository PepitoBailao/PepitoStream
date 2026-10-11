import axios, { AxiosError } from 'axios';
import NodeCache from 'node-cache';
import { logger } from '../utils/logger';

export interface StreamCopy {
  id: string;
  url: string;
  provider: string;
  latency?: number;
  fileSize?: number;
}

export interface FailoverResult {
  success: boolean;
  url?: string;
  provider?: string;
  copyId?: string;
  retriesAttempted: number;
  error?: string;
}

type ErrorType = 'rate_limit' | 'invalid_key' | 'expired_subscription' | 'not_cached' | 'dead_link' | 'timeout' | 'unknown';

interface ProviderBlacklist {
  until: number;
  reason: string;
  attempts: number;
}

export class FailoverService {
  private readonly MAX_COPIES = 3;
  private readonly TIMEOUT_MS = 10000;
  private readonly RETRY_DELAY_MS = 1000;
  private readonly BLACKLIST_DURATION_MS = 3600000; // 1 hour
  private providerBlacklist: Map<string, ProviderBlacklist> = new Map();
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
    logger.info('FailoverService initialized', {
      maxCopies: this.MAX_COPIES,
      timeoutMs: this.TIMEOUT_MS,
      blacklistDurationMs: this.BLACKLIST_DURATION_MS,
    });
  }

  /**
   * Execute failover with automatic retry
   */
  async executeFailover(copies: StreamCopy[]): Promise<FailoverResult> {
    const startTime = Date.now();
    let retriesAttempted = 0;

    // Filter and sort copies
    const filteredCopies = this.filterAndSortCopies(copies);

    if (filteredCopies.length === 0) {
      const error = 'No valid copies available';
      logger.error(error, { totalCopies: copies.length });
      return { success: false, retriesAttempted: 0, error };
    }

    logger.info('Starting failover', {
      totalCopies: copies.length,
      validCopies: filteredCopies.length,
      copiesIds: filteredCopies.map(c => c.id),
    });

    // Try each copy
    for (let i = 0; i < filteredCopies.length; i++) {
      const copy = filteredCopies[i];
      retriesAttempted++;

      logger.debug('Attempting copy', {
        attempt: i + 1,
        copyId: copy.id,
        provider: copy.provider,
        url: copy.url.substring(0, 50) + '...',
      });

      try {
        // Check cache first
        const cached = this.cache.get(`verified:${copy.id}`);
        if (cached) {
          logger.info('Cache hit for copy', { copyId: copy.id });
          return {
            success: true,
            url: copy.url,
            provider: copy.provider,
            copyId: copy.id,
            retriesAttempted,
          };
        }

        // Verify link
        const isValid = await this.verifyLink(copy.url, copy.provider);

        if (isValid) {
          this.cache.set(`verified:${copy.id}`, true);
          const duration = Date.now() - startTime;
          logger.info('Failover successful', {
            copyId: copy.id,
            provider: copy.provider,
            attempt: i + 1,
            retriesAttempted,
            durationMs: duration,
          });

          return {
            success: true,
            url: copy.url,
            provider: copy.provider,
            copyId: copy.id,
            retriesAttempted,
          };
        }

        logger.warn('Link verification failed', {
          copyId: copy.id,
          provider: copy.provider,
          attempt: i + 1,
        });
      } catch (error) {
        const errorType = this.parseError(error as AxiosError | Error, copy.provider);
        logger.warn('Copy attempt failed', {
          copyId: copy.id,
          provider: copy.provider,
          attempt: i + 1,
          errorType,
          error: (error as Error).message,
        });

        // Blacklist provider if fatal error
        if (this.isFatalError(errorType)) {
          this.blacklistProvider(copy.provider, errorType);
        }

        // Delay before next retry
        if (i < filteredCopies.length - 1) {
          await this.delay(this.RETRY_DELAY_MS);
        }
      }
    }

    const error = 'All failover attempts exhausted';
    const duration = Date.now() - startTime;
    logger.error(error, {
      retriesAttempted,
      durationMs: duration,
      copiesAttempted: filteredCopies.length,
    });

    return { success: false, retriesAttempted, error };
  }

  /**
   * Filter and sort copies by latency
   */
  private filterAndSortCopies(copies: StreamCopy[]): StreamCopy[] {
    return copies
      .filter(copy => {
        const blacklist = this.providerBlacklist.get(copy.provider);
        if (blacklist && blacklist.until > Date.now()) {
          logger.debug('Copy filtered (blacklisted)', {
            provider: copy.provider,
            reason: blacklist.reason,
            minutesRemaining: Math.ceil((blacklist.until - Date.now()) / 60000),
          });
          return false;
        }
        return true;
      })
      .sort((a, b) => (a.latency || 0) - (b.latency || 0))
      .slice(0, this.MAX_COPIES);
  }

  /**
   * Verify that a link is accessible
   */
  private async verifyLink(url: string, provider: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout: this.TIMEOUT_MS,
        maxRedirects: 5,
      });

      const isValid = response.status >= 200 && response.status < 400;
      logger.debug('Link verification result', {
        provider,
        status: response.status,
        isValid,
      });

      return isValid;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Parse error type
   */
  private parseError(error: AxiosError | Error, provider: string): ErrorType {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data as any;

      if (status === 429) {
        logger.warn('Rate limit error', { provider, status });
        return 'rate_limit';
      }
      if (status === 401) {
        logger.warn('Invalid key error', { provider, status });
        return 'invalid_key';
      }
      if (status === 403 && data?.message?.includes('expired')) {
        logger.warn('Expired subscription error', { provider, status });
        return 'expired_subscription';
      }
      if (status === 404) {
        logger.warn('Dead link error', { provider, status });
        return 'dead_link';
      }
      if (error.code === 'ECONNABORTED') {
        logger.warn('Timeout error', { provider });
        return 'timeout';
      }
    }

    logger.warn('Unknown error', { provider, error: (error as Error).message });
    return 'unknown';
  }

  /**
   * Check if error is fatal
   */
  private isFatalError(errorType: ErrorType): boolean {
    return ['invalid_key', 'expired_subscription', 'rate_limit'].includes(errorType);
  }

  /**
   * Blacklist provider
   */
  private blacklistProvider(provider: string, reason: string): void {
    const existing = this.providerBlacklist.get(provider);
    const attempts = (existing?.attempts || 0) + 1;

    this.providerBlacklist.set(provider, {
      until: Date.now() + this.BLACKLIST_DURATION_MS,
      reason,
      attempts,
    });

    logger.warn('Provider blacklisted', {
      provider,
      reason,
      attempts,
      durationMinutes: this.BLACKLIST_DURATION_MS / 60000,
    });
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get blacklist stats
   */
  getBlacklistStats() {
    const stats = Array.from(this.providerBlacklist.entries()).map(([provider, data]) => ({
      provider,
      reason: data.reason,
      minutesRemaining: Math.ceil((data.until - Date.now()) / 60000),
      attempts: data.attempts,
    }));

    return {
      blacklistedProviders: stats.length,
      details: stats,
    };
  }
}

export const failoverService = new FailoverService();
