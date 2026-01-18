/**
 * Custom logger example.
 *
 * This example demonstrates how to inject a custom logger for debugging
 * and monitoring SDK operations.
 *
 * @example
 * ```bash
 * # Set your API key
 * export REFYNE_API_KEY=your_api_key_here
 *
 * # Run the example
 * npx ts-node examples/custom-logger.ts
 * ```
 */

import { Refyne, Logger } from '../src';

// Create a custom logger that adds timestamps and colors
const createCustomLogger = (level: 'debug' | 'info' | 'warn' | 'error'): Logger => {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  const minLevel = levels[level];

  const formatTimestamp = () => {
    return new Date().toISOString();
  };

  const formatMeta = (meta?: Record<string, unknown>) => {
    if (!meta || Object.keys(meta).length === 0) return '';
    return ` ${JSON.stringify(meta)}`;
  };

  return {
    debug: (message: string, meta?: Record<string, unknown>) => {
      if (minLevel <= levels.debug) {
        console.log(`[${formatTimestamp()}] DEBUG: ${message}${formatMeta(meta)}`);
      }
    },
    info: (message: string, meta?: Record<string, unknown>) => {
      if (minLevel <= levels.info) {
        console.log(`[${formatTimestamp()}] INFO:  ${message}${formatMeta(meta)}`);
      }
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      if (minLevel <= levels.warn) {
        console.warn(`[${formatTimestamp()}] WARN:  ${message}${formatMeta(meta)}`);
      }
    },
    error: (message: string, meta?: Record<string, unknown>) => {
      if (minLevel <= levels.error) {
        console.error(`[${formatTimestamp()}] ERROR: ${message}${formatMeta(meta)}`);
      }
    },
  };
};

async function main() {
  // Create a client with custom logger
  const refyne = new Refyne.Builder()
    .apiKey(process.env.REFYNE_API_KEY!)
    .logger(createCustomLogger('debug')) // Set minimum log level
    .build();

  console.log('Making request with custom logger...\n');

  try {
    // The custom logger will show debug output for:
    // - Cache operations (hits, misses, evictions)
    // - API version compatibility checks
    // - Retry attempts
    // - Rate limiting

    const usage = await refyne.getUsage();

    console.log('\nUsage statistics:');
    console.log(`  Tier: ${usage.tier}`);
    console.log(`  Credits used: ${usage.creditsUsed}/${usage.creditsLimit}`);
    console.log(`  Remaining: ${usage.creditsRemaining}`);
  } catch (error) {
    console.error('Request failed:', error);
    process.exit(1);
  }
}

main();
