/**
 * Cache implementation that respects Cache-Control headers.
 *
 * @packageDocumentation
 */

import type { Cache, CacheEntry, CacheControlDirectives, Logger } from './interfaces';

/**
 * Parse Cache-Control header into directives.
 *
 * @param header - The Cache-Control header value
 * @returns Parsed directives
 *
 * @example
 * ```typescript
 * parseCacheControl('private, max-age=3600, stale-while-revalidate=60')
 * // Returns: { private: true, maxAge: 3600, staleWhileRevalidate: 60 }
 * ```
 */
export function parseCacheControl(header: string | null): CacheControlDirectives {
  if (!header) {
    return {};
  }

  const directives: CacheControlDirectives = {};

  const parts = header.toLowerCase().split(',').map((s) => s.trim());

  for (const part of parts) {
    if (part === 'no-store') {
      directives.noStore = true;
    } else if (part === 'no-cache') {
      directives.noCache = true;
    } else if (part === 'private') {
      directives.private = true;
    } else if (part.startsWith('max-age=')) {
      const value = parseInt(part.substring(8), 10);
      if (!isNaN(value)) {
        directives.maxAge = value;
      }
    } else if (part.startsWith('stale-while-revalidate=')) {
      const value = parseInt(part.substring(23), 10);
      if (!isNaN(value)) {
        directives.staleWhileRevalidate = value;
      }
    }
  }

  return directives;
}

/**
 * Generate a cache key from request details.
 *
 * @param method - HTTP method
 * @param url - Request URL
 * @param authHash - Hash of the auth token (for user-specific caching)
 * @returns Cache key string
 */
export function generateCacheKey(
  method: string,
  url: string,
  authHash?: string
): string {
  const parts = [method.toUpperCase(), url];
  if (authHash) {
    parts.push(authHash);
  }
  return parts.join(':');
}

/**
 * Simple hash function for auth tokens.
 * This isn't cryptographically secure, but it's fine for cache key differentiation.
 * @internal
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Configuration for the in-memory cache.
 */
export interface MemoryCacheConfig {
  /** Maximum number of entries to store (default: 100) */
  maxEntries?: number;
  /** Logger for cache operations */
  logger?: Logger;
}

/**
 * In-memory cache implementation that respects Cache-Control headers.
 *
 * This is the default cache used by the SDK. It stores entries in memory
 * and automatically evicts the oldest entries when the limit is reached.
 *
 * @example
 * ```typescript
 * const cache = new MemoryCache({ maxEntries: 50 });
 * const client = new Refyne.Builder()
 *   .apiKey(key)
 *   .cache(cache)
 *   .build();
 * ```
 */
export class MemoryCache implements Cache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly logger?: Logger;

  constructor(config: MemoryCacheConfig = {}) {
    this.maxEntries = config.maxEntries ?? 100;
    this.logger = config.logger;
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    const entry = this.store.get(key);

    if (!entry) {
      return undefined;
    }

    const now = Date.now();

    // Check if entry has expired
    if (entry.expiresAt < now) {
      // Check for stale-while-revalidate
      if (entry.cacheControl.staleWhileRevalidate) {
        const staleDeadline = entry.expiresAt + (entry.cacheControl.staleWhileRevalidate * 1000);
        if (now < staleDeadline) {
          this.logger?.debug('Serving stale cache entry', { key });
          return entry;
        }
      }

      // Entry is fully expired
      this.store.delete(key);
      this.logger?.debug('Cache entry expired', { key });
      return undefined;
    }

    this.logger?.debug('Cache hit', { key });
    return entry;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    // Don't cache if no-store
    if (entry.cacheControl.noStore) {
      this.logger?.debug('Not caching due to no-store', { key });
      return;
    }

    // Evict oldest entries if at capacity
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
        this.logger?.debug('Evicted oldest cache entry', { key: oldestKey });
      }
    }

    this.store.set(key, entry);
    this.logger?.debug('Cache set', { key, expiresAt: entry.expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.logger?.debug('Cache delete', { key });
  }

  /** Clear all cache entries */
  clear(): void {
    this.store.clear();
    this.logger?.debug('Cache cleared');
  }

  /** Get the current number of cached entries */
  get size(): number {
    return this.store.size;
  }
}

/**
 * Create a cache entry from a response.
 *
 * @param value - The response body to cache
 * @param cacheControlHeader - The Cache-Control header value
 * @returns Cache entry, or undefined if response should not be cached
 */
export function createCacheEntry(
  value: unknown,
  cacheControlHeader: string | null
): CacheEntry | undefined {
  const cacheControl = parseCacheControl(cacheControlHeader);

  // Don't cache if no-store
  if (cacheControl.noStore) {
    return undefined;
  }

  // Calculate expiry
  let expiresAt = Date.now();

  if (cacheControl.maxAge !== undefined) {
    expiresAt += cacheControl.maxAge * 1000;
  } else {
    // No max-age specified, don't cache
    return undefined;
  }

  return {
    value,
    expiresAt,
    cacheControl,
  };
}
