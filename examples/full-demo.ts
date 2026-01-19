#!/usr/bin/env npx tsx
/**
 * Full SDK Demo - Tests all major functionality
 *
 * Run with: npx tsx examples/full-demo.ts
 */

import { Refyne, RefyneError } from '../src/index.js';
import { SDK_VERSION, MIN_API_VERSION, MAX_KNOWN_API_VERSION } from '../src/version.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
};

// Spinner class
class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private current = 0;
  private interval: NodeJS.Timeout | null = null;
  private message: string;

  constructor(message: string) {
    this.message = message;
  }

  start(): this {
    process.stdout.write('\x1b[?25l'); // Hide cursor
    this.interval = setInterval(() => {
      const frame = this.frames[this.current];
      process.stdout.write(`\r${colors.cyan}${frame}${colors.reset} ${this.message}`);
      this.current = (this.current + 1) % this.frames.length;
    }, 80);
    return this;
  }

  succeed(message?: string): void {
    this.stop();
    console.log(`\r${colors.green}✔${colors.reset} ${message || this.message}`);
  }

  fail(message?: string): void {
    this.stop();
    console.log(`\r${colors.red}✖${colors.reset} ${message || this.message}`);
  }

  private stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write('\x1b[?25h'); // Show cursor
    process.stdout.write('\r\x1b[K'); // Clear line
  }
}

function header(text: string): void {
  console.log();
  console.log(`${colors.bgBlue}${colors.bold} ${text} ${colors.reset}`);
  console.log();
}

function subheader(text: string): void {
  console.log(`${colors.bold}${colors.blue}▸ ${text}${colors.reset}`);
}

function info(label: string, value: string): void {
  console.log(`  ${colors.dim}${label}:${colors.reset} ${value}`);
}

function success(text: string): void {
  console.log(`${colors.green}✔${colors.reset} ${text}`);
}

function warn(text: string): void {
  console.log(`${colors.yellow}⚠${colors.reset} ${text}`);
}

function error(text: string): void {
  console.log(`${colors.red}✖${colors.reset} ${text}`);
}

