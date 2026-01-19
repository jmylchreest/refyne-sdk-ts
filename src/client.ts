/**
 * Main Refyne client implementation.
 *
 * @packageDocumentation
 */

import createClient, { type Middleware } from 'openapi-fetch';
import type { paths, components } from './types';
import type { Logger, Cache } from './interfaces';
import { defaultLogger } from './interfaces';
import { MemoryCache } from './cache';
import { createErrorFromResponse } from './errors';
import { buildUserAgent, checkAPIVersionCompatibility, SDK_VERSION, MIN_API_VERSION, MAX_KNOWN_API_VERSION } from './version';

// Re-export useful component types for consumers
export type ExtractRequest = components['schemas']['ExtractInputBody'];
export type ExtractResponse = components['schemas']['ExtractOutputBody'];
export type CrawlRequest = components['schemas']['CreateCrawlJobInputBody'];
export type CrawlJobResponse = components['schemas']['CrawlJobResponseBody'];
export type AnalyzeRequest = components['schemas']['AnalyzeInputBody'];
export type AnalyzeResponse = components['schemas']['AnalyzeResponseBody'];
export type JobResponse = components['schemas']['JobResponse'];
export type SchemaOutput = components['schemas']['SchemaOutput'];
export type SavedSiteOutput = components['schemas']['SavedSiteOutput'];
export type UsageResponse = components['schemas']['GetUsageOutputBody'];

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
  /** Custom cache implementation */
  cache?: Cache;
  /** Whether caching is enabled (default: true) */
  cacheEnabled?: boolean;
  /** Custom User-Agent suffix (e.g., "MyApp/1.0") */
  userAgentSuffix?: string;
}

export const DEFAULT_BASE_URL = 'https://api.refyne.uk';
export const DEFAULT_TIMEOUT = 30000;
export const DEFAULT_MAX_RETRIES = 3;

/**
 * Fluent builder for creating Refyne client instances.
 *
 * @example
 * ```typescript
 * const client = new RefyneBuilder()
 *   .apiKey(process.env.REFYNE_API_KEY!)
 *   .baseUrl('https://api.refyne.uk')
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

  /** Set the maximum retry attempts */
  maxRetries(count: number): this {
    this.config.maxRetries = count;
    return this;
  }

  /** Set a custom logger */
  logger(logger: Logger): this {
    this.config.logger = logger;
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

  /** Build the client instance */
  build(): Refyne {
    if (!this.config.apiKey) {
      throw new Error('API key is required');
    }
    return new Refyne(this.config as RefyneConfig);
  }
}

// =============================================================================
// Sub-clients for organized API access
// =============================================================================

/**
 * Jobs sub-client for job-related operations.
 */
export class JobsClient {
  constructor(private readonly client: ReturnType<typeof createClient<paths>>) {}

  /** List all jobs. */
  async list(options?: { limit?: number; offset?: number }) {
    const { data, error } = await this.client.GET('/api/v1/jobs', {
      params: { query: options },
    });
    if (error) throw error;
    return data;
  }

