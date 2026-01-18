/**
 * Tests for the errors module.
 */

import { describe, it, expect } from 'vitest';
import {
  RefyneError,
  RateLimitError,
  ValidationError,
  UnsupportedAPIVersionError,
  TLSError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  createErrorFromResponse,
} from '../src/errors';

describe('RefyneError', () => {
  it('has correct name', () => {
    const error = new RefyneError('test message', 500);
    expect(error.name).toBe('RefyneError');
  });

  it('stores message and status', () => {
    const error = new RefyneError('test message', 404);
    expect(error.message).toBe('test message');
    expect(error.status).toBe(404);
  });

  it('stores optional detail', () => {
    const error = new RefyneError('test', 400, 'additional detail');
    expect(error.detail).toBe('additional detail');
  });

  it('is instanceof Error', () => {
    const error = new RefyneError('test', 500);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('RateLimitError', () => {
  it('has correct name', () => {
    const error = new RateLimitError('rate limited', 60);
    expect(error.name).toBe('RateLimitError');
  });

  it('stores retryAfter', () => {
    const error = new RateLimitError('rate limited', 60);
    expect(error.retryAfter).toBe(60);
  });

  it('has status 429', () => {
    const error = new RateLimitError('rate limited', 60);
    expect(error.status).toBe(429);
  });

  it('is instanceof RefyneError', () => {
    const error = new RateLimitError('rate limited', 60);
    expect(error).toBeInstanceOf(RefyneError);
  });
});

describe('ValidationError', () => {
  it('has correct name', () => {
    const error = new ValidationError('invalid');
    expect(error.name).toBe('ValidationError');
  });

  it('stores field errors', () => {
    const errors = {
      url: ['required'],
      schema: ['invalid format'],
    };
    const error = new ValidationError('validation failed', errors);
    expect(error.errors).toEqual(errors);
  });

  it('has status 400', () => {
    const error = new ValidationError('invalid');
    expect(error.status).toBe(400);
  });
});

describe('UnsupportedAPIVersionError', () => {
  it('has correct name', () => {
    const error = new UnsupportedAPIVersionError('0.1.0', '0.2.0', '0.3.0');
    expect(error.name).toBe('UnsupportedAPIVersionError');
  });

  it('stores version information', () => {
    const error = new UnsupportedAPIVersionError('0.1.0', '0.2.0', '0.3.0');
    expect(error.apiVersion).toBe('0.1.0');
    expect(error.minVersion).toBe('0.2.0');
    expect(error.maxKnownVersion).toBe('0.3.0');
  });

  it('formats helpful message', () => {
    const error = new UnsupportedAPIVersionError('0.1.0', '0.2.0', '0.3.0');
    expect(error.message).toContain('0.1.0');
    expect(error.message).toContain('0.2.0');
  });
});

describe('TLSError', () => {
  it('has correct name', () => {
    const error = new TLSError('https://example.com', 'certificate error');
    expect(error.name).toBe('TLSError');
  });

  it('stores URL and TLS error', () => {
    const error = new TLSError('https://example.com', 'certificate expired');
    expect(error.url).toBe('https://example.com');
    expect(error.tlsError).toBe('certificate expired');
  });
});

describe('AuthenticationError', () => {
  it('has correct name and status', () => {
    const error = new AuthenticationError('invalid key');
    expect(error.name).toBe('AuthenticationError');
    expect(error.status).toBe(401);
  });
});

describe('ForbiddenError', () => {
  it('has correct name and status', () => {
    const error = new ForbiddenError('access denied');
    expect(error.name).toBe('ForbiddenError');
    expect(error.status).toBe(403);
  });
});

describe('NotFoundError', () => {
  it('has correct name and status', () => {
    const error = new NotFoundError('not found');
    expect(error.name).toBe('NotFoundError');
    expect(error.status).toBe(404);
  });
});

describe('createErrorFromResponse', () => {
  const createMockResponse = (
    status: number,
    body: object,
    headers: Record<string, string> = {}
  ) => {
    return {
      status,
      headers: {
        get: (name: string) => headers[name.toLowerCase()] ?? null,
      },
      json: async () => body,
    } as unknown as Response;
  };

  it('creates RateLimitError for 429', async () => {
    const response = createMockResponse(
      429,
      { error: 'rate limited' },
      { 'retry-after': '60' }
    );
    const error = await createErrorFromResponse(response);
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfter).toBe(60);
  });

  it('creates AuthenticationError for 401', async () => {
    const response = createMockResponse(401, { error: 'unauthorized' });
    const error = await createErrorFromResponse(response);
    expect(error).toBeInstanceOf(AuthenticationError);
  });

  it('creates ForbiddenError for 403', async () => {
    const response = createMockResponse(403, { error: 'forbidden' });
    const error = await createErrorFromResponse(response);
    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it('creates NotFoundError for 404', async () => {
    const response = createMockResponse(404, { error: 'not found' });
    const error = await createErrorFromResponse(response);
    expect(error).toBeInstanceOf(NotFoundError);
  });

  it('creates ValidationError for 400', async () => {
    const response = createMockResponse(400, {
      error: 'validation failed',
      detail: 'url: required',
    });
    const error = await createErrorFromResponse(response);
    expect(error).toBeInstanceOf(ValidationError);
  });

  it('creates RefyneError for other status codes', async () => {
    const response = createMockResponse(500, { error: 'internal error' });
    const error = await createErrorFromResponse(response);
    expect(error).toBeInstanceOf(RefyneError);
    expect(error.status).toBe(500);
  });

  it('handles response without JSON body', async () => {
    const response = {
      status: 500,
      headers: {
        get: () => null,
      },
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response;

    const error = await createErrorFromResponse(response);
    expect(error).toBeInstanceOf(RefyneError);
  });
});
