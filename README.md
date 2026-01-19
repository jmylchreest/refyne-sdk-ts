# Refyne SDK for TypeScript

Official TypeScript SDK for the [Refyne API](https://refyne.uk/docs) - LLM-powered web extraction that transforms unstructured websites into clean, typed JSON data.

**API Endpoint**: `https://api.refyne.uk` | **Documentation**: [refyne.uk/docs](https://refyne.uk/docs)

[![npm version](https://badge.fury.io/js/@refyne%2Fsdk.svg)](https://www.npmjs.com/package/@refyne/sdk)
[![CI](https://github.com/jmylchreest/refyne-sdk-ts/actions/workflows/test.yml/badge.svg)](https://github.com/jmylchreest/refyne-sdk-ts/actions/workflows/test.yml)

## Features

- **Type-Safe**: Full TypeScript support with generated types from OpenAPI
- **Zero Dependencies**: Uses native `fetch` - works in Node.js 18+, Bun, and Deno
- **Smart Caching**: Respects `Cache-Control` headers automatically
- **Auto-Retry**: Handles rate limits and transient errors with exponential backoff
- **Streaming**: Real-time job progress via Server-Sent Events
- **SOLID Design**: Dependency injection for loggers, HTTP clients, and caches
- **API Version Compatibility**: Warns about breaking changes

## Installation

```bash
# npm
npm install @refyne/sdk

# pnpm
pnpm add @refyne/sdk

# bun
bun add @refyne/sdk
```

## Quick Start

```typescript
import { Refyne } from '@refyne/sdk';

// Create client using builder pattern
const refyne = new Refyne.Builder()
  .apiKey(process.env.REFYNE_API_KEY!)
  .build();

// Extract structured data from a web page
const result = await refyne.extract({
  url: 'https://example.com/product/123',
  schema: {
    name: { type: 'string', description: 'Product name' },
    price: { type: 'number', description: 'Price in USD' },
    inStock: { type: 'boolean' },
  },
});

console.log(result.data);
// { name: "Example Product", price: 29.99, inStock: true }
```

## Type-Safe Extraction

Define your expected data shape with TypeScript:

```typescript
interface ProductData {
  name: string;
  price: number;
  description: string;
  inStock: boolean;
}

const result = await refyne.extract<ProductData>({
  url: 'https://example.com/product',
  schema: {
    name: 'string',
    price: 'number',
    description: 'string',
    inStock: 'boolean',
  },
});

// result.data is typed as ProductData
console.log(result.data.name);
```

## Crawl Jobs

Extract data from multiple pages:

```typescript
// Start a crawl job
const job = await refyne.crawl({
  url: 'https://example.com/products',
  schema: {
    name: 'string',
    price: 'number',
  },
  options: {
    followSelector: 'a.product-link',
    maxPages: 20,
    delay: '1s',
  },
});

console.log(`Job started: ${job.jobId}`);

// Poll for completion
let status = await refyne.jobs.get(job.jobId);
while (status.status === 'running') {
  await new Promise(r => setTimeout(r, 2000));
  status = await refyne.jobs.get(job.jobId);
  console.log(`Progress: ${status.pageCount} pages`);
}

// Get results
const results = await refyne.jobs.getResults(job.jobId);
console.log(`Extracted ${results.pageCount} pages`);
```

## Configuration

The SDK uses a builder pattern for flexible configuration:

```typescript
const refyne = new Refyne.Builder()
  .apiKey(process.env.REFYNE_API_KEY!)   // Required
  .baseUrl('https://api.refyne.uk')       // Override API URL
  .timeout(60000)                          // Request timeout (ms)
  .maxRetries(3)                           // Retry attempts
  .userAgentSuffix('MyApp/1.0')           // Custom User-Agent
  .logger(customLogger)                    // Custom logger
  .httpClient(customHttpClient)           // Custom HTTP client
  .cache(customCache)                      // Custom cache
  .cacheEnabled(true)                      // Enable/disable caching
  .build();
```

## Custom Logger

Inject your own logger for debugging:

```typescript
import { Logger } from '@refyne/sdk';

const myLogger: Logger = {
  debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta),
  info: (msg, meta) => console.info(`[INFO] ${msg}`, meta),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
};

const refyne = new Refyne.Builder()
  .apiKey(process.env.REFYNE_API_KEY!)
  .logger(myLogger)
  .build();
```

## Custom Cache

The SDK respects `Cache-Control` headers. Provide a custom cache implementation:

```typescript
import { Cache, CacheEntry } from '@refyne/sdk';

class RedisCache implements Cache {
  async get(key: string): Promise<CacheEntry | undefined> {
    // Fetch from Redis
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    // Store in Redis with TTL from entry.expiresAt
  }

  async delete(key: string): Promise<void> {
    // Delete from Redis
  }
}

const refyne = new Refyne.Builder()
  .apiKey(process.env.REFYNE_API_KEY!)
  .cache(new RedisCache())
  .build();
```

## BYOK (Bring Your Own Key)

Use your own LLM provider API keys:

```typescript
// Configure your OpenAI key
await refyne.llm.upsertKey({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  defaultModel: 'gpt-4o',
});

// Set fallback chain
await refyne.llm.setChain({
  chain: [
    { provider: 'openai', model: 'gpt-4o' },
    { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
    { provider: 'credits', model: 'default' },
  ],
});

// Extract using your keys
const result = await refyne.extract({
  url: 'https://example.com/product',
  schema: { title: 'string' },
  // Or override per-request:
  llmConfig: {
    provider: 'openai',
    model: 'gpt-4o-mini',
  },
});

console.log(`Used BYOK: ${result.usage?.isByok}`);
```

## Error Handling

The SDK provides typed errors for different scenarios:

```typescript
import {
  RefyneError,
  RateLimitError,
  ValidationError,
  AuthenticationError,
  UnsupportedAPIVersionError,
} from '@refyne/sdk';

try {
  await refyne.extract({ url, schema });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof ValidationError) {
    console.log('Validation errors:', error.errors);
  } else if (error instanceof AuthenticationError) {
    console.log('Invalid API key');
  } else if (error instanceof UnsupportedAPIVersionError) {
    console.log(`API version ${error.apiVersion} not supported`);
  } else if (error instanceof RefyneError) {
    console.log(`API error: ${error.message} (${error.status})`);
  }
}
```

## API Reference

### Main Client

| Method | Description |
|--------|-------------|
| `refyne.extract(request)` | Extract data from a single page |
| `refyne.crawl(request)` | Start an async crawl job |
| `refyne.analyze(request)` | Analyze a site and suggest schema |
| `refyne.getUsage()` | Get usage statistics |

### Sub-Clients

| Client | Methods |
|--------|---------|
| `refyne.jobs` | `list()`, `get(id)`, `getResults(id)`, `stream(id)` |
| `refyne.schemas` | `list()`, `get(id)`, `create()`, `update()`, `delete()` |
| `refyne.sites` | `list()`, `get(id)`, `create()`, `update()`, `delete()` |
| `refyne.keys` | `list()`, `create()`, `revoke(id)` |
| `refyne.llm` | `listProviders()`, `listKeys()`, `upsertKey()`, `getChain()`, `setChain()` |

## Documentation

- [API Reference](https://docs.refyne.uk/docs/api-reference)
- [TypeScript SDK Guide](https://docs.refyne.uk/docs/sdks/typescript)
- [TypeDoc API Docs](https://jmylchreest.github.io/refyne-sdk-ts/)

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Generate types from OpenAPI
npm run generate

# Generate API docs
npm run docs
```

## License

MIT License - see [LICENSE](LICENSE) for details.
