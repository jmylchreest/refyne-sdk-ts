/**
 * Bring Your Own Key (BYOK) example.
 *
 * This example demonstrates how to configure LLM providers with your own API keys
 * and set up a fallback chain.
 *
 * @example
 * ```bash
 * # Set your API keys
 * export REFYNE_API_KEY=your_refyne_api_key
 * export OPENAI_API_KEY=your_openai_api_key
 * export ANTHROPIC_API_KEY=your_anthropic_api_key
 *
 * # Run the example
 * npx ts-node examples/byok-provider.ts
 * ```
 */

import { Refyne } from '../src';

async function main() {
  const refyne = new Refyne.Builder()
    .apiKey(process.env.REFYNE_API_KEY!)
    .build();

  console.log('Configuring LLM providers...\n');

  try {
    // List available providers
    const providers = await refyne.llm.listProviders();
    console.log('Available providers:', providers.providers.join(', '));

    // Add your OpenAI key
    if (process.env.OPENAI_API_KEY) {
      const openaiKey = await refyne.llm.upsertKey({
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: 'gpt-4o',
        isEnabled: true,
      });
      console.log(`Added OpenAI key: ${openaiKey.id}`);
    }

    // Add your Anthropic key
    if (process.env.ANTHROPIC_API_KEY) {
      const anthropicKey = await refyne.llm.upsertKey({
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        defaultModel: 'claude-3-5-sonnet-20241022',
        isEnabled: true,
      });
      console.log(`Added Anthropic key: ${anthropicKey.id}`);
    }

    // List configured keys
    const keys = await refyne.llm.listKeys();
    console.log('\nConfigured keys:');
    for (const key of keys.keys) {
      console.log(`  - ${key.provider}: ${key.defaultModel} (${key.isEnabled ? 'enabled' : 'disabled'})`);
    }

    // Set up a fallback chain
    // This defines the order in which providers are tried if one fails
    await refyne.llm.setChain({
      chain: [
        { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
        { provider: 'openai', model: 'gpt-4o' },
        { provider: 'credits', model: 'default' }, // Fallback to Refyne credits
      ],
    });
    console.log('\nFallback chain configured');

    // Get the current chain
    const chain = await refyne.llm.getChain();
    console.log('Current chain:');
    for (const entry of chain.chain) {
      console.log(`  ${entry.position}. ${entry.provider}/${entry.model}`);
    }

    // Now extractions will use your configured chain
    console.log('\nMaking extraction with BYOK...');

    const result = await refyne.extract({
      url: 'https://example.com/product',
      schema: {
        title: 'string',
        price: 'number',
      },
      // You can also override per-request:
      llmConfig: {
        provider: 'openai',
        model: 'gpt-4o-mini',
      },
    });

    console.log('Extraction result:');
    console.log(JSON.stringify(result.data, null, 2));

    if (result.usage) {
      console.log(`\nUsed BYOK: ${result.usage.isByok}`);
      console.log(`LLM cost: $${result.usage.llmCostUsd.toFixed(4)}`);
      console.log(`Charged: $${result.usage.costUsd.toFixed(4)}`);
    }
  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  }
}

main();
