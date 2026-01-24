'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var createClient = require('openapi-fetch');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var createClient__default = /*#__PURE__*/_interopDefault(createClient);

// src/client.ts

// src/interfaces.ts
var defaultLogger = {
  debug: (msg, meta) => {
    const proc = "process" in globalThis ? globalThis.process : void 0;
    if (proc?.env?.DEBUG) {
      console.debug(`[Refyne SDK] ${msg}`, meta || "");
    }
  },
  info: (msg, meta) => console.info(`[Refyne SDK] ${msg}`, meta || ""),
  warn: (msg, meta) => console.warn(`[Refyne SDK] ${msg}`, meta || ""),
  error: (msg, meta) => console.error(`[Refyne SDK] ${msg}`, meta || "")
};

// src/cache.ts
function parseCacheControl(header) {
  if (!header) {
    return {};
  }
  const directives = {};
  const parts = header.toLowerCase().split(",").map((s) => s.trim());
  for (const part of parts) {
    if (part === "no-store") {
      directives.noStore = true;
    } else if (part === "no-cache") {
      directives.noCache = true;
    } else if (part === "private") {
      directives.private = true;
    } else if (part.startsWith("max-age=")) {
      const value = parseInt(part.substring(8), 10);
      if (!isNaN(value)) {
        directives.maxAge = value;
      }
    } else if (part.startsWith("stale-while-revalidate=")) {
      const value = parseInt(part.substring(23), 10);
      if (!isNaN(value)) {
        directives.staleWhileRevalidate = value;
      }
    }
  }
  return directives;
}
var MemoryCache = class {
  store = /* @__PURE__ */ new Map();
  maxEntries;
  logger;
  constructor(config = {}) {
    this.maxEntries = config.maxEntries ?? 100;
    this.logger = config.logger;
  }
  async get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      return void 0;
    }
    const now = Date.now();
    if (entry.expiresAt < now) {
      if (entry.cacheControl.staleWhileRevalidate) {
        const staleDeadline = entry.expiresAt + entry.cacheControl.staleWhileRevalidate * 1e3;
        if (now < staleDeadline) {
          this.logger?.debug("Serving stale cache entry", { key });
          return entry;
        }
      }
      this.store.delete(key);
      this.logger?.debug("Cache entry expired", { key });
      return void 0;
    }
    this.logger?.debug("Cache hit", { key });
    return entry;
  }
  async set(key, entry) {
    if (entry.cacheControl.noStore) {
      this.logger?.debug("Not caching due to no-store", { key });
      return;
    }
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
        this.logger?.debug("Evicted oldest cache entry", { key: oldestKey });
      }
    }
    this.store.set(key, entry);
    this.logger?.debug("Cache set", { key, expiresAt: entry.expiresAt });
  }
  async delete(key) {
    this.store.delete(key);
    this.logger?.debug("Cache delete", { key });
  }
  /** Clear all cache entries */
  clear() {
    this.store.clear();
    this.logger?.debug("Cache cleared");
  }
  /** Get the current number of cached entries */
  get size() {
    return this.store.size;
  }
};
function createCacheEntry(value, cacheControlHeader) {
  const cacheControl = parseCacheControl(cacheControlHeader);
  if (cacheControl.noStore) {
    return void 0;
  }
  let expiresAt = Date.now();
  if (cacheControl.maxAge !== void 0) {
    expiresAt += cacheControl.maxAge * 1e3;
  } else {
    return void 0;
  }
  return {
    value,
    expiresAt,
    cacheControl
  };
}

