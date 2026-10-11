import axios from 'axios';
import failoverService from '../../backend/src/services/failoverService';

interface TorBoxRelease {
  name: string;
  size: number;
  seeders: number;
  leechers: number;
  file_index?: number;
  instant_availability?: boolean;
  magnet?: string;
  hash?: string;
}

interface StreamCopy {
  provider: string;
  url: string;
  latency: number;
}

interface SearchResult {
  id: string;
  title: string;
  type: 'movie' | 'series';
  year: number;
  poster?: string;
  rating?: number;
  releases?: TorBoxRelease[];
}

const TORBOX_API_BASE = process.env.TORBOX_API_URL || 'https://api.torbox.app/v1/';
const TORBOX_API_KEY = process.env.TORBOX_API_KEY || '';
const TORBOX_INSTANT_LIMIT_GB = 2;

/**
 * Search for content on TorBox (movies and anime).
 * @param query - search query
 * @returns array of search results
 */
export async function searchContent(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) {
    throw new Error('Search query cannot be empty');
  }

  try {
    // Search TorBox for releases
    const response = await axios.get(`${TORBOX_API_BASE}instant/search`, {
      params: {
        query: query.trim(),
        token: TORBOX_API_KEY,
      },
      timeout: 10000,
    });

    const releases = response.data.data || [];

    // Parse releases and group by title
    const results: SearchResult[] = parseSearchResults(releases, query);

    return results;
  } catch (error) {
    console.error('Search error:', error);
    throw new Error('Failed to search for content');
  }
}

/**
 * Get stream URL for a specific release with failover support.
 * @param releaseHash - torrent hash or name
 * @returns stream URL
 */
export async function getStreamUrl(releaseHash: string): Promise<string> {
  if (!releaseHash || releaseHash.trim().length === 0) {
    throw new Error('Release hash cannot be empty');
  }

  try {
    // Fetch available copies from TorBox
    const instantResponse = await axios.get(`${TORBOX_API_BASE}instant/list`, {
      params: {
        token: TORBOX_API_KEY,
        hash: releaseHash,
      },
      timeout: 5000,
    });

    const data = instantResponse.data.data || [];

    // Build list of copies with metadata
    const copies: StreamCopy[] = data
      .filter((item: any) => {
        const sizeGB = item.size / (1024 * 1024 * 1024);
        return sizeGB <= TORBOX_INSTANT_LIMIT_GB && item.instant_availability;
      })
      .map((item: any, index: number) => ({
        provider: item.provider || `Provider_${index}`,
        url: item.instant_url || item.url,
        latency: item.latency_ms || 0,
      }));

    if (copies.length === 0) {
      throw new Error('No suitable copies found (size limit 2GB, instant availability required)');
    }

    // Use failover service to get stream URL
    const streamUrl = await failoverService.getStreamWithFailover(copies);

    return streamUrl;
  } catch (error) {
    console.error('Stream fetch error:', error);
    throw new Error('Failed to get stream URL');
  }
}

/**
 * Parse TorBox search results into a unified format.
 * Supports movies and anime.
 */
function parseSearchResults(releases: any[], query: string): SearchResult[] {
  const groupedByTitle: Map<string, SearchResult> = new Map();

  releases.forEach((release: TorBoxRelease, index: number) => {
    const title = release.name.split(/[.\s-]/).slice(0, 2).join(' ');
    const key = title.toLowerCase();

    if (!groupedByTitle.has(key)) {
      groupedByTitle.set(key, {
        id: `${key}_${index}`,
        title,
        type: detectType(release.name),
        year: extractYear(release.name),
        rating: undefined,
        releases: [],
      });
    }

    const result = groupedByTitle.get(key)!;
    result.releases!.push(release);
  });

  return Array.from(groupedByTitle.values());
}

/**
 * Detect content type from release name (movie or series).
 */
function detectType(releaseName: string): 'movie' | 'series' {
  const seriesIndicators = ['S\\d{2}E\\d{2}', 'Season', 'Episode', 'Complete'];
  const isSeries = seriesIndicators.some((indicator) => new RegExp(indicator, 'i').test(releaseName));
  return isSeries ? 'series' : 'movie';
}

/**
 * Extract year from release name.
 */
function extractYear(releaseName: string): number {
  const yearMatch = releaseName.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();
}

/**
 * Get failover status (for debugging and stats).
 */
export function getFailoverStatus() {
  return {
    blacklistedProviders: failoverService.getBlacklistStatus(),
  };
}
