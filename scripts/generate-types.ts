#!/usr/bin/env npx ts-node
/**
 * Generate TypeScript types from the Refyne API OpenAPI specification.
 *
 * This script fetches the OpenAPI spec from a configurable location and
 * generates TypeScript types. The output is written to src/types.ts.
 *
 * Usage:
 *   npx ts-node scripts/generate-types.ts [options]
 *
 * Options:
 *   --url <url>      Fetch spec from URL (default: https://api.refyne.uk/openapi.json)
 *   --file <path>    Read spec from local file
 *   --output <path>  Output file path (default: src/types.ts)
 *   --help           Show this help message
 *
 * Environment Variables:
 *   OPENAPI_SPEC_URL   Override the default URL
 *   OPENAPI_SPEC_FILE  Use a local file instead of fetching
 *
 * @packageDocumentation
 */

import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_SPEC_URL = 'https://api.refyne.uk/openapi.json';
const DEFAULT_OUTPUT = 'src/types.ts';

interface OpenAPISchema {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, Record<string, PathItem>>;
  components?: {
    schemas?: Record<string, SchemaObject>;
  };
}

interface PathItem {
  summary?: string;
  description?: string;
  deprecated?: boolean;
  'x-deprecated-message'?: string;
  requestBody?: {
    content: {
      'application/json': {
        schema: SchemaObject;
      };
    };
  };
  responses?: Record<string, ResponseObject>;
}

interface ResponseObject {
  description?: string;
  content?: {
    'application/json'?: {
      schema: SchemaObject;
    };
  };
}

interface SchemaObject {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  enum?: string[];
  $ref?: string;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  additionalProperties?: boolean | SchemaObject;
  deprecated?: boolean;
  'x-deprecated-message'?: string;
}

interface CLIArgs {
  url?: string;
  file?: string;
  output: string;
  help: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {
    output: process.env.OPENAPI_SPEC_FILE
      ? DEFAULT_OUTPUT
      : DEFAULT_OUTPUT,
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

Usage:
  npx ts-node scripts/generate-types.ts [options]

Options:
  --url <url>      Fetch spec from URL (default: ${DEFAULT_SPEC_URL})
  --file <path>    Read spec from local file
  --output <path>  Output file path (default: ${DEFAULT_OUTPUT})
  --help, -h       Show this help message

Environment Variables:
  OPENAPI_SPEC_URL   Override the default URL
  OPENAPI_SPEC_FILE  Use a local file instead of fetching

Examples:
  # Fetch from production API
  npx ts-node scripts/generate-types.ts

  # Fetch from local development server
  npx ts-node scripts/generate-types.ts --url http://localhost:8080/openapi.json

  # Use a local file
  npx ts-node scripts/generate-types.ts --file ./openapi.json

  # Using environment variables
  OPENAPI_SPEC_URL=http://localhost:8080/openapi.json npx ts-node scripts/generate-types.ts
`);
}

async function fetchSpec(url: string): Promise<OpenAPISchema> {
  console.log(`Fetching OpenAPI spec from: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch spec: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<OpenAPISchema>;
}

function loadSpecFromFile(filePath: string): OpenAPISchema {
  console.log(`Loading OpenAPI spec from file: ${filePath}`);
  const absolutePath = path.resolve(filePath);
  const content = fs.readFileSync(absolutePath, 'utf-8');
  return JSON.parse(content) as OpenAPISchema;
}

function resolveRef(ref: string, spec: OpenAPISchema): SchemaObject {
  const refPath = ref.replace('#/', '').split('/');
  let current: unknown = spec;
  for (const part of refPath) {
    current = (current as Record<string, unknown>)[part];
  }
  return current as SchemaObject;
}

function schemaToTypeString(
  schema: SchemaObject,
  spec: OpenAPISchema,
  indent = ''
): string {
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop()!;
    return refName;
  }

  if (schema.allOf) {
    const types = schema.allOf.map((s) => schemaToTypeString(s, spec, indent));
    return types.join(' & ');
  }

  if (schema.oneOf || schema.anyOf) {
    const schemas = schema.oneOf || schema.anyOf!;
    const types = schemas.map((s) => schemaToTypeString(s, spec, indent));
    return types.join(' | ');
  }

  if (schema.enum) {
    return schema.enum.map((v) => `'${v}'`).join(' | ');
  }

  switch (schema.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      if (schema.items) {
        return `Array<${schemaToTypeString(schema.items, spec, indent)}>`;
      }
      return 'unknown[]';
    case 'object':
      if (schema.additionalProperties === true) {
        return 'Record<string, unknown>';
      }
      if (typeof schema.additionalProperties === 'object') {
        return `Record<string, ${schemaToTypeString(schema.additionalProperties, spec, indent)}>`;
      }
      if (!schema.properties) {
        return 'Record<string, unknown>';
      }
      // For inline objects, we'd generate interface-like syntax
      const props = Object.entries(schema.properties).map(([name, propSchema]) => {
        const required = schema.required?.includes(name) ? '' : '?';
        const propType = schemaToTypeString(propSchema, spec, indent + '  ');
        return `${indent}  ${name}${required}: ${propType};`;
      });
      return `{\n${props.join('\n')}\n${indent}}`;
    default:
      return 'unknown';
  }
}

