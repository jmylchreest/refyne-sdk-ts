/**
 * Main Refyne client implementation.
 *
 * @packageDocumentation
 */

import type {
  Logger,
  HttpClient,
  Cache,
} from './interfaces';
import { defaultLogger, defaultHttpClient } from './interfaces';
import { MemoryCache, createCacheEntry, generateCacheKey, hashString } from './cache';
import {
  RefyneError,
  createErrorFromResponse,
} from './errors';
import {
  buildUserAgent,
  checkAPIVersionCompatibility,
} from './version';
import type {
  ExtractRequest,
  ExtractResponse,
  CrawlRequest,
  CrawlJobCreated,
  Job,
  JobList,
  JobResults,
  AnalyzeRequest,
  AnalyzeResponse,
  Schema,
  SchemaList,
  CreateSchemaRequest,
  Site,
  SiteList,
  CreateSiteRequest,
  ApiKeyList,
  ApiKeyCreated,
  CreateApiKeyRequest,
  UsageResponse,
  LlmKey,
  LlmKeyList,
  UpsertLlmKeyRequest,
  LlmChain,
  SetLlmChainRequest,
  ModelList,
  JobEvent,
} from './types';

/**
 * Configuration options for the Refyne client.
 */
export interface RefyneConfig {
  /** Your Refyne API key */
  apiKey: string;
  /** Base URL for the API (default: https://api.refyne.uk) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum retry attempts for failed requests (default: 3) */
  maxRetries?: number;
  /** Custom logger implementation */
  logger?: Logger;
  /** Custom HTTP client implementation */
  httpClient?: HttpClient;
  /** Custom cache implementation */
  cache?: Cache;
  /** Whether caching is enabled (default: true) */
  cacheEnabled?: boolean;
  /** Custom User-Agent suffix (e.g., "MyApp/1.0") */
  userAgentSuffix?: string;
  /** Dangerously disable TLS certificate verification (default: false) */
  dangerouslyDisableTLSVerification?: boolean;
}

/**
 * Fluent builder for creating Refyne client instances.
 *
 * @example
 * ```typescript
 * const client = new Refyne.Builder()
 *   .apiKey(process.env.REFYNE_API_KEY!)
 *   .baseUrl('https://api.refyne.uk')
 *   .logger(myLogger)
 *   .timeout(60000)
 *   .build();
 * ```
 */
export class RefyneBuilder {
  private config: Partial<RefyneConfig> = {};

  /** Set the API key (required) */
  apiKey(key: string): this {
    this.config.apiKey = key;
    return this;
  }

  /** Set the base URL */
  baseUrl(url: string): this {
    this.config.baseUrl = url;
    return this;
  }

  /** Set the request timeout in milliseconds */
  timeout(ms: number): this {
    this.config.timeout = ms;
    return this;
  }

  /** Set maximum retry attempts */
  maxRetries(count: number): this {
    this.config.maxRetries = count;
    return this;
  }

  /** Set a custom logger */
  logger(logger: Logger): this {
    this.config.logger = logger;
    return this;
  }

  /** Set a custom HTTP client */
  httpClient(client: HttpClient): this {
    this.config.httpClient = client;
    return this;
  }

  /** Set a custom cache */
  cache(cache: Cache): this {
    this.config.cache = cache;
    return this;
  }

  /** Enable or disable caching */
  cacheEnabled(enabled: boolean): this {
    this.config.cacheEnabled = enabled;
    return this;
  }

  /** Set a custom User-Agent suffix */
  userAgentSuffix(suffix: string): this {
    this.config.userAgentSuffix = suffix;
    return this;
  }

  /**
   * Disable TLS certificate verification.
   *
   * **WARNING**: This is dangerous and should only be used for development
   * with self-signed certificates. Never use in production.
   */
  dangerouslyDisableTLSVerification(disable: boolean): this {
    this.config.dangerouslyDisableTLSVerification = disable;
    return this;
  }

  /** Build the Refyne client instance */
  build(): Refyne {
    if (!this.config.apiKey) {
      throw new Error('API key is required. Call .apiKey() before .build()');
    }
    return new Refyne(this.config as RefyneConfig);
  }
}

