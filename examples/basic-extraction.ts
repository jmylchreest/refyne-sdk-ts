/**
 * Basic extraction example.
 *
 * This example demonstrates how to extract structured data from a web page.
 *
 * @example
 * ```bash
 * # Set your API key
 * export REFYNE_API_KEY=your_api_key_here
 *
 * # Run the example
 * npx ts-node examples/basic-extraction.ts
 * ```
 */

import { Refyne } from '../src';

// Define the shape of data we expect to extract
interface ProductData {
  name: string;
  price: number;
  description: string;
  inStock: boolean;
}

async function main() {
  // Create a client using the builder pattern
  const refyne = new Refyne.Builder()
    .apiKey(process.env.REFYNE_API_KEY!)
    .timeout(60000) // 60 second timeout
    .userAgentSuffix('BasicExample/1.0')
    .build();

  console.log('Extracting product data...\n');

  try {
    // Extract structured data from a page
    const result = await refyne.extract<ProductData>({
      url: 'https://example.com/product/123',
      schema: {
        name: { type: 'string', description: 'Product name' },
        price: { type: 'number', description: 'Price in USD' },
        description: { type: 'string', description: 'Product description' },
        inStock: { type: 'boolean', description: 'Whether the product is in stock' },
      },
    });

    console.log('Extracted data:');
    console.log(JSON.stringify(result.data, null, 2));

    console.log('\nMetadata:');
    console.log(`  URL: ${result.url}`);
    console.log(`  Fetched at: ${result.fetchedAt}`);

    if (result.usage) {
      console.log('\nUsage:');
      console.log(`  Input tokens: ${result.usage.inputTokens}`);
      console.log(`  Output tokens: ${result.usage.outputTokens}`);
      console.log(`  Cost: $${result.usage.costUsd.toFixed(4)}`);
    }

    if (result.metadata) {
      console.log('\nPerformance:');
      console.log(`  Fetch time: ${result.metadata.fetchDurationMs}ms`);
      console.log(`  Extract time: ${result.metadata.extractDurationMs}ms`);
      console.log(`  Model: ${result.metadata.provider}/${result.metadata.model}`);
    }
  } catch (error) {
    console.error('Extraction failed:', error);
    process.exit(1);
  }
}

main();
