/**
 * SDK version information and API compatibility checking.
 *
 * @packageDocumentation
 */

import type { Logger } from './interfaces';
import { UnsupportedAPIVersionError } from './errors';

/** Current SDK version */
export const SDK_VERSION = '0.0.0';

/** Minimum API version this SDK supports */
export const MIN_API_VERSION = '0.0.0';

/** Maximum API version this SDK was built against */
export const MAX_KNOWN_API_VERSION = '0.0.0';

/**
 * Parse a semver version string into components.
 * @param version - Version string (e.g., "1.2.3" or "1.2.3-beta")
 * @returns Object with major, minor, patch numbers
 */
export function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
} {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    return { major: 0, minor: 0, patch: 0 };
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
  };
}

/**
 * Compare two semver versions.
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const va = parseVersion(a);
  const vb = parseVersion(b);

  if (va.major !== vb.major) {
    return va.major < vb.major ? -1 : 1;
  }
  if (va.minor !== vb.minor) {
    return va.minor < vb.minor ? -1 : 1;
  }
  if (va.patch !== vb.patch) {
    return va.patch < vb.patch ? -1 : 1;
  }

  return 0;
}

/**
 * Check if an API version is compatible with this SDK.
 *
 * @param apiVersion - The API version from the X-API-Version header
 * @param logger - Logger for warnings
 * @throws {UnsupportedAPIVersionError} If the API version is too old
 */
export function checkAPIVersionCompatibility(
  apiVersion: string,
  logger: Logger
): void {
  // If API version is lower than minimum supported, throw error
  if (compareVersions(apiVersion, MIN_API_VERSION) < 0) {
    throw new UnsupportedAPIVersionError(
      apiVersion,
      MIN_API_VERSION,
      MAX_KNOWN_API_VERSION
    );
  }

  // If API major version is higher than known, warn about potential breaking changes
  const apiParsed = parseVersion(apiVersion);
  const maxParsed = parseVersion(MAX_KNOWN_API_VERSION);

  if (apiParsed.major > maxParsed.major) {
    logger.warn(
      `API version ${apiVersion} is newer than this SDK was built for (${MAX_KNOWN_API_VERSION}). ` +
        'There may be breaking changes. Consider upgrading the SDK.',
      { apiVersion, sdkVersion: SDK_VERSION, maxKnownVersion: MAX_KNOWN_API_VERSION }
    );
  }
}

/**
 * Detect the current runtime environment.
 * @returns Runtime name and version string
 */
export function detectRuntime(): { name: string; version: string } {
  // Check for Bun
  if (typeof globalThis !== 'undefined' && 'Bun' in globalThis) {
    const bun = (globalThis as unknown as { Bun: { version: string } }).Bun;
    return { name: 'Bun', version: bun.version };
  }

  // Check for Deno
  if (typeof globalThis !== 'undefined' && 'Deno' in globalThis) {
    const deno = (globalThis as unknown as { Deno: { version: { deno: string } } }).Deno;
    return { name: 'Deno', version: deno.version.deno };
  }

  // Check for Node.js
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof process !== 'undefined' && (process as any).versions?.node) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { name: 'Node', version: (process as any).versions.node };
  }

  // Browser or unknown
  if (typeof navigator !== 'undefined') {
    return { name: 'Browser', version: 'unknown' };
  }

  return { name: 'Unknown', version: 'unknown' };
}

/**
 * Build the User-Agent string for SDK requests.
 *
 * @param customSuffix - Optional suffix to append (e.g., "MyApp/1.0")
 * @returns User-Agent string
 *
 * @example
 * ```typescript
 * buildUserAgent()
 * // Returns: "Refyne-SDK-TypeScript/0.1.0 (Node/20.10.0)"
 *
 * buildUserAgent("MyApp/1.0")
 * // Returns: "Refyne-SDK-TypeScript/0.1.0 (Node/20.10.0) MyApp/1.0"
 * ```
 */
export function buildUserAgent(customSuffix?: string): string {
  const runtime = detectRuntime();
  let userAgent = `Refyne-SDK-TypeScript/${SDK_VERSION} (${runtime.name}/${runtime.version})`;

  if (customSuffix) {
    userAgent += ` ${customSuffix}`;
  }

  return userAgent;
}
