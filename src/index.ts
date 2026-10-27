export type EnvType = 'string' | 'number' | 'boolean';

export interface FieldDefinition<T = unknown> {
  type: EnvType;
  required?: boolean;
  default?: T;
  choices?: readonly T[];
}

export type SchemaDefinition = Record<string, FieldDefinition>;

type InferType<F extends FieldDefinition> =
  F['type'] extends 'number' ? number
  : F['type'] extends 'boolean' ? boolean
  : string;

type ResolveField<F extends FieldDefinition> =
  F extends { required: true } ? InferType<F>
  : F extends { default: unknown } ? InferType<F>
  : InferType<F> | undefined;

export type InferEnv<S extends SchemaDefinition> = {
  [K in keyof S]: ResolveField<S[K]>;
};

export function envAssert<S extends SchemaDefinition>(
  schema: S,
  source: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
): InferEnv<S> {
  const result: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const [key, spec] of Object.entries(schema)) {
    const raw = source[key];

    // Unset or empty values fall back to default/required handling.
    if (raw === undefined || raw === '') {
      if (spec.default !== undefined) {
        result[key] = spec.default;
      } else if (spec.required) {
        errors.push(`Missing required environment variable: [${key}]`);
      } else {
        result[key] = undefined;
      }
      continue;
    }

    let parsed: unknown;
    if (spec.type === 'number') {
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        errors.push(`Invalid number for environment variable [${key}]: received "${raw}"`);
        continue;
      }
      parsed = num;
    } else if (spec.type === 'boolean') {
      const lower = raw.trim().toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') {
        parsed = true;
      } else if (lower === 'false' || lower === '0' || lower === 'no') {
        parsed = false;
      } else {
        errors.push(`Invalid boolean for environment variable [${key}]: received "${raw}"`);
        continue;
      }
    } else {
      parsed = raw;
    }

    if (spec.choices && !spec.choices.includes(parsed)) {
      errors.push(
        `Value for [${key}] ("${raw}") is not one of allowable choices: [${spec.choices.join(', ')}]`
      );
      continue;
    }

    result[key] = parsed;
  }

  if (errors.length > 0) {
    throw new Error(`[env-assert] Configuration failed:\n - ${errors.join('\n - ')}`);
  }

  return result as InferEnv<S>;
}

export default envAssert;
