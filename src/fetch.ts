/**
 * Custom fetch wrapper with retry, timeout, and caching support.
 *
 * @packageDocumentation
 */

import type { Cache, Logger } from './interfaces';
import { createCacheEntry, generateCacheKey } from './cache';
import { TimeoutError, NetworkError, RefyneError } from './errors';

/**
 * Configuration for the fetch wrapper.
 */
export interface FetchConfig {
  /** Request timeout in milliseconds */
  timeout: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Cache implementation */
  cache: Cache;
  /** Whether caching is enabled */
  cacheEnabled: boolean;
  /** Logger for debugging */
  logger: Logger;
  /** API key hash for cache key generation */
  apiKeyHash: string;
}

/**
 * Calculate exponential backoff with jitter.
 *
 * @param attempt - Current attempt number (1-based)
 * @param baseMs - Base delay in milliseconds (default: 1000)
 * @param maxMs - Maximum delay in milliseconds (default: 30000)
 * @returns Delay in milliseconds with jitter applied
 */
export function calculateBackoffWithJitter(
  attempt: number,
  baseMs = 1000,
  maxMs = 30000
): number {
  // Exponential backoff: 2^(attempt-1) * baseMs
  const exponentialDelay = Math.pow(2, attempt - 1) * baseMs;
  // Cap at maximum
  const cappedDelay = Math.min(exponentialDelay, maxMs);
  // Add jitter: random value between 0% and 25% of the delay
  const jitter = Math.random() * 0.25 * cappedDelay;
  return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for a given duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable.
 */
function isRetryableError(error: unknown): boolean {
  // Network errors are retryable
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('connection') ||
      message.includes('econnreset') ||
      message.includes('econnrefused')
    );
  }
  // Don't retry timeout errors
  if (error instanceof TimeoutError) {
    return false;
  }
  return false;
}

/**
 * Create a fetch function with retry, timeout, and caching support.
 *
 * @param config - Fetch configuration
 * @returns Enhanced fetch function
 */
export function createFetchWithRetry(config: FetchConfig): typeof fetch {
  const { timeout, maxRetries, cache, cacheEnabled, logger, apiKeyHash } = config;

  return async function fetchWithRetry(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = input instanceof Request ? input.url : input.toString();
    const method = init?.method?.toUpperCase() || 'GET';

    // Check cache for GET requests
    if (cacheEnabled && method === 'GET') {
      const cacheKey = generateCacheKey(method, url, apiKeyHash);
      try {
        const cached = await cache.get(cacheKey);
        if (cached) {
          logger.debug('Cache hit', { url, cacheKey });
          // Return a synthetic response from cache
          return new Response(JSON.stringify(cached.value), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Cache': 'HIT',
            },
          });
        }
      } catch (err) {
        logger.warn('Cache get error', { url, error: String(err) });
      }
    }

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= maxRetries) {
      attempt++;

      try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(input, {
            ...init,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Handle rate limiting (429) - retry with Retry-After header
          if (response.status === 429 && attempt <= maxRetries) {
            const retryAfter = parseInt(
              response.headers.get('Retry-After') || '1',
              10
            );
            const delayMs = retryAfter * 1000;
            logger.warn('Rate limited, retrying', {
              url,
              attempt,
              retryAfterSeconds: retryAfter,
            });
            await sleep(delayMs);
            continue;
          }

          // Handle server errors (5xx) - retry with exponential backoff
          if (response.status >= 500 && attempt <= maxRetries) {
            const delayMs = calculateBackoffWithJitter(attempt);
            logger.warn('Server error, retrying', {
              url,
              attempt,
              status: response.status,
              delayMs,
            });
            await sleep(delayMs);
            continue;
          }

          // Cache successful GET responses
          if (cacheEnabled && method === 'GET' && response.ok) {
            const cacheKey = generateCacheKey(method, url, apiKeyHash);
            const cacheControlHeader = response.headers.get('Cache-Control');

            // Clone the response so we can read it for caching
            const clonedResponse = response.clone();

            try {
              const body = await clonedResponse.json();
              const entry = createCacheEntry(body, cacheControlHeader);
              if (entry) {
                await cache.set(cacheKey, entry);
                logger.debug('Cached response', { url, cacheKey });
              }
            } catch (err) {
              logger.debug('Failed to cache response', {
                url,
                error: String(err),
              });
            }
          }

          return response;
        } catch (error) {
          clearTimeout(timeoutId);

          // Handle abort (timeout)
          if (
            error instanceof Error &&
            error.name === 'AbortError'
          ) {
            throw new TimeoutError(url, timeout);
          }

          throw error;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry timeout errors
        if (error instanceof TimeoutError) {
          throw error;
        }

        // Check if this is a retryable network error
        if (isRetryableError(error) && attempt <= maxRetries) {
          const delayMs = calculateBackoffWithJitter(attempt);
          logger.warn('Network error, retrying', {
            url,
            attempt,
            error: lastError.message,
            delayMs,
          });
          await sleep(delayMs);
          continue;
        }

        // Not retryable or max retries exceeded
        if (error instanceof TimeoutError || error instanceof RefyneError) {
          throw error;
        }

        throw new NetworkError(
          `Request failed after ${attempt} attempts: ${lastError.message}`,
          lastError.message
        );
      }
    }

    // Should not reach here, but just in case
    throw lastError || new Error('Request failed');
  };
}