/**
 * The main Refyne SDK client.
 *
 * Provides methods for extracting data from web pages, managing crawl jobs,
 * and configuring LLM providers.
 *
 * @example
 * ```typescript
 * import { Refyne } from '@refyne/sdk';
 *
 * const refyne = new Refyne.Builder()
 *   .apiKey(process.env.REFYNE_API_KEY!)
 *   .build();
 *
 * // Extract data from a page
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
export class Refyne {
  /** Builder class for fluent configuration */
  static Builder = RefyneBuilder;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly logger: Logger;
  private readonly httpClient: HttpClient;
  private readonly cache: Cache;
  private readonly cacheEnabled: boolean;
  private readonly userAgent: string;
  private readonly dangerouslyDisableTLSVerification: boolean;

  private apiVersionChecked = false;
  private authHash: string;

  /** Job-related operations */
  readonly jobs: JobsClient;

  /** Schema catalog operations */
  readonly schemas: SchemasClient;

  /** Saved sites operations */
  readonly sites: SitesClient;

  /** API key management */
  readonly keys: KeysClient;

  /** LLM configuration operations */
  readonly llm: LlmClient;

  constructor(config: RefyneConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl?.replace(/\/$/, '') ?? 'https://api.refyne.uk';
    this.timeout = config.timeout ?? 30000;
    this.maxRetries = config.maxRetries ?? 3;
    this.logger = config.logger ?? defaultLogger;
    this.httpClient = config.httpClient ?? defaultHttpClient;
    this.cache = config.cache ?? new MemoryCache({ logger: this.logger });
    this.cacheEnabled = config.cacheEnabled ?? true;
    this.userAgent = buildUserAgent(config.userAgentSuffix);
    this.dangerouslyDisableTLSVerification = config.dangerouslyDisableTLSVerification ?? false;

    // Hash the API key for cache key generation
    this.authHash = hashString(this.apiKey);

    // Warn about insecure connections
    if (!this.baseUrl.startsWith('https://')) {
      this.logger.warn('API base URL is not using HTTPS. This is insecure.', {
        baseUrl: this.baseUrl,
      });
    }

    if (this.dangerouslyDisableTLSVerification) {
      this.logger.warn(
        'TLS certificate verification is disabled. This is dangerous and should only be used for development.',
        { baseUrl: this.baseUrl }
      );
    }

    // Initialize sub-clients
    this.jobs = new JobsClient(this);
    this.schemas = new SchemasClient(this);
    this.sites = new SitesClient(this);
    this.keys = new KeysClient(this);
    this.llm = new LlmClient(this);
  }

  /**
   * Extract structured data from a single web page.
   *
   * @param request - Extraction request with URL and schema
   * @returns Extracted data matching the schema
   *
   * @example
   * ```typescript
   * const result = await refyne.extract({
   *   url: 'https://example.com/product/123',
   *   schema: {
   *     name: 'string',
   *     price: 'number',
   *     description: 'string',
   *   },
   * });
   *
   * console.log(result.data.name);  // "Product Name"
   * console.log(result.data.price); // 29.99
   * ```
   */
  async extract<T extends Record<string, unknown> = Record<string, unknown>>(
    request: ExtractRequest
  ): Promise<ExtractResponse & { data: T }> {
    return this.request<ExtractResponse & { data: T }>('POST', '/api/v1/extract', request);
  }

  /**
   * Start an asynchronous crawl job.
   *
   * @param request - Crawl request with URL, schema, and options
   * @returns Job creation response with job ID
   *
   * @example
   * ```typescript
   * const job = await refyne.crawl({
   *   url: 'https://example.com/products',
   *   schema: { name: 'string', price: 'number' },
   *   options: {
   *     followSelector: 'a.product-link',
   *     maxPages: 20,
   *   },
   * });
   *
   * // Poll for completion
   * let status = await refyne.jobs.get(job.jobId);
   * while (status.status === 'running') {
   *   await new Promise(r => setTimeout(r, 2000));
   *   status = await refyne.jobs.get(job.jobId);
   * }
   *
   * // Get results
   * const results = await refyne.jobs.getResults(job.jobId);
   * ```
   */
  async crawl(request: CrawlRequest): Promise<CrawlJobCreated> {
    return this.request<CrawlJobCreated>('POST', '/api/v1/crawl', request);
  }

  /**
   * Analyze a website to detect structure and suggest schemas.
   *
   * @param request - Analysis request with URL and depth
   * @returns Analysis results with suggested schema and patterns
   *
   * @example
   * ```typescript
   * const analysis = await refyne.analyze({
   *   url: 'https://example.com/products',
   *   depth: 1,
   * });
   *
   * console.log(analysis.suggestedSchema);
   * console.log(analysis.followPatterns);
   * ```
   */
  async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    return this.request<AnalyzeResponse>('POST', '/api/v1/analyze', request);
  }

  /**
   * Get usage statistics for the current billing period.
   *
   * @returns Usage statistics including credits used and remaining
   */
  async getUsage(): Promise<UsageResponse> {
    return this.request<UsageResponse>('GET', '/api/v1/usage');
  }

  /**
   * Make an HTTP request to the API.
   * @internal
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { skipCache?: boolean }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const cacheKey = generateCacheKey(method, url, this.authHash);

    // Check cache for GET requests
    if (method === 'GET' && this.cacheEnabled && !options?.skipCache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached.value as T;
      }
    }

    const response = await this.executeWithRetry(method, url, body);

    // Check API version on first request
    if (!this.apiVersionChecked) {
      const apiVersion = response.headers.get('X-API-Version');
      if (apiVersion) {
        checkAPIVersionCompatibility(apiVersion, this.logger);
      } else {
        this.logger.warn('API did not return X-API-Version header');
      }
      this.apiVersionChecked = true;
    }

    // Parse response
    if (!response.ok) {
      throw await createErrorFromResponse(response);
    }

    const data = await response.json() as T;

    // Cache GET responses
    if (method === 'GET' && this.cacheEnabled) {
      const cacheControl = response.headers.get('Cache-Control');
      const entry = createCacheEntry(data, cacheControl);
      if (entry) {
        await this.cache.set(cacheKey, entry);
      }
    }

    return data;
  }

  /**
   * Execute a request with retry logic.
   * @internal
   */
  private async executeWithRetry(
    method: string,
    url: string,
    body?: unknown,
    attempt = 1
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.httpClient.fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting with retry
      if (response.status === 429 && attempt <= this.maxRetries) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
        this.logger.warn(`Rate limited. Retrying in ${retryAfter}s`, {
          attempt,
          maxRetries: this.maxRetries,
        });
        await this.sleep(retryAfter * 1000);
        return this.executeWithRetry(method, url, body, attempt + 1);
      }

      // Handle server errors with retry
      if (response.status >= 500 && attempt <= this.maxRetries) {
        const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        this.logger.warn(`Server error. Retrying in ${backoff}ms`, {
          status: response.status,
          attempt,
          maxRetries: this.maxRetries,
        });
        await this.sleep(backoff);
        return this.executeWithRetry(method, url, body, attempt + 1);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === 'AbortError') {
        throw new RefyneError(`Request timed out after ${this.timeout}ms`, 0);
      }

      // Retry on network errors
      if (attempt <= this.maxRetries) {
        const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        this.logger.warn(`Network error. Retrying in ${backoff}ms`, {
          error: (error as Error).message,
          attempt,
          maxRetries: this.maxRetries,
        });
        await this.sleep(backoff);
        return this.executeWithRetry(method, url, body, attempt + 1);
      }

      throw new RefyneError(
        `Network error: ${(error as Error).message}`,
        0
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Client for job-related operations.
 */
class JobsClient {
  constructor(private readonly client: Refyne) {}

  /**
   * List all jobs.
   */
  async list(options?: { limit?: number; offset?: number }): Promise<JobList> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    const query = params.toString();
    return this.client.request<JobList>('GET', `/api/v1/jobs${query ? `?${query}` : ''}`);
  }

  /**
   * Get a job by ID.
   */
  async get(id: string): Promise<Job> {
    return this.client.request<Job>('GET', `/api/v1/jobs/${id}`, undefined, { skipCache: true });
  }

  /**
   * Get job results.
   */
  async getResults(id: string, options?: { merge?: boolean }): Promise<JobResults> {
    const params = new URLSearchParams();
    if (options?.merge) params.set('merge', 'true');
    const query = params.toString();
    return this.client.request<JobResults>(
      'GET',
      `/api/v1/jobs/${id}/results${query ? `?${query}` : ''}`,
      undefined,
      { skipCache: true }
    );
  }

  /**
   * Get merged results as a single object.
   */
  async getResultsMerged<T extends Record<string, unknown> = Record<string, unknown>>(
    id: string
  ): Promise<T> {
    const results = await this.getResults(id, { merge: true });
    return (results.merged ?? {}) as T;
  }

  /**
   * Stream job results in real-time using SSE.
   *
   * @param id - Job ID to stream
   * @returns AsyncIterator of job events
   *
   * @example
   * ```typescript
   * for await (const event of refyne.jobs.stream(jobId)) {
   *   switch (event.type) {
   *     case 'progress':
   *       console.log(`Processed ${event.pagesProcessed} pages`);
   *       break;
   *     case 'result':
   *       console.log(`Got result from ${event.url}:`, event.data);
   *       break;
   *     case 'complete':
   *       console.log(`Job completed with ${event.pageCount} pages`);
   *       break;
   *   }
   * }
   * ```
   */
  async *stream(_id: string): AsyncIterableIterator<JobEvent> {
    // Note: This is a simplified implementation.
    // Full SSE support would require EventSource or a streaming fetch.
    throw new RefyneError('Streaming not yet implemented', 0);
  }
}

