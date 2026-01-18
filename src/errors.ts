/**
 * Error types for the Refyne SDK.
 *
 * All SDK errors extend {@link RefyneError} which provides consistent
 * error handling across the API.
 *
 * @packageDocumentation
 */

/**
 * Base error class for all Refyne SDK errors.
 *
 * @example
 * ```typescript
 * try {
 *   await refyne.extract({ url, schema });
 * } catch (error) {
 *   if (error instanceof RefyneError) {
 *     console.error(`API Error: ${error.message} (status: ${error.status})`);
 *   }
 * }
 * ```
 */
export class RefyneError extends Error {
  /** HTTP status code from the API response */
  readonly status: number;
  /** Additional error details from the API */
  readonly detail?: string;
  /** The original response (if available) */
  readonly response?: Response;

  constructor(
    message: string,
    status: number,
    detail?: string,
    response?: Response
  ) {
    super(message);
    this.name = 'RefyneError';
    this.status = status;
    this.detail = detail;
    this.response = response;

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RefyneError);
    }
  }
}

/**
 * Error thrown when the API rate limit is exceeded.
 *
 * The `retryAfter` property indicates how many seconds to wait
 * before retrying. The SDK's auto-retry handles this automatically.
 *
 * @example
 * ```typescript
 * try {
 *   await refyne.extract({ url, schema });
 * } catch (error) {
 *   if (error instanceof RateLimitError) {
 *     console.log(`Rate limited. Retry after ${error.retryAfter} seconds`);
 *   }
 * }
 * ```
 */
export class RateLimitError extends RefyneError {
  /** Seconds to wait before retrying */
  readonly retryAfter: number;

  constructor(
    message: string,
    retryAfter: number,
    detail?: string,
    response?: Response
  ) {
    super(message, 429, detail, response);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Error thrown when request validation fails.
 *
 * This typically indicates an issue with the request payload,
 * such as an invalid URL or malformed schema.
 */
export class ValidationError extends RefyneError {
  /** Field-level validation errors */
  readonly errors?: Record<string, string[]>;

  constructor(
    message: string,
    errors?: Record<string, string[]>,
    response?: Response
  ) {
    super(message, 400, undefined, response);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when the API version is incompatible with the SDK.
 *
 * This occurs when the API version is lower than the SDK's minimum
 * supported version, or when the API major version is higher than
 * the SDK knows about.
 *
 * @example
 * ```typescript
 * try {
 *   await refyne.extract({ url, schema });
 * } catch (error) {
 *   if (error instanceof UnsupportedAPIVersionError) {
 *     console.error(`API version ${error.apiVersion} is not supported.`);
 *     console.error(`This SDK requires API version >= ${error.minVersion}`);
 *   }
 * }
 * ```
 */
export class UnsupportedAPIVersionError extends RefyneError {
  /** The API version that was detected */
  readonly apiVersion: string;
  /** The minimum version this SDK supports */
  readonly minVersion: string;
  /** The maximum known version this SDK was built for */
  readonly maxKnownVersion: string;

  constructor(
    apiVersion: string,
    minVersion: string,
    maxKnownVersion: string
  ) {
    const message = `API version ${apiVersion} is not supported. This SDK requires API version >= ${minVersion}. Please upgrade the API or use an older SDK version.`;
    super(message, 0);
    this.name = 'UnsupportedAPIVersionError';
    this.apiVersion = apiVersion;
    this.minVersion = minVersion;
    this.maxKnownVersion = maxKnownVersion;
  }
}

/**
 * Error thrown when TLS certificate validation fails.
 *
 * This error is thrown when connecting to an API endpoint with
 * an invalid, self-signed, or expired certificate.
 */
export class TLSError extends RefyneError {
  /** The URL that failed TLS validation */
  readonly url: string;
  /** The underlying TLS error message */
  readonly tlsError: string;

  constructor(url: string, tlsError: string) {
    super(`TLS certificate validation failed for ${url}: ${tlsError}`, 0);
    this.name = 'TLSError';
    this.url = url;
    this.tlsError = tlsError;
  }
}

/**
 * Error thrown when authentication fails.
 *
 * This typically indicates an invalid or expired API key.
 */
export class AuthenticationError extends RefyneError {
  constructor(message: string = 'Authentication failed', response?: Response) {
    super(message, 401, undefined, response);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when the user lacks permission for an operation.
 *
 * This may indicate the user's tier doesn't have access to a feature,
 * or they've exceeded their quota.
 */
export class ForbiddenError extends RefyneError {
  constructor(message: string = 'Access forbidden', response?: Response) {
    super(message, 403, undefined, response);
    this.name = 'ForbiddenError';
  }
}

/**
 * Error thrown when a requested resource is not found.
 */
export class NotFoundError extends RefyneError {
  constructor(
    message: string = 'Resource not found',
    response?: Response
  ) {
    super(message, 404, undefined, response);
    this.name = 'NotFoundError';
  }
}

/**
 * Create the appropriate error type from an API response.
 * @internal
 */
export async function createErrorFromResponse(
  response: Response
): Promise<RefyneError> {
  let errorBody: { error?: string; message?: string; detail?: string; errors?: Record<string, string[]> } = {};

  try {
    errorBody = await response.json();
  } catch {
    // Response may not be JSON
  }

  const message = errorBody.error || errorBody.message || response.statusText || 'Unknown error';
  const detail = errorBody.detail;

  switch (response.status) {
    case 400:
      return new ValidationError(message, errorBody.errors, response);

    case 401:
      return new AuthenticationError(message, response);

    case 403:
      return new ForbiddenError(message, response);

    case 404:
      return new NotFoundError(message, response);

    case 429: {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      return new RateLimitError(message, retryAfter, detail, response);
    }

    default:
      return new RefyneError(message, response.status, detail, response);
  }
}
