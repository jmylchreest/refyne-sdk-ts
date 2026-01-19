/**
 * Interfaces for dependency injection in the Refyne SDK.
 *
 * These interfaces allow you to inject custom implementations for logging,
 * HTTP requests, and caching. This enables easy testing and integration
 * with your application's existing infrastructure.
 *
 * @packageDocumentation
 */

/**
 * Logger interface for SDK logging.
 *
 * Implement this interface to integrate with your application's logger
 * (e.g., pino, winston, console).
 *
 * @example
 * ```typescript
 * import pino from 'pino';
 *
 * const pinoLogger = pino();
 *
 * const logger: Logger = {
 *   debug: (msg, meta) => pinoLogger.debug(meta, msg),
 *   info: (msg, meta) => pinoLogger.info(meta, msg),
 *   warn: (msg, meta) => pinoLogger.warn(meta, msg),
 *   error: (msg, meta) => pinoLogger.error(meta, msg),
 * };
 * ```
 */
export interface Logger {
  /** Log a debug message */
  debug(msg: string, meta?: Record<string, unknown>): void;
  /** Log an info message */
  info(msg: string, meta?: Record<string, unknown>): void;
  /** Log a warning message */
  warn(msg: string, meta?: Record<string, unknown>): void;
  /** Log an error message */
  error(msg: string, meta?: Record<string, unknown>): void;
}


/**
 * Cache entry with value and metadata.
 */
export interface CacheEntry {
  /** The cached response body */
  value: unknown;
  /** When the entry expires (Unix timestamp in ms) */
  expiresAt: number;
  /** Cache-Control directives from the response */
  cacheControl: CacheControlDirectives;
}

/**
 * Parsed Cache-Control header directives.
 */
export interface CacheControlDirectives {
  /** Maximum age in seconds */
  maxAge?: number;
  /** Whether to never cache */
  noStore?: boolean;
  /** Whether to revalidate before using */
  noCache?: boolean;
  /** Whether this is private (user-specific) data */
  private?: boolean;
  /** Stale-while-revalidate window in seconds */
  staleWhileRevalidate?: number;
}

/**
 * Cache interface for response caching.
 *
 * The SDK includes a default in-memory cache that respects Cache-Control headers.
 * Implement this interface to use Redis, localStorage, or another cache backend.
 *
 * @example
 * ```typescript
 * // Redis cache implementation
 * import { createClient } from 'redis';
 *
 * const redis = createClient();
 *
 * const redisCache: Cache = {
 *   async get(key) {
 *     const data = await redis.get(key);
 *     return data ? JSON.parse(data) : undefined;
 *   },
 *   async set(key, entry) {
 *     const ttl = Math.max(0, entry.expiresAt - Date.now());
 *     await redis.set(key, JSON.stringify(entry), { PX: ttl });
 *   },
 *   async delete(key) {
 *     await redis.del(key);
 *   },
 * };
 * ```
 */
export interface Cache {
  /**
   * Get a cached entry by key.
   * @param key - The cache key
   * @returns The cached entry, or undefined if not found/expired
   */
  get(key: string): Promise<CacheEntry | undefined>;

  /**
   * Set a cache entry.
   * @param key - The cache key
   * @param entry - The entry to cache
   */
  set(key: string, entry: CacheEntry): Promise<void>;

  /**
   * Delete a cache entry.
   * @param key - The cache key to delete
   */
  delete(key: string): Promise<void>;
}

/**
 * Default console logger implementation.
 * @internal
 */
export const defaultLogger: Logger = {
  debug: (msg, meta) => {
    if (process.env.DEBUG) {
      console.debug(`[Refyne SDK] ${msg}`, meta || '');
    }
  },
  info: (msg, meta) => console.info(`[Refyne SDK] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[Refyne SDK] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[Refyne SDK] ${msg}`, meta || ''),
};