/**
 * Client for schema catalog operations.
 */
class SchemasClient {
  constructor(private readonly client: Refyne) {}

  /** List all schemas (user + platform) */
  async list(): Promise<SchemaList> {
    return this.client.request<SchemaList>('GET', '/api/v1/schemas');
  }

  /** Get a schema by ID */
  async get(id: string): Promise<Schema> {
    return this.client.request<Schema>('GET', `/api/v1/schemas/${id}`);
  }

  /** Create a new schema */
  async create(request: CreateSchemaRequest): Promise<Schema> {
    return this.client.request<Schema>('POST', '/api/v1/schemas', request);
  }

  /** Update a schema */
  async update(id: string, request: Partial<CreateSchemaRequest>): Promise<Schema> {
    return this.client.request<Schema>('PUT', `/api/v1/schemas/${id}`, request);
  }

  /** Delete a schema */
  async delete(id: string): Promise<void> {
    await this.client.request<void>('DELETE', `/api/v1/schemas/${id}`);
  }
}

/**
 * Client for saved sites operations.
 */
class SitesClient {
  constructor(private readonly client: Refyne) {}

  /** List all saved sites */
  async list(): Promise<SiteList> {
    return this.client.request<SiteList>('GET', '/api/v1/sites');
  }

  /** Get a site by ID */
  async get(id: string): Promise<Site> {
    return this.client.request<Site>('GET', `/api/v1/sites/${id}`);
  }

