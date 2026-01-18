/**
 * Tests for the cache module.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryCache,
  parseCacheControl,
  createCacheEntry,
  generateCacheKey,
  hashString,
} from '../src/cache';

describe('parseCacheControl', () => {
  it('returns empty object for null header', () => {
    expect(parseCacheControl(null)).toEqual({});
  });

  it('returns empty object for empty string', () => {
    expect(parseCacheControl('')).toEqual({});
  });

  it('parses no-store directive', () => {
    expect(parseCacheControl('no-store')).toEqual({ noStore: true });
  });

  it('parses no-cache directive', () => {
    expect(parseCacheControl('no-cache')).toEqual({ noCache: true });
  });

  it('parses private directive', () => {
    expect(parseCacheControl('private')).toEqual({ private: true });
  });

  it('parses max-age directive', () => {
    expect(parseCacheControl('max-age=3600')).toEqual({ maxAge: 3600 });
  });

  it('parses stale-while-revalidate directive', () => {
    expect(parseCacheControl('stale-while-revalidate=60')).toEqual({
      staleWhileRevalidate: 60,
    });
  });

  it('parses multiple directives', () => {
    expect(
      parseCacheControl('private, max-age=3600, stale-while-revalidate=60')
    ).toEqual({
      private: true,
      maxAge: 3600,
      staleWhileRevalidate: 60,
    });
  });

  it('ignores invalid max-age values', () => {
    expect(parseCacheControl('max-age=invalid')).toEqual({});
  });

  it('handles case insensitivity', () => {
    expect(parseCacheControl('NO-STORE, MAX-AGE=100')).toEqual({
      noStore: true,
      maxAge: 100,
    });
  });
});

describe('generateCacheKey', () => {
  it('generates key from method and url', () => {
    expect(generateCacheKey('GET', 'https://api.example.com/data')).toBe(
      'GET:https://api.example.com/data'
    );
  });

  it('includes auth hash when provided', () => {
    expect(generateCacheKey('GET', 'https://api.example.com/data', 'abc123')).toBe(
      'GET:https://api.example.com/data:abc123'
    );
  });

  it('normalizes method to uppercase', () => {
    expect(generateCacheKey('get', 'https://api.example.com/data')).toBe(
      'GET:https://api.example.com/data'
    );
  });
});

describe('hashString', () => {
  it('returns consistent hash for same input', () => {
    const hash1 = hashString('test-api-key');
    const hash2 = hashString('test-api-key');
    expect(hash1).toBe(hash2);
  });

  it('returns different hashes for different inputs', () => {
    const hash1 = hashString('key1');
    const hash2 = hashString('key2');
    expect(hash1).not.toBe(hash2);
  });

  it('returns base36 string', () => {
    const hash = hashString('test');
    expect(/^[0-9a-z]+$/.test(hash)).toBe(true);
  });
});

describe('createCacheEntry', () => {
  it('returns undefined for no-store', () => {
    expect(createCacheEntry({ data: 'test' }, 'no-store')).toBeUndefined();
  });

  it('returns undefined when no max-age specified', () => {
    expect(createCacheEntry({ data: 'test' }, 'private')).toBeUndefined();
  });

  it('creates entry with max-age', () => {
    const now = Date.now();
    const entry = createCacheEntry({ data: 'test' }, 'max-age=3600');

    expect(entry).toBeDefined();
    expect(entry!.value).toEqual({ data: 'test' });
    expect(entry!.expiresAt).toBeGreaterThanOrEqual(now + 3600 * 1000);
    expect(entry!.expiresAt).toBeLessThanOrEqual(now + 3600 * 1000 + 100); // Allow 100ms tolerance
    expect(entry!.cacheControl.maxAge).toBe(3600);
  });

  it('preserves stale-while-revalidate', () => {
    const entry = createCacheEntry(
      { data: 'test' },
      'max-age=300, stale-while-revalidate=60'
    );

    expect(entry!.cacheControl.staleWhileRevalidate).toBe(60);
  });
});

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache({ maxEntries: 3 });
  });

  it('stores and retrieves entries', async () => {
    const entry = createCacheEntry({ data: 'test' }, 'max-age=3600')!;
    await cache.set('key1', entry);

    const retrieved = await cache.get('key1');
    expect(retrieved).toEqual(entry);
  });

  it('returns undefined for missing keys', async () => {
    const result = await cache.get('nonexistent');
    expect(result).toBeUndefined();
  });

  it('expires entries based on max-age', async () => {
    const entry = createCacheEntry({ data: 'test' }, 'max-age=0')!;
    // Manually set expiry to past
    entry.expiresAt = Date.now() - 1000;

    await cache.set('key1', entry);
    const result = await cache.get('key1');
    expect(result).toBeUndefined();
  });

  it('serves stale entries during stale-while-revalidate window', async () => {
    const entry = createCacheEntry(
      { data: 'test' },
      'max-age=0, stale-while-revalidate=3600'
    )!;
    // Set expiry to past (within stale window)
    entry.expiresAt = Date.now() - 1000;

    await cache.set('key1', entry);
    const result = await cache.get('key1');
    expect(result).toEqual(entry);
  });

  it('evicts oldest entries when at capacity', async () => {
    await cache.set('key1', createCacheEntry('value1', 'max-age=3600')!);
    await cache.set('key2', createCacheEntry('value2', 'max-age=3600')!);
    await cache.set('key3', createCacheEntry('value3', 'max-age=3600')!);

    // Adding a 4th entry should evict the oldest (key1)
    await cache.set('key4', createCacheEntry('value4', 'max-age=3600')!);

    expect(await cache.get('key1')).toBeUndefined();
    expect(await cache.get('key2')).toBeDefined();
    expect(await cache.get('key3')).toBeDefined();
    expect(await cache.get('key4')).toBeDefined();
  });

  it('does not cache no-store entries', async () => {
    const entry = createCacheEntry({ data: 'test' }, 'no-store');
    expect(entry).toBeUndefined();
  });

  it('deletes entries', async () => {
    await cache.set('key1', createCacheEntry('value1', 'max-age=3600')!);
    await cache.delete('key1');
    expect(await cache.get('key1')).toBeUndefined();
  });

  it('clears all entries', async () => {
    await cache.set('key1', createCacheEntry('value1', 'max-age=3600')!);
    await cache.set('key2', createCacheEntry('value2', 'max-age=3600')!);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('reports correct size', async () => {
    expect(cache.size).toBe(0);
    await cache.set('key1', createCacheEntry('value1', 'max-age=3600')!);
    expect(cache.size).toBe(1);
    await cache.set('key2', createCacheEntry('value2', 'max-age=3600')!);
    expect(cache.size).toBe(2);
  });
});
