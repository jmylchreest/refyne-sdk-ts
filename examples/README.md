# Refyne TypeScript SDK Examples

This directory contains example code demonstrating how to use the Refyne TypeScript SDK.

## Prerequisites

- Node.js 18+ or Bun
- A valid Refyne API key

## Environment Setup

Set the required environment variables:

```bash
export REFYNE_API_KEY="your_api_key_here"
export REFYNE_BASE_URL="https://api.refyne.uk"  # Optional, defaults to production
```

## Examples

### Full Demo (`full-demo.ts`)

A comprehensive demo that tests all major SDK functionality:
- Usage/subscription information retrieval
- Job listing
- Website analysis (structure detection)
- Single page extraction
- Crawl job creation and monitoring
- Job result retrieval

**Run with:**

```bash
npx tsx examples/full-demo.ts
```

Or with Bun:

```bash
bun run examples/full-demo.ts
```

## Notes

- The demo uses environment variables for configuration to avoid hardcoding credentials
- All API calls are made asynchronously
- Error handling demonstrates the `RefyneError` class for API errors