  /** Create a new saved site */
  async create(request: CreateSiteRequest): Promise<Site> {
    return this.client.request<Site>('POST', '/api/v1/sites', request);
  }

  /** Update a saved site */
  async update(id: string, request: Partial<CreateSiteRequest>): Promise<Site> {
    return this.client.request<Site>('PUT', `/api/v1/sites/${id}`, request);
  }

  /** Delete a saved site */
  async delete(id: string): Promise<void> {
    await this.client.request<void>('DELETE', `/api/v1/sites/${id}`);
  }
}

/**
 * Client for API key management.
 */
class KeysClient {
  constructor(private readonly client: Refyne) {}

  /** List all API keys */
  async list(): Promise<ApiKeyList> {
    return this.client.request<ApiKeyList>('GET', '/api/v1/keys');
  }

  /** Create a new API key */
  async create(request: CreateApiKeyRequest): Promise<ApiKeyCreated> {
    return this.client.request<ApiKeyCreated>('POST', '/api/v1/keys', request);
  }

  /** Revoke an API key */
  async revoke(id: string): Promise<void> {
    await this.client.request<void>('DELETE', `/api/v1/keys/${id}`);
  }
}

/**
 * Client for LLM configuration.
 */
class LlmClient {
  constructor(private readonly client: Refyne) {}

  /** List available LLM providers */
  async listProviders(): Promise<{ providers: string[] }> {
    return this.client.request<{ providers: string[] }>('GET', '/api/v1/llm/providers');
  }

  /** List configured provider keys (BYOK) */
  async listKeys(): Promise<LlmKeyList> {
    return this.client.request<LlmKeyList>('GET', '/api/v1/llm/keys');
  }

  /** Add or update a provider key */
  async upsertKey(request: UpsertLlmKeyRequest): Promise<LlmKey> {
    return this.client.request<LlmKey>('PUT', '/api/v1/llm/keys', request);
  }

  /** Delete a provider key */
  async deleteKey(id: string): Promise<void> {
    await this.client.request<void>('DELETE', `/api/v1/llm/keys/${id}`);
  }

  /** Get the fallback chain configuration */
  async getChain(): Promise<LlmChain> {
    return this.client.request<LlmChain>('GET', '/api/v1/llm/chain');
  }

  /** Set the fallback chain configuration */
  async setChain(request: SetLlmChainRequest): Promise<void> {
    await this.client.request<void>('PUT', '/api/v1/llm/chain', request);
  }

  /** List available models for a provider */
  async listModels(provider: string): Promise<ModelList> {
    return this.client.request<ModelList>('GET', `/api/v1/llm/models/${provider}`);
  }
}
