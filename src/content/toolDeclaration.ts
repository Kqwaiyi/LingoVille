import { z } from 'zod';

/** A Live API parameter schema (the OpenAPI subset Gemini accepts). */
export type ToolSchema = {
  type: 'OBJECT' | 'ARRAY' | 'STRING' | 'INTEGER' | 'NUMBER' | 'BOOLEAN';
  description?: string;
  enum?: string[];
  properties?: Record<string, ToolSchema>;
  required?: string[];
  items?: ToolSchema;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
};

/** A Live API function declaration. */
export type FunctionDeclaration = {
  name: string;
  description: string;
  parameters: ToolSchema & { type: 'OBJECT' };
};

type JsonSchema = {
  type?: string;
  description?: string;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
};

const LIVE_TYPES: Record<string, ToolSchema['type']> = {
  object: 'OBJECT',
  array: 'ARRAY',
  string: 'STRING',
  integer: 'INTEGER',
  number: 'NUMBER',
  boolean: 'BOOLEAN',
};

function toToolSchema(json: JsonSchema): ToolSchema {
  const type = json.type && LIVE_TYPES[json.type];
  if (!type) throw new Error(`Live tool declarations can't express this schema: ${JSON.stringify(json)}`);
  const schema: ToolSchema = { type };
  if (json.description !== undefined) schema.description = json.description;
  if (json.enum !== undefined) schema.enum = json.enum.map(String);
  if (json.properties !== undefined) {
    schema.properties = Object.fromEntries(Object.entries(json.properties).map(([key, value]) => [key, toToolSchema(value)]));
  }
  if (json.required !== undefined) schema.required = json.required;
  if (json.items !== undefined) schema.items = toToolSchema(json.items);
  for (const bound of ['minItems', 'maxItems', 'minimum', 'maximum'] as const) {
    if (json[bound] !== undefined) schema[bound] = json[bound];
  }
  return schema;
}

/** Builds a function declaration from the Zod schema that also validates its arguments. */
export function toToolDeclaration(name: string, description: string, args: z.ZodObject): FunctionDeclaration {
  const parameters = toToolSchema(z.toJSONSchema(args, { io: 'input' }) as JsonSchema);
  return { name, description, parameters: { ...parameters, type: 'OBJECT' } };
}