// src/errors.ts
var RefyneError = class _RefyneError extends Error {
  /** HTTP status code from the API response */
  status;
  /** Additional error details from the API */
  detail;
  /** The original response (if available) */
  response;
  constructor(message, status, detail, response) {
    super(message);
    this.name = "RefyneError";
    this.status = status;
    this.detail = detail;
    this.response = response;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, _RefyneError);
    }
  }
};
var RateLimitError = class extends RefyneError {
  /** Seconds to wait before retrying */
  retryAfter;
  constructor(message, retryAfter, detail, response) {
    super(message, 429, detail, response);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
};
var ValidationError = class extends RefyneError {
  /** Field-level validation errors */
  errors;
  constructor(message, errors, response) {
    super(message, 400, void 0, response);
    this.name = "ValidationError";
    this.errors = errors;
  }
};
var UnsupportedAPIVersionError = class extends RefyneError {
  /** The API version that was detected */
  apiVersion;
  /** The minimum version this SDK supports */
  minVersion;
  /** The maximum known version this SDK was built for */
  maxKnownVersion;
  constructor(apiVersion, minVersion, maxKnownVersion) {
    const message = `API version ${apiVersion} is not supported. This SDK requires API version >= ${minVersion}. Please upgrade the API or use an older SDK version.`;
    super(message, 0);
    this.name = "UnsupportedAPIVersionError";
    this.apiVersion = apiVersion;
    this.minVersion = minVersion;
    this.maxKnownVersion = maxKnownVersion;
  }
};
var TLSError = class extends RefyneError {
  /** The URL that failed TLS validation */
  url;
  /** The underlying TLS error message */
  tlsError;
  constructor(url, tlsError) {
    super(`TLS certificate validation failed for ${url}: ${tlsError}`, 0);
    this.name = "TLSError";
    this.url = url;
    this.tlsError = tlsError;
  }
};
var AuthenticationError = class extends RefyneError {
  constructor(message = "Authentication failed", response) {
    super(message, 401, void 0, response);
    this.name = "AuthenticationError";
  }
};
var ForbiddenError = class extends RefyneError {
  constructor(message = "Access forbidden", response) {
    super(message, 403, void 0, response);
    this.name = "ForbiddenError";
  }
};
var NotFoundError = class extends RefyneError {
  constructor(message = "Resource not found", response) {
    super(message, 404, void 0, response);
    this.name = "NotFoundError";
  }
};
async function createErrorFromResponse(response) {
  let errorBody = {};
  try {
    errorBody = await response.json();
  } catch {
  }
  const message = errorBody.error || errorBody.message || response.statusText || "Unknown error";
  const detail = errorBody.detail;
  switch (response.status) {
    case 400:
      return new ValidationError(message, errorBody.errors, response);
    case 401:
      return new AuthenticationError(message, response);
    case 403:
      return new ForbiddenError(message, response);
    case 404:
      return new NotFoundError(message, response);
    case 429: {
      const retryAfter = parseInt(response.headers.get("Retry-After") || "60", 10);
      return new RateLimitError(message, retryAfter, detail, response);
    }
    default:
      return new RefyneError(message, response.status, detail, response);
  }
}

// src/version.ts
var SDK_VERSION = "0.0.0";
var MIN_API_VERSION = "0.0.0";
var MAX_KNOWN_API_VERSION = "0.0.0";
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    return { major: 0, minor: 0, patch: 0 };
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4]
  };
}
function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (va.major !== vb.major) {
    return va.major < vb.major ? -1 : 1;
  }
  if (va.minor !== vb.minor) {
    return va.minor < vb.minor ? -1 : 1;
  }
  if (va.patch !== vb.patch) {
    return va.patch < vb.patch ? -1 : 1;
  }
  return 0;
}
function checkAPIVersionCompatibility(apiVersion, logger) {
  if (compareVersions(apiVersion, MIN_API_VERSION) < 0) {
    throw new UnsupportedAPIVersionError(
      apiVersion,
      MIN_API_VERSION,
      MAX_KNOWN_API_VERSION
    );
  }
  const apiParsed = parseVersion(apiVersion);
  const maxParsed = parseVersion(MAX_KNOWN_API_VERSION);
  if (apiParsed.major > maxParsed.major) {
    logger.warn(
      `API version ${apiVersion} is newer than this SDK was built for (${MAX_KNOWN_API_VERSION}). There may be breaking changes. Consider upgrading the SDK.`,
      { apiVersion, sdkVersion: SDK_VERSION, maxKnownVersion: MAX_KNOWN_API_VERSION }
    );
  }
}
function detectRuntime() {
  if (typeof globalThis !== "undefined" && "Bun" in globalThis) {
    const bun = globalThis.Bun;
    return { name: "Bun", version: bun.version };
  }
  if (typeof globalThis !== "undefined" && "Deno" in globalThis) {
    const deno = globalThis.Deno;
    return { name: "Deno", version: deno.version.deno };
  }
  if ("process" in globalThis) {
    const proc = globalThis.process;
    if (proc?.versions?.node) {
      return { name: "Node", version: proc.versions.node };
    }
  }
  if (typeof navigator !== "undefined") {
    return { name: "Browser", version: "unknown" };
  }
  return { name: "Unknown", version: "unknown" };
}
function buildUserAgent(customSuffix) {
  const runtime = detectRuntime();
  let userAgent = `Refyne-SDK-TypeScript/${SDK_VERSION} (${runtime.name}/${runtime.version})`;
  if (customSuffix) {
    userAgent += ` ${customSuffix}`;
  }
  return userAgent;
}