  /** Get a job by ID. */
  async get(id: string): Promise<JobResponse> {
    const { data, error } = await this.client.GET('/api/v1/jobs/{id}', {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  }

  /** Get job results. */
  async getResults(id: string, options?: { merge?: boolean }) {
    const { data, error } = await this.client.GET('/api/v1/jobs/{id}/results', {
      params: {
        path: { id },
        query: options,
      },
    });
    if (error) throw error;
    return data;
  }

  /** Download job results as a file. */
  async download(id: string) {
    const { data, error } = await this.client.GET('/api/v1/jobs/{id}/download', {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  }
}

/**
 * Schemas sub-client for schema management.
 */
export class SchemasClient {
  constructor(private readonly client: ReturnType<typeof createClient<paths>>) {}

  /** List all schemas. */
  async list() {
    const { data, error } = await this.client.GET('/api/v1/schemas');
    if (error) throw error;
    return data;
  }

  /** Get a schema by ID. */
  async get(id: string): Promise<SchemaOutput> {
    const { data, error } = await this.client.GET('/api/v1/schemas/{id}', {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  }

  /** Create a new schema. */
  async create(input: components['schemas']['CreateSchemaInputBody']): Promise<SchemaOutput> {
    const { data, error } = await this.client.POST('/api/v1/schemas', {
      body: input,
    });
    if (error) throw error;
    return data;
  }

  /** Update a schema. */
  async update(id: string, input: components['schemas']['UpdateSchemaInputBody']): Promise<SchemaOutput> {
    const { data, error } = await this.client.PUT('/api/v1/schemas/{id}', {
      params: { path: { id } },
      body: input,
    });
    if (error) throw error;
    return data;
  }

  /** Delete a schema. */
  async delete(id: string) {
    const { data, error } = await this.client.DELETE('/api/v1/schemas/{id}', {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  }
}

/**
 * Sites sub-client for saved site management.
 */
export class SitesClient {
  constructor(private readonly client: ReturnType<typeof createClient<paths>>) {}

  /** List all saved sites. */
  async list() {
    const { data, error } = await this.client.GET('/api/v1/sites');
    if (error) throw error;
    return data;
  }

  /** Get a saved site by ID. */
  async get(id: string): Promise<SavedSiteOutput> {
    const { data, error } = await this.client.GET('/api/v1/sites/{id}', {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  }

  /** Create a new saved site. */
  async create(input: components['schemas']['CreateSavedSiteInputBody']): Promise<SavedSiteOutput> {
    const { data, error } = await this.client.POST('/api/v1/sites', {
      body: input,
    });
    if (error) throw error;
    return data;
  }

  /** Update a saved site. */
  async update(id: string, input: components['schemas']['UpdateSavedSiteInputBody']): Promise<SavedSiteOutput> {
    const { data, error } = await this.client.PUT('/api/v1/sites/{id}', {
      params: { path: { id } },
      body: input,
    });
    if (error) throw error;
    return data;
  }

  /** Delete a saved site. */
  async delete(id: string) {
    const { data, error } = await this.client.DELETE('/api/v1/sites/{id}', {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  }
}

/**
 * Keys sub-client for API key management.
 */
export class KeysClient {
  constructor(private readonly client: ReturnType<typeof createClient<paths>>) {}

  /** List all API keys. */
  async list() {
    const { data, error } = await this.client.GET('/api/v1/keys');
    if (error) throw error;
    return data;
  }

  /** Create a new API key. */
  async create(name: string) {
    const { data, error } = await this.client.POST('/api/v1/keys', {
      body: { name },
    });
    if (error) throw error;
    return data;
  }

  /** Revoke an API key. */
  async revoke(id: string) {
    const { data, error } = await this.client.DELETE('/api/v1/keys/{id}', {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  }
}

/**
 * LLM sub-client for LLM configuration management.
 */
export class LLMClient {
  constructor(private readonly client: ReturnType<typeof createClient<paths>>) {}

  /** List available LLM providers. */
  async listProviders() {
    const { data, error } = await this.client.GET('/api/v1/llm/providers');
    if (error) throw error;
    return data;
  }

  /** List available models for a provider. */
  async listModels(provider: string) {
    const { data, error } = await this.client.GET('/api/v1/llm/models/{provider}', {
      params: { path: { provider } },
    });
    if (error) throw error;
    return data;
  }

  /** List user's LLM service keys. */
  async listKeys() {
    const { data, error } = await this.client.GET('/api/v1/llm/keys');
    if (error) throw error;
    return data;
  }

  /** Upsert an LLM service key. */
  async upsertKey(input: components['schemas']['UserServiceKeyInput']) {
    const { data, error } = await this.client.PUT('/api/v1/llm/keys', {
      body: input,
    });
    if (error) throw error;
    return data;
  }

  /** Delete an LLM service key. */
  async deleteKey(id: string) {
    const { data, error } = await this.client.DELETE('/api/v1/llm/keys/{id}', {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  }

  /** Get user's LLM fallback chain. */
  async getChain() {
    const { data, error } = await this.client.GET('/api/v1/llm/chain');
    if (error) throw error;
    return data;
  }

  /** Set user's LLM fallback chain. */
  async setChain(input: components['schemas']['SetUserFallbackChainInputBody']) {
    const { data, error } = await this.client.PUT('/api/v1/llm/chain', {
      body: input,
    });
    if (error) throw error;
    return data;
  }
}

// =============================================================================
// Main Client
// =============================================================================

/**
 * Refyne API client.
 *
 * Provides type-safe access to the Refyne API.
 *
 * @example
 * ```typescript
 * const client = new Refyne({ apiKey: process.env.REFYNE_API_KEY! });
 *
 * // Extract data from a page
 * const result = await client.extract({
 *   url: 'https://example.com/product',
 *   schema: { name: { type: 'string' }, price: { type: 'number' } }
 * });
 *
 * // Use sub-clients for organized access
 * const jobs = await client.jobs.list();
 * const schemas = await client.schemas.list();
 * ```
 */
export class Refyne {
  /** Static builder for fluent construction */
  static Builder = RefyneBuilder;

  private readonly httpClient: ReturnType<typeof createClient<paths>>;
  private readonly config: Required<Omit<RefyneConfig, 'userAgentSuffix'>> & { userAgentSuffix?: string };
  private readonly logger: Logger;
  private apiVersionChecked = false;

  /** Sub-client for job operations */
  readonly jobs: JobsClient;
  /** Sub-client for schema operations */
  readonly schemas: SchemasClient;
  /** Sub-client for site operations */
  readonly sites: SitesClient;
  /** Sub-client for API key operations */
  readonly keys: KeysClient;
  /** Sub-client for LLM configuration */
  readonly llm: LLMClient;

  constructor(config: RefyneConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, ''),
      timeout: config.timeout || DEFAULT_TIMEOUT,
      maxRetries: config.maxRetries || DEFAULT_MAX_RETRIES,
      logger: config.logger || defaultLogger,
      cache: config.cache || new MemoryCache(),
      cacheEnabled: config.cacheEnabled !== false,
      userAgentSuffix: config.userAgentSuffix,
    };

    this.logger = this.config.logger;

    // Create openapi-fetch client with middleware
    this.httpClient = createClient<paths>({
      baseUrl: this.config.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'User-Agent': buildUserAgent(this.config.userAgentSuffix),
        'X-SDK-Version': SDK_VERSION,
      },
    });

    // Add middleware for error handling and API version checking
    this.httpClient.use(this.createErrorMiddleware());

    // Initialize sub-clients
    this.jobs = new JobsClient(this.httpClient);
    this.schemas = new SchemasClient(this.httpClient);
    this.sites = new SitesClient(this.httpClient);
    this.keys = new KeysClient(this.httpClient);
    this.llm = new LLMClient(this.httpClient);
  }

  private createErrorMiddleware(): Middleware {
    return {
      onResponse: async ({ response }) => {
        // Check API version on first successful response
        if (!this.apiVersionChecked && response.ok) {
          const apiVersion = response.headers.get('X-API-Version');
          if (apiVersion) {
            checkAPIVersionCompatibility(apiVersion, this.logger);
          }
          this.apiVersionChecked = true;
        }

        // Handle error responses
        if (!response.ok) {
          const error = await createErrorFromResponse(response);
          throw error;
        }

        return response;
      },
    };
  }

  // =========================================================================
  // Core Extraction Methods (top-level for convenience)
  // =========================================================================

  /**
   * Extract structured data from a single web page.
   */
  async extract(request: ExtractRequest): Promise<ExtractResponse> {
    const { data, error } = await this.httpClient.POST('/api/v1/extract', {
      body: request,
    });
    if (error) throw error;
    return data;
  }

  /**
   * Start an asynchronous crawl job.
   */
  async crawl(request: CrawlRequest): Promise<CrawlJobResponse> {
    const { data, error } = await this.httpClient.POST('/api/v1/crawl', {
      body: request,
    });
    if (error) throw error;
    return data;
  }

  /**
   * Analyze a website to detect structure and suggest schemas.
   */
  async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    const { data, error } = await this.httpClient.POST('/api/v1/analyze', {
      body: request,
    });
    if (error) throw error;
    return data;
  }

  /**
   * Get usage statistics for the current billing period.
   */
  async getUsage(): Promise<UsageResponse> {
    const { data, error } = await this.httpClient.GET('/api/v1/usage');
    if (error) throw error;
    return data;
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  /**
   * Get the raw openapi-fetch client for advanced usage.
   */
  get rawClient() {
    return this.httpClient;
  }

  /**
   * Get SDK version information.
   */
  get version() {
    return {
      sdk: SDK_VERSION,
      minApi: MIN_API_VERSION,
      maxKnownApi: MAX_KNOWN_API_VERSION,
    };
  }
}

// Default export
export default Refyne;
