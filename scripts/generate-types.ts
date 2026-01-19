#!/usr/bin/env npx tsx
/**
 * Generate TypeScript types from the Refyne API OpenAPI specification.
 *
 * This script uses openapi-typescript to generate types compatible with openapi-fetch.
 *
 * Usage:
 *   npx tsx scripts/generate-types.ts [options]
 *
 * Options:
 *   --url <url>      Fetch spec from URL (default: http://localhost:8080/openapi.json)
 *   --file <path>    Read spec from local file
 *   --output <path>  Output file path (default: src/types.ts)
 *   --help           Show this help message
 *
 * Environment Variables:
 *   OPENAPI_SPEC_URL   Override the default URL
 *   OPENAPI_SPEC_FILE  Use a local file instead of fetching
 *
 * Documentation: https://refyne.uk/docs
 *
 * @packageDocumentation
 */

import { execSync } from 'child_process';
import * as path from 'path';

const DEFAULT_SPEC_URL = 'http://localhost:8080/openapi.json';
const PROD_SPEC_URL = 'https://api.refyne.uk/openapi.json';
const DEFAULT_OUTPUT = 'src/types.ts';

interface CLIArgs {
  url?: string;
  file?: string;
  output: string;
  help: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {
    output: DEFAULT_OUTPUT,
    help: false,
  };

  // Check environment variables first
  if (process.env.OPENAPI_SPEC_FILE) {
    args.file = process.env.OPENAPI_SPEC_FILE;
  } else if (process.env.OPENAPI_SPEC_URL) {
    args.url = process.env.OPENAPI_SPEC_URL;
  }

  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--url':
        args.url = argv[++i];
        args.file = undefined;
        break;
      case '--file':
        args.file = argv[++i];
        args.url = undefined;
        break;
      case '--output':
        args.output = argv[++i];
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
    }
  }

  // Default to URL if neither specified
  if (!args.url && !args.file) {
    args.url = DEFAULT_SPEC_URL;
  }

  return args;
}

function showHelp(): void {
  console.log(`
Generate TypeScript types from the Refyne API OpenAPI specification.

This script uses openapi-typescript to generate types compatible with openapi-fetch.

Usage:
  npx tsx scripts/generate-types.ts [options]

Options:
  --url <url>      Fetch spec from URL (default: ${DEFAULT_SPEC_URL})
  --file <path>    Read spec from local file
  --output <path>  Output file path (default: ${DEFAULT_OUTPUT})
  --help, -h       Show this help message

Environment Variables:
  OPENAPI_SPEC_URL   Override the default URL
  OPENAPI_SPEC_FILE  Use a local file instead of fetching

Examples:
  # Fetch from local development server
  npx tsx scripts/generate-types.ts

  # Fetch from production API
  npx tsx scripts/generate-types.ts --url ${PROD_SPEC_URL}

  # Use a local file
  npx tsx scripts/generate-types.ts --file ./openapi.json

  # Using environment variables
  OPENAPI_SPEC_URL=${PROD_SPEC_URL} npx tsx scripts/generate-types.ts

Documentation: https://refyne.uk/docs
`);
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  try {
    const source = args.file ? path.resolve(args.file) : args.url!;
    const outputPath = path.resolve(args.output);

    console.log(`Generating types from: ${source}`);
    console.log(`Output: ${outputPath}`);

    // Use openapi-typescript CLI to generate types
    // This generates the `paths` type that openapi-fetch needs
    const cmd = `npx openapi-typescript "${source}" -o "${outputPath}"`;
    console.log(`Running: ${cmd}`);

    execSync(cmd, { stdio: 'inherit' });

    console.log(`\nTypes generated successfully!`);
    console.log(`\nUsage with openapi-fetch:`);
    console.log(`  import createClient from 'openapi-fetch';`);
    console.log(`  import type { paths } from './types';`);
    console.log(`  const client = createClient<paths>({ baseUrl: 'https://api.refyne.uk' });`);
  } catch (error) {
    console.error('Error generating types:', (error as Error).message);
    process.exit(1);
  }
}

main();