// src/client.ts
var DEFAULT_BASE_URL = "https://api.refyne.uk";
var DEFAULT_TIMEOUT = 3e4;
var DEFAULT_MAX_RETRIES = 3;
var RefyneBuilder = class {
  config = {};
  /** Set the API key (required) */
  apiKey(key) {
    this.config.apiKey = key;
    return this;
  }
  /** Set the base URL */
  baseUrl(url) {
    this.config.baseUrl = url;
    return this;
  }
  /** Set the request timeout in milliseconds */
  timeout(ms) {
    this.config.timeout = ms;
    return this;
  }
  /** Set the maximum retry attempts */
  maxRetries(count) {
    this.config.maxRetries = count;
    return this;
  }
  /** Set a custom logger */
  logger(logger) {
    this.config.logger = logger;
    return this;
  }
  /** Set a custom cache */
  cache(cache) {
    this.config.cache = cache;
    return this;
  }
  /** Enable or disable caching */
  cacheEnabled(enabled) {
    this.config.cacheEnabled = enabled;
    return this;
  }
  /** Set a custom User-Agent suffix */
  userAgentSuffix(suffix) {
    this.config.userAgentSuffix = suffix;
    return this;
  }
  /** Build the client instance */
  build() {
    if (!this.config.apiKey) {
      throw new Error("API key is required");
    }
    return new Refyne(this.config);
  }
};
var JobsClient = class {
  constructor(client) {
    this.client = client;
  }
  /** List all jobs. */
  async list(options) {
    const { data, error } = await this.client.GET("/api/v1/jobs", {
      params: { query: options }
    });
    if (error) throw error;
    return data;
  }
  /** Get a job by ID. */
  async get(id) {
    const { data, error } = await this.client.GET("/api/v1/jobs/{id}", {
      params: { path: { id } }
    });
    if (error) throw error;
    return data;
  }
  /** Get job results. */
  async getResults(id, options) {
    const { data, error } = await this.client.GET("/api/v1/jobs/{id}/results", {
      params: {
        path: { id },
        query: options
      }
    });
    if (error) throw error;
    return data;
  }
  /** Download job results as a file. */
  async download(id) {
    const { data, error } = await this.client.GET("/api/v1/jobs/{id}/download", {
      params: { path: { id } }
    });
    if (error) throw error;
    return data;
  }
};
var SchemasClient = class {
  constructor(client) {
    this.client = client;
  }
  /** List all schemas. */
  async list() {
    const { data, error } = await this.client.GET("/api/v1/schemas");
    if (error) throw error;
    return data;
  }
  /** Get a schema by ID. */
  async get(id) {
    const { data, error } = await this.client.GET("/api/v1/schemas/{id}", {
      params: { path: { id } }
    });
    if (error) throw error;
    return data;
  }
  /** Create a new schema. */
  async create(input) {
    const { data, error } = await this.client.POST("/api/v1/schemas", {
      body: input
    });
    if (error) throw error;
    return data;
  }
  /** Update a schema. */
  async update(id, input) {
    const { data, error } = await this.client.PUT("/api/v1/schemas/{id}", {
      params: { path: { id } },
      body: input
    });
    if (error) throw error;
    return data;
  }
  /** Delete a schema. */
  async delete(id) {
    const { data, error } = await this.client.DELETE("/api/v1/schemas/{id}", {
      params: { path: { id } }
    });
    if (error) throw error;
    return data;
  }
};
var SitesClient = class {
  constructor(client) {
    this.client = client;
  }
  /** List all saved sites. */
  async list() {
    const { data, error } = await this.client.GET("/api/v1/sites");
    if (error) throw error;
    return data;
  }
  /** Get a saved site by ID. */
  async get(id) {
    const { data, error } = await this.client.GET("/api/v1/sites/{id}", {
      params: { path: { id } }
    });
    if (error) throw error;
    return data;
  }
  /** Create a new saved site. */
  async create(input) {
    const { data, error } = await this.client.POST("/api/v1/sites", {
      body: input
    });
    if (error) throw error;
    return data;
  }
  /** Update a saved site. */
  async update(id, input) {
    const { data, error } = await this.client.PUT("/api/v1/sites/{id}", {
      params: { path: { id } },
      body: input
    });
    if (error) throw error;
    return data;
  }
  /** Delete a saved site. */
  async delete(id) {
    const { data, error } = await this.client.DELETE("/api/v1/sites/{id}", {
      params: { path: { id } }
    });
    if (error) throw error;
    return data;
  }
};
var KeysClient = class {
  constructor(client) {
    this.client = client;
  }
  /** List all API keys. */
  async list() {
    const { data, error } = await this.client.GET("/api/v1/keys");
    if (error) throw error;
    return data;
  }
  /** Create a new API key. */
  async create(name) {
    const { data, error } = await this.client.POST("/api/v1/keys", {
      body: { name }
    });
    if (error) throw error;
    return data;
  }
  /** Revoke an API key. */
  async revoke(id) {
    const { data, error } = await this.client.DELETE("/api/v1/keys/{id}", {
      params: { path: { id } }
    });
    if (error) throw error;
    return data;
  }
};
var LLMClient = class {
  constructor(client) {
    this.client = client;
  }
  /** List available LLM providers. */
  async listProviders() {
    const { data, error } = await this.client.GET("/api/v1/llm/providers");
    if (error) throw error;
    return data;
  }
  /** List available models for a provider. */
  async listModels(provider) {
    const { data, error } = await this.client.GET("/api/v1/llm/models/{provider}", {
      params: { path: { provider } }
    });
    if (error) throw error;
    return data;
  }
  /** List user's LLM service keys. */
  async listKeys() {
    const { data, error } = await this.client.GET("/api/v1/llm/keys");
    if (error) throw error;
    return data;
  }
  /** Upsert an LLM service key. */
  async upsertKey(input) {
    const { data, error } = await this.client.PUT("/api/v1/llm/keys", {
      body: input
    });
    if (error) throw error;
    return data;
  }
  /** Delete an LLM service key. */
  async deleteKey(id) {
    const { data, error } = await this.client.DELETE("/api/v1/llm/keys/{id}", {
      params: { path: { id } }
    });
    if (error) throw error;
    return data;
  }
  /** Get user's LLM fallback chain. */
  async getChain() {
    const { data, error } = await this.client.GET("/api/v1/llm/chain");
    if (error) throw error;
    return data;
  }
  /** Set user's LLM fallback chain. */
  async setChain(input) {
    const { data, error } = await this.client.PUT("/api/v1/llm/chain", {
      body: input
    });
    if (error) throw error;
    return data;
  }
};
var Refyne = class {
  /** Static builder for fluent construction */
  static Builder = RefyneBuilder;
  httpClient;
  config;
  logger;
  apiVersionChecked = false;
  /** Sub-client for job operations */
  jobs;
  /** Sub-client for schema operations */
  schemas;
  /** Sub-client for site operations */
  sites;
  /** Sub-client for API key operations */
  keys;
  /** Sub-client for LLM configuration */
  llm;
  constructor(config) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, ""),
      timeout: config.timeout || DEFAULT_TIMEOUT,
      maxRetries: config.maxRetries || DEFAULT_MAX_RETRIES,
      logger: config.logger || defaultLogger,
      cache: config.cache || new MemoryCache(),
      cacheEnabled: config.cacheEnabled !== false,
      userAgentSuffix: config.userAgentSuffix,
      referer: config.referer
    };
    this.logger = this.config.logger;
    const headers = {
      "Authorization": `Bearer ${this.config.apiKey}`,
      "User-Agent": buildUserAgent(this.config.userAgentSuffix),
      "X-SDK-Version": SDK_VERSION
    };
    if (this.config.referer) {
      headers["Referer"] = this.config.referer;
    }
    this.httpClient = createClient__default.default({
      baseUrl: this.config.baseUrl,
      headers
    });
    this.httpClient.use(this.createErrorMiddleware());
    this.jobs = new JobsClient(this.httpClient);
    this.schemas = new SchemasClient(this.httpClient);
    this.sites = new SitesClient(this.httpClient);
    this.keys = new KeysClient(this.httpClient);
    this.llm = new LLMClient(this.httpClient);
  }
  createErrorMiddleware() {
    return {
      onResponse: async ({ response }) => {
        if (!this.apiVersionChecked && response.ok) {
          const apiVersion = response.headers.get("X-API-Version");
          if (apiVersion) {
            checkAPIVersionCompatibility(apiVersion, this.logger);
          }
          this.apiVersionChecked = true;
        }
        if (!response.ok) {
          const error = await createErrorFromResponse(response);
          throw error;
        }
        return response;
      }
    };
  }
  // =========================================================================
  // Core Extraction Methods (top-level for convenience)
  // =========================================================================
  /**
   * Extract structured data from a single web page.
   */
  async extract(request) {
    const { data, error } = await this.httpClient.POST("/api/v1/extract", {
      body: request
    });
    if (error) throw error;
    return data;
  }
  /**
   * Start an asynchronous crawl job.
   */
  async crawl(request) {
    const { data, error } = await this.httpClient.POST("/api/v1/crawl", {
      body: request
    });
    if (error) throw error;
    return data;
  }
  /**
   * Analyze a website to detect structure and suggest schemas.
   */
  async analyze(request) {
    const { data, error } = await this.httpClient.POST("/api/v1/analyze", {
      body: request
    });
    if (error) throw error;
    return data;
  }
  /**
   * Get usage statistics for the current billing period.
   */
  async getUsage() {
    const { data, error } = await this.httpClient.GET("/api/v1/usage");
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
      maxKnownApi: MAX_KNOWN_API_VERSION
    };
  }
};
var client_default = Refyne;

