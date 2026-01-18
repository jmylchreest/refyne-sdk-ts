/**
 * Crawl job example.
 *
 * This example demonstrates how to start a crawl job, poll for completion,
 * and retrieve results.
 *
 * @example
 * ```bash
 * # Set your API key
 * export REFYNE_API_KEY=your_api_key_here
 *
 * # Run the example
 * npx ts-node examples/crawl-job.ts
 * ```
 */

import { Refyne } from '../src';

// Define the shape of data we expect to extract from each page
interface ProductListingData {
  products: Array<{
    name: string;
    price: number;
    url: string;
  }>;
}

async function main() {
  const refyne = new Refyne.Builder()
    .apiKey(process.env.REFYNE_API_KEY!)
    .timeout(60000)
    .build();

  console.log('Starting crawl job...\n');

  try {
    // Start a crawl job
    const job = await refyne.crawl({
      url: 'https://example.com/products',
      schema: {
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              price: { type: 'number' },
              url: { type: 'string' },
            },
          },
        },
      },
      options: {
        followSelector: 'a.pagination-next',
        maxPages: 5,
        delay: '1s',
        concurrency: 2,
      },
    });

    console.log(`Job created: ${job.jobId}`);
    console.log(`Status URL: ${job.statusUrl}`);
    console.log('');

    // Poll for completion
    let status = await refyne.jobs.get(job.jobId);
    console.log(`Initial status: ${status.status}`);

    while (status.status === 'pending' || status.status === 'running') {
      // Wait 2 seconds between polls
      await new Promise((resolve) => setTimeout(resolve, 2000));

      status = await refyne.jobs.get(job.jobId);
      console.log(`Status: ${status.status} (${status.pageCount} pages processed)`);
    }

    console.log('');

    if (status.status === 'failed') {
      console.error(`Job failed: ${status.errorMessage}`);
      process.exit(1);
    }

    // Get results
    const results = await refyne.jobs.getResults(job.jobId);
    console.log(`Completed! Processed ${results.pageCount} pages`);
    console.log('');

    // Display results
    if (results.results) {
      for (const result of results.results) {
        console.log('Page result:');
        console.log(JSON.stringify(result, null, 2));
        console.log('');
      }
    }

    // Or get merged results
    const merged = await refyne.jobs.getResultsMerged<ProductListingData>(job.jobId);
    console.log('All products:');
    if (merged.products) {
      for (const product of merged.products) {
        console.log(`  - ${product.name}: $${product.price}`);
      }
    }
  } catch (error) {
    console.error('Crawl failed:', error);
    process.exit(1);
  }
}

main();
