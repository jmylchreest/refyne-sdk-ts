/**
 * Official TypeScript SDK for the Refyne API.
 *
 * Refyne is an LLM-powered web extraction API that transforms unstructured
 * websites into clean, typed JSON data.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { Refyne } from '@refyne/sdk';
 *
 * const client = new Refyne({ apiKey: process.env.REFYNE_API_KEY! });
 *
 * // Extract data from a single page
 * const result = await client.extract({
 *   url: 'https://example.com/product',
 *   schema: {
 *     name: 'string',
 *     price: 'number',
 *   },
 * });
 *
 * console.log(result.data);
 * ```
 */

// Main client and sub-clients
export { Refyne, RefyneBuilder, JobsClient, SchemasClient, SitesClient, KeysClient, LLMClient } from './client';
export type { RefyneConfig } from './client';
export { DEFAULT_BASE_URL, DEFAULT_TIMEOUT, DEFAULT_MAX_RETRIES } from './client';

// Re-exported types from client (which re-exports from generated types)
export type {
  ExtractRequest,
  ExtractResponse,
  CrawlRequest,
  CrawlJobResponse,
  AnalyzeRequest,
  AnalyzeResponse,
  JobResponse,
  SchemaOutput,
  SavedSiteOutput,
  UsageResponse,
} from './client';

// Interfaces for dependency injection
export type {
  Logger,
  Cache,
  CacheEntry,
  CacheControlDirectives,
} from './interfaces';
export { defaultLogger } from './interfaces';

// Cache implementation
export { MemoryCache, parseCacheControl, createCacheEntry, hashStringAsync } from './cache';
export type { MemoryCacheConfig } from './cache';

// Fetch utilities (for custom implementations)
export { calculateBackoffWithJitter } from './fetch';

// Error types
export {
  RefyneError,
  RateLimitError,
  ValidationError,
  UnsupportedAPIVersionError,
  TLSError,
  TimeoutError,
  NetworkError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
} from './errors';

// Version information
export {
  SDK_VERSION,
  MIN_API_VERSION,
  MAX_KNOWN_API_VERSION,
  buildUserAgent,
  detectRuntime,
} from './version';

// Re-export the generated types for advanced usage
export type { paths, components, operations } from './types';

// Default export
export { default } from './client';