function json(obj: unknown): void {
  console.log(colors.dim + JSON.stringify(obj, null, 2) + colors.reset);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const API_KEY = process.env.REFYNE_API_KEY;
  if (!API_KEY) {
    console.error('Error: REFYNE_API_KEY environment variable is required');
    process.exit(1);
  }
  const BASE_URL = process.env.REFYNE_BASE_URL || 'https://api.refyne.uk';
  const TEST_URL = 'https://www.bbc.co.uk/news';

  // Banner
  console.log();
  console.log(`${colors.bold}${colors.magenta}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}║${colors.reset}       ${colors.bold}Refyne TypeScript SDK - Full Demo${colors.reset}               ${colors.bold}${colors.magenta}║${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}╚═══════════════════════════════════════════════════════════╝${colors.reset}`);

  // ========== Configuration ==========
  header('Configuration');

  subheader('SDK Information');
  info('SDK Version', SDK_VERSION);
  info('Min API Version', MIN_API_VERSION);
  info('Max Known API Version', MAX_KNOWN_API_VERSION);
  info('Runtime', `Node.js ${process.version}`);

  subheader('Client Settings');
  info('Base URL', BASE_URL);
  info('API Key', `${API_KEY.slice(0, 10)}...${API_KEY.slice(-4)}`);
  info('Timeout', '30s');
  info('Max Retries', '3');
  info('Cache', 'Enabled (in-memory)');

  // Create client
  const client = new Refyne({
    apiKey: API_KEY,
    baseUrl: BASE_URL,
  });

  // ========== Subscription Info ==========
  header('Subscription Information');

  let spinner = new Spinner('Fetching usage details...').start();
  try {
    const usage = await client.getUsage();
    spinner.succeed('Usage details retrieved');

    info('Total Jobs', String(usage.total_jobs));
    info('Total Charged', `$${usage.total_charged_usd.toFixed(2)} USD`);
    info('BYOK Jobs', String(usage.byok_jobs));
  } catch (err) {
    spinner.fail('Failed to fetch usage');
    if (err instanceof RefyneError) {
      error(`${err.message}`);
    }
    throw err;
  }

  // ========== List Jobs ==========
  header('Recent Jobs');

  spinner = new Spinner('Fetching job list...').start();
  try {
    const jobList = await client.jobs.list(5, 0);
    spinner.succeed(`Found ${jobList.jobs.length} jobs`);

    if (jobList.jobs.length > 0) {
      subheader('Latest Jobs');
      for (const job of jobList.jobs.slice(0, 3)) {
        console.log();
        info('ID', job.id);
        info('Type', job.type);
        info('Status', job.status);
        info('URL', job.url);
        info('Pages', String(job.page_count));
        if (job.completed_at) {
          info('Completed', job.completed_at);
        }
      }
    }
  } catch (err) {
    spinner.fail('Failed to fetch jobs');
    if (err instanceof RefyneError) {
      error(`${err.message}`);
    }
  }

  // ========== Try Analyze (may fail due to plan restrictions) ==========
  header('Website Analysis');

  subheader('Target');
  info('URL', TEST_URL);

  spinner = new Spinner('Analyzing website structure...').start();
  let suggestedSchema: Record<string, unknown> | null = null;
  try {
    const analysis = await client.analyze({ url: TEST_URL });
    spinner.succeed('Website analysis complete');

    // suggested_schema is a YAML string - display it and use fallback dict
    info('Suggested Schema (YAML)', '');
    console.log(colors.dim + analysis.suggested_schema + colors.reset);
    // Use a simple dict schema for extraction demo
    suggestedSchema = { headline: 'string', summary: 'string' };
    info('Using simplified schema for demo', '');
    json(suggestedSchema);

    if (analysis.follow_patterns && analysis.follow_patterns.length > 0) {
      const patterns = analysis.follow_patterns.map(p => p.pattern).join(', ');
      info('Follow Patterns', patterns);
    }
  } catch (err) {
    spinner.fail('Analysis unavailable');
    if (err instanceof RefyneError) {
      warn(`${err.message}`);
      // Use a simple fallback schema
      suggestedSchema = {
        headline: 'string',
        summary: 'string',
      };
      info('Using fallback schema', '');
      json(suggestedSchema);
    }
  }

  // ========== Single Page Extract ==========
  header('Single Page Extraction');

  subheader('Request');
  info('URL', TEST_URL);
  info('Schema', suggestedSchema ? 'Using schema from above' : 'Simple schema');

  const schema = suggestedSchema || { title: 'string', description: 'string' };

  spinner = new Spinner('Extracting data from page...').start();
  try {
    const result = await client.extract({
      url: TEST_URL,
      schema,
    });
    spinner.succeed('Extraction complete');

    subheader('Result');
    info('Fetched At', result.fetched_at);
    if (result.usage) {
      info('Tokens', `${result.usage.input_tokens} in / ${result.usage.output_tokens} out`);
      info('Cost', `$${result.usage.cost_usd.toFixed(6)}`);
    }
    if (result.metadata) {
      info('Model', `${result.metadata.provider}/${result.metadata.model}`);
      info('Duration', `${result.metadata.fetch_duration_ms}ms fetch + ${result.metadata.extract_duration_ms}ms extract`);
    }

    subheader('Extracted Data');
    json(result.data);
  } catch (err) {
    spinner.fail('Extraction failed');
    if (err instanceof RefyneError) {
      warn(`${err.message}`);
    }
  }

  // ========== Crawl Job ==========
  header('Crawl Job');

  subheader('Request');
  info('URL', TEST_URL);
  info('Max URLs', '5');
  info('Schema', 'Using schema from above');

  spinner = new Spinner('Starting crawl job...').start();
  let jobId: string | null = null;
  try {
    const crawlResult = await client.crawl({
      url: TEST_URL,
      schema,
      options: {
        max_urls: 5,
        max_depth: 1,
      },
    });
    spinner.succeed('Crawl job started');
    jobId = crawlResult.job_id;

    info('Job ID', jobId);
    info('Status', crawlResult.status);
  } catch (err) {
    spinner.fail('Failed to start crawl');
    if (err instanceof RefyneError) {
      warn(`${err.message}`);
    }
  }

  // ========== Stream Results via polling ==========
  if (jobId) {
    header('Monitoring Job Progress');

    subheader('Polling job status...');

    let lastStatus = '';
    let pageCount = 0;

    try {
      const pollInterval = 2000;
      let completed = false;

      while (!completed) {
        const job = await client.jobs.get(jobId);

        if (job.status !== lastStatus) {
          console.log(`  ${colors.cyan}→${colors.reset} Status: ${colors.bold}${job.status}${colors.reset}`);
          lastStatus = job.status;
        }

        if (job.page_count > pageCount) {
          const newPages = job.page_count - pageCount;
          for (let i = 0; i < newPages; i++) {
            console.log(`  ${colors.green}✔${colors.reset} Page ${pageCount + i + 1} extracted`);
          }
          pageCount = job.page_count;
        }

        if (job.status === 'completed' || job.status === 'failed') {
          completed = true;
          if (job.status === 'completed') {
            success(`Crawl completed - ${job.page_count} pages processed`);
          } else {
            error(`Crawl failed: ${job.error_message || 'Unknown error'}`);
          }
        } else {
          await sleep(pollInterval);
        }
      }
    } catch (err) {
      error('Error monitoring job');
      if (err instanceof RefyneError) {
        error(`${err.message}`);
      }
    }

    // ========== Fetch Job Results ==========
    header('Job Results');

    spinner = new Spinner('Fetching job details and results...').start();
    try {
      const job = await client.jobs.get(jobId);
      spinner.succeed('Job details retrieved');

      subheader('Job Details');
      info('ID', job.id);
      info('Type', job.type);
      info('Status', job.status);
      info('URL', job.url);
      info('Pages Processed', String(job.page_count));
      info('Tokens', `${job.token_usage_input} in / ${job.token_usage_output} out`);
      info('Cost', `$${job.cost_usd.toFixed(4)} USD`);
      if (job.started_at) info('Started', job.started_at);
      if (job.completed_at) info('Completed', job.completed_at);

      // Get results
      spinner = new Spinner('Fetching extraction results...').start();
      const results = await client.jobs.getResults(jobId);
      spinner.succeed('Results retrieved');

      subheader('Extracted Data');
      if (results.results && results.results.length > 0) {
        info('Total Results', String(results.results.length));
        console.log();
        json(results.results);
      } else {
        warn('No results available');
      }
    } catch (err) {
      spinner.fail('Failed to fetch results');
      if (err instanceof RefyneError) {
        error(`${err.message}`);
      }
    }
  }

  // ========== Done ==========
  console.log();
  console.log(`${colors.bgGreen}${colors.bold} Demo Complete ${colors.reset}`);
  console.log();
}

main().catch(err => {
  console.error(`\n${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