exports.AuthenticationError = AuthenticationError;
exports.DEFAULT_BASE_URL = DEFAULT_BASE_URL;
exports.DEFAULT_MAX_RETRIES = DEFAULT_MAX_RETRIES;
exports.DEFAULT_TIMEOUT = DEFAULT_TIMEOUT;
exports.ForbiddenError = ForbiddenError;
exports.JobsClient = JobsClient;
exports.KeysClient = KeysClient;
exports.LLMClient = LLMClient;
exports.MAX_KNOWN_API_VERSION = MAX_KNOWN_API_VERSION;
exports.MIN_API_VERSION = MIN_API_VERSION;
exports.MemoryCache = MemoryCache;
exports.NotFoundError = NotFoundError;
exports.RateLimitError = RateLimitError;
exports.Refyne = Refyne;
exports.RefyneBuilder = RefyneBuilder;
exports.RefyneError = RefyneError;
exports.SDK_VERSION = SDK_VERSION;
exports.SchemasClient = SchemasClient;
exports.SitesClient = SitesClient;
exports.TLSError = TLSError;
exports.UnsupportedAPIVersionError = UnsupportedAPIVersionError;
exports.ValidationError = ValidationError;
exports.buildUserAgent = buildUserAgent;
exports.createCacheEntry = createCacheEntry;
exports.default = client_default;
exports.defaultLogger = defaultLogger;
exports.detectRuntime = detectRuntime;
exports.parseCacheControl = parseCacheControl;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map