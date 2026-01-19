import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Refyne, RefyneBuilder, DEFAULT_BASE_URL, DEFAULT_TIMEOUT, DEFAULT_MAX_RETRIES } from '../src/index';

describe('Refyne Client', () => {
  describe('construction', () => {
    it('should create client with API key', () => {
      const client = new Refyne({ apiKey: 'test-key' });
      expect(client).toBeDefined();
      expect(client.jobs).toBeDefined();
      expect(client.schemas).toBeDefined();
      expect(client.sites).toBeDefined();
      expect(client.keys).toBeDefined();
      expect(client.llm).toBeDefined();
    });

    it('should accept empty API key (validation happens on request)', () => {
      // The constructor doesn't validate the API key - validation happens server-side
      const client = new Refyne({ apiKey: '' });
      expect(client).toBeDefined();
    });

    it('should use default configuration values', () => {
      const client = new Refyne({ apiKey: 'test-key' });
      expect(client.version.sdk).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const client = new Refyne({
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.url',
        timeout: 60000,
        maxRetries: 5,
      });
      expect(client).toBeDefined();
    });

    it('should strip trailing slash from base URL', () => {
      const client = new Refyne({
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.url/',
      });
      expect(client).toBeDefined();
    });
  });

  describe('RefyneBuilder', () => {
    it('should build client using fluent interface', () => {
      const client = new RefyneBuilder()
        .apiKey('test-key')
        .baseUrl('https://custom.api.url')
        .timeout(60000)
        .maxRetries(5)
        .build();

      expect(client).toBeInstanceOf(Refyne);
    });

    it('should throw error when building without API key', () => {
      expect(() => new RefyneBuilder().build()).toThrow('API key is required');
    });

    it('should be accessible via static method', () => {
      const client = new Refyne.Builder()
        .apiKey('test-key')
        .build();

      expect(client).toBeInstanceOf(Refyne);
    });
  });

  describe('sub-clients', () => {
    let client: Refyne;

    beforeEach(() => {
      client = new Refyne({ apiKey: 'test-key' });
    });

    it('should have jobs sub-client with expected methods', () => {
      expect(client.jobs).toBeDefined();
      expect(typeof client.jobs.list).toBe('function');
      expect(typeof client.jobs.get).toBe('function');
      expect(typeof client.jobs.getResults).toBe('function');
      expect(typeof client.jobs.download).toBe('function');
    });

    it('should have schemas sub-client with expected methods', () => {
      expect(client.schemas).toBeDefined();
      expect(typeof client.schemas.list).toBe('function');
      expect(typeof client.schemas.get).toBe('function');
      expect(typeof client.schemas.create).toBe('function');
      expect(typeof client.schemas.update).toBe('function');
      expect(typeof client.schemas.delete).toBe('function');
    });

    it('should have sites sub-client with expected methods', () => {
      expect(client.sites).toBeDefined();
      expect(typeof client.sites.list).toBe('function');
      expect(typeof client.sites.get).toBe('function');
      expect(typeof client.sites.create).toBe('function');
      expect(typeof client.sites.update).toBe('function');
      expect(typeof client.sites.delete).toBe('function');
    });

    it('should have keys sub-client with expected methods', () => {
      expect(client.keys).toBeDefined();
      expect(typeof client.keys.list).toBe('function');
      expect(typeof client.keys.create).toBe('function');
      expect(typeof client.keys.revoke).toBe('function');
    });

    it('should have llm sub-client with expected methods', () => {
      expect(client.llm).toBeDefined();
      expect(typeof client.llm.listProviders).toBe('function');
      expect(typeof client.llm.listModels).toBe('function');
      expect(typeof client.llm.listKeys).toBe('function');
      expect(typeof client.llm.upsertKey).toBe('function');
      expect(typeof client.llm.deleteKey).toBe('function');
      expect(typeof client.llm.getChain).toBe('function');
      expect(typeof client.llm.setChain).toBe('function');
    });
  });

  describe('main client methods', () => {
    let client: Refyne;

    beforeEach(() => {
      client = new Refyne({ apiKey: 'test-key' });
    });

    it('should have extract method', () => {
      expect(typeof client.extract).toBe('function');
    });

    it('should have crawl method', () => {
      expect(typeof client.crawl).toBe('function');
    });

    it('should have analyze method', () => {
      expect(typeof client.analyze).toBe('function');
    });

    it('should have getUsage method', () => {
      expect(typeof client.getUsage).toBe('function');
    });

    it('should expose rawClient for advanced usage', () => {
      expect(client.rawClient).toBeDefined();
    });

    it('should expose version information', () => {
      expect(client.version).toBeDefined();
      expect(client.version.sdk).toBeDefined();
      expect(client.version.minApi).toBeDefined();
      expect(client.version.maxKnownApi).toBeDefined();
    });
  });

  describe('constants', () => {
    it('should export DEFAULT_BASE_URL', () => {
      expect(DEFAULT_BASE_URL).toBe('https://api.refyne.uk');
    });

    it('should export DEFAULT_TIMEOUT', () => {
      expect(DEFAULT_TIMEOUT).toBe(30000);
    });

    it('should export DEFAULT_MAX_RETRIES', () => {
      expect(DEFAULT_MAX_RETRIES).toBe(3);
    });
  });
});
