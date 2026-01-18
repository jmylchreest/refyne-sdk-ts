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
 * const refyne = new Refyne.Builder()
 *   .apiKey(process.env.REFYNE_API_KEY!)
 *   .build();
 *
 * // Extract data from a single page
 * const result = await refyne.extract({
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

// Main client
export { Refyne, RefyneBuilder } from './client';
export type { RefyneConfig } from './client';

// Interfaces for dependency injection
export type {
  Logger,
  HttpClient,
  Cache,
  CacheEntry,
  CacheControlDirectives,
} from './interfaces';
export { defaultLogger, defaultHttpClient } from './interfaces';

// Cache implementation
export { MemoryCache, parseCacheControl, createCacheEntry } from './cache';
export type { MemoryCacheConfig } from './cache';

// Error types
export {
  RefyneError,
  RateLimitError,
  ValidationError,
  UnsupportedAPIVersionError,
  TLSError,
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

// API types
export type {
  // Requests
  ExtractRequest,
  CrawlRequest,
  CrawlOptions,
  LlmConfig,
  AnalyzeRequest,
  CreateSchemaRequest,
  CreateSiteRequest,
  CreateApiKeyRequest,
  UpsertLlmKeyRequest,
  SetLlmChainRequest,
  // Responses
  ExtractResponse,
  TokenUsage,
  ExtractionMetadata,
  CrawlJobCreated,
  JobStatus,
  Job,
  JobList,
  JobResults,
  AnalyzeResponse,
  Schema,
  SchemaList,
  Site,
  SiteList,
  ApiKey,
  ApiKeyList,
  ApiKeyCreated,
  UsageResponse,
  LlmKey,
  LlmKeyList,
  LlmChain,
  LlmChainEntry,
  Model,
  ModelList,
  HealthResponse,
  ErrorResponse,
  // Streaming
  JobEventType,
  JobEvent,
  JobStatusEvent,
  JobProgressEvent,
  JobResultEvent,
  JobErrorEvent,
  JobCompleteEvent,
} from './types';
