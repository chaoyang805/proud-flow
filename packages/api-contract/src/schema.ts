export interface Schema<T> {
  parse(value: unknown): T;
  is(value: unknown): value is T;
  toJsonSchema(): JsonSchema;
}

export type JsonSchema =
  | {
      type: "string";
      enum?: readonly string[];
      minLength?: number;
      pattern?: string;
      format?: string;
    }
  | { type: "number"; minimum?: number }
  | { type: "integer"; minimum?: number }
  | { type: "boolean" }
  | { type: "array"; items: JsonSchema }
  | {
      type: "object";
      required: string[];
      properties: Record<string, JsonSchema>;
      additionalProperties: boolean;
    }
  | { anyOf: JsonSchema[] };

export function stringSchema(
  options: { minLength?: number; pattern?: RegExp; format?: string } = {},
): Schema<string> {
  return createSchema(
    (value): value is string =>
      typeof value === "string" &&
      (options.minLength === undefined || value.length >= options.minLength) &&
      (options.pattern === undefined || options.pattern.test(value)),
    () => ({
      type: "string",
      minLength: options.minLength,
      pattern: options.pattern?.source,
      format: options.format,
    }),
  );
}

export function numberSchema(
  options: { integer?: boolean; minimum?: number } = {},
): Schema<number> {
  return createSchema(
    (value): value is number =>
      typeof value === "number" &&
      Number.isFinite(value) &&
      (!options.integer || Number.isInteger(value)) &&
      (options.minimum === undefined || value >= options.minimum),
    () => ({
      type: options.integer ? "integer" : "number",
      minimum: options.minimum,
    }),
  );
}

export function booleanSchema(): Schema<boolean> {
  return createSchema(
    (value): value is boolean => typeof value === "boolean",
    () => ({ type: "boolean" }),
  );
}

export function enumSchema<const T extends readonly string[]>(
  values: T,
): Schema<T[number]> {
  return createSchema(
    (value): value is T[number] =>
      typeof value === "string" && values.includes(value),
    () => ({ type: "string", enum: values }),
  );
}

export function optionalSchema<T>(schema: Schema<T>): Schema<T | undefined> {
  return {
    parse(value) {
      if (value === undefined) return undefined;
      return schema.parse(value);
    },
    is(value): value is T | undefined {
      return value === undefined || schema.is(value);
    },
    toJsonSchema() {
      return schema.toJsonSchema();
    },
  };
}

export function arraySchema<T>(schema: Schema<T>): Schema<T[]> {
  return createSchema(
    (value): value is T[] =>
      Array.isArray(value) && value.every((item) => schema.is(item)),
    () => ({ type: "array", items: schema.toJsonSchema() }),
  );
}

export function objectSchema<T extends Record<string, unknown>>(properties: {
  [K in keyof T]: Schema<T[K]>;
}): Schema<T> {
  return {
    parse(value) {
      if (!this.is(value)) {
        throw new Error("Value does not match object schema");
      }
      return value;
    },
    is(value): value is T {
      if (typeof value !== "object" || value === null || Array.isArray(value))
        return false;
      const record = value as Record<string, unknown>;
      return Object.entries(properties).every(([key, schema]) =>
        schema.is(record[key]),
      );
    },
    toJsonSchema() {
      const jsonProperties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [key, schema] of Object.entries(properties)) {
        jsonProperties[key] = schema.toJsonSchema();
        if (!schema.is(undefined)) required.push(key);
      }
      return {
        type: "object",
        required,
        properties: jsonProperties,
        additionalProperties: false,
      };
    },
  };
}

export function unionSchema<T>(schemas: readonly Schema<T>[]): Schema<T> {
  return createSchema(
    (value): value is T => schemas.some((schema) => schema.is(value)),
    () => ({ anyOf: schemas.map((schema) => schema.toJsonSchema()) }),
  );
}

function createSchema<T>(
  guard: (value: unknown) => value is T,
  jsonSchema: () => JsonSchema,
): Schema<T> {
  return {
    parse(value) {
      if (!guard(value)) {
        throw new Error("Value does not match schema");
      }
      return value;
    },
    is: guard,
    toJsonSchema: jsonSchema,
  };
}