function generateInterface(
  name: string,
  schema: SchemaObject,
  spec: OpenAPISchema
): string {
  const lines: string[] = [];

  // Add JSDoc
  if (schema.description) {
    lines.push('/**');
    lines.push(` * ${schema.description}`);
    if (schema.deprecated) {
      const msg = schema['x-deprecated-message'] || 'This type is deprecated.';
      lines.push(` * @deprecated ${msg}`);
    }
    lines.push(' */');
  } else if (schema.deprecated) {
    const msg = schema['x-deprecated-message'] || 'This type is deprecated.';
    lines.push(`/** @deprecated ${msg} */`);
  }

  if (schema.allOf) {
    // Handle allOf as interface extension
    const types = schema.allOf.map((s) => schemaToTypeString(s, spec, ''));
    lines.push(`export interface ${name} extends ${types.join(', ')} {}`);
  } else if (schema.enum) {
    // Generate string literal type for enums
    const values = schema.enum.map((v) => `'${v}'`).join(' | ');
    lines.push(`export type ${name} = ${values};`);
  } else if (schema.type === 'object' || schema.properties) {
    lines.push(`export interface ${name} {`);
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const required = schema.required?.includes(propName) ? '' : '?';
        const propType = schemaToTypeString(propSchema, spec, '  ');

        // Add property JSDoc
        if (propSchema.description || propSchema.deprecated) {
          lines.push('  /**');
          if (propSchema.description) {
            lines.push(`   * ${propSchema.description}`);
          }
          if (propSchema.deprecated) {
            const msg = propSchema['x-deprecated-message'] || 'This property is deprecated.';
            lines.push(`   * @deprecated ${msg}`);
          }
          lines.push('   */');
        }
        lines.push(`  ${propName}${required}: ${propType};`);
      }
    }
    lines.push('}');
  } else {
    // Type alias
    const typeStr = schemaToTypeString(schema, spec, '');
    lines.push(`export type ${name} = ${typeStr};`);
  }

  return lines.join('\n');
}

function generateTypes(spec: OpenAPISchema): string {
  const lines: string[] = [
    '/**',
    ' * API types for the Refyne SDK.',
    ' *',
    ' * These types are generated from the OpenAPI specification.',
    ' * Do not edit this file manually - run `npm run generate` to regenerate.',
    ' *',
    ` * Generated from API version: ${spec.info.version}`,
    ' *',
    ' * @packageDocumentation',
    ' */',
    '',
  ];

  if (!spec.components?.schemas) {
    lines.push('// No schemas found in OpenAPI specification');
    return lines.join('\n');
  }

  // Group schemas by category (request, response, other)
  const requestSchemas: string[] = [];
  const responseSchemas: string[] = [];
  const otherSchemas: string[] = [];

  for (const [name, schema] of Object.entries(spec.components.schemas)) {
    const generated = generateInterface(name, schema, spec);
    if (name.endsWith('Request') || name.endsWith('Input')) {
      requestSchemas.push(generated);
    } else if (name.endsWith('Response') || name.endsWith('Output')) {
      responseSchemas.push(generated);
    } else {
      otherSchemas.push(generated);
    }
  }

  if (requestSchemas.length > 0) {
    lines.push('// ============================================================================');
    lines.push('// Request Types');
    lines.push('// ============================================================================');
    lines.push('');
    lines.push(requestSchemas.join('\n\n'));
    lines.push('');
  }

  if (responseSchemas.length > 0) {
    lines.push('// ============================================================================');
    lines.push('// Response Types');
    lines.push('// ============================================================================');
    lines.push('');
    lines.push(responseSchemas.join('\n\n'));
    lines.push('');
  }

  if (otherSchemas.length > 0) {
    lines.push('// ============================================================================');
    lines.push('// Other Types');
    lines.push('// ============================================================================');
    lines.push('');
    lines.push(otherSchemas.join('\n\n'));
    lines.push('');
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  try {
    let spec: OpenAPISchema;

    if (args.file) {
      spec = loadSpecFromFile(args.file);
    } else {
      spec = await fetchSpec(args.url!);
    }

    console.log(`OpenAPI version: ${spec.openapi}`);
    console.log(`API title: ${spec.info.title}`);
    console.log(`API version: ${spec.info.version}`);

    const types = generateTypes(spec);
    const outputPath = path.resolve(args.output);

    fs.writeFileSync(outputPath, types, 'utf-8');
    console.log(`Types written to: ${outputPath}`);
  } catch (error) {
    console.error('Error generating types:', (error as Error).message);
    process.exit(1);
  }
}

main();
