export type FieldDefinition =
  | { type: 'number'; required?: boolean; default?: number; choices?: readonly number[] }
  | { type: 'boolean'; required?: boolean; default?: boolean; choices?: readonly boolean[] }
  | { type: 'string'; required?: boolean; default?: string; choices?: readonly string[] };

export type SchemaDefinition = Record<string, FieldDefinition>;

type InferType<F extends FieldDefinition> =
  F['type'] extends 'number' ? number
  : F['type'] extends 'boolean' ? boolean
  : string;

/**
 * `required: true` (written as a literal) makes the field always present;
 * a `default` makes it always present; otherwise the field is `T | undefined`.
 */
type ResolveField<F extends FieldDefinition> =
  F extends { required: true } ? InferType<F>
  : F extends { default: unknown } ? InferType<F>
  : InferType<F> | undefined;

export type InferEnv<S extends SchemaDefinition> = {
  [K in keyof S]: ResolveField<S[K]>;
};

/** Aggregate of every schema violation, thrown by `envAssert`. `errors` lists each failure. */
export class EnvAssertError extends Error {
  readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`[env-assert] Configuration failed:\n - ${errors.join('\n - ')}`);
    this.name = 'EnvAssertError';
    this.errors = errors;
  }
}

export function envAssert<S extends SchemaDefinition>(
  schema: S,
  source: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
): InferEnv<S> {
  const result: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const [key, spec] of Object.entries(schema)) {
    // `default: undefined` splits the inferred type (present) from runtime
    // (absent). Reject it so the contract stays honest.
    if ('default' in spec && spec.default === undefined) {
      errors.push(`Invalid schema for [${key}]: default must not be undefined; omit the key instead`);
      continue;
    }

    const raw = source[key];

    // Unset or whitespace-only values fall back to default/required handling.
    if (raw === undefined || raw.trim() === '') {
      if ('default' in spec) {
        result[key] = spec.default;
      } else if (spec.required) {
        errors.push(`Missing required environment variable: [${key}]`);
      } else {
        result[key] = undefined;
      }
      continue;
    }

    let parsed: string | number | boolean;
    let choices: readonly (string | number | boolean)[] | undefined;

    if (spec.type === 'number') {
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        errors.push(`Invalid number for environment variable [${key}]: received "${raw}"`);
        continue;
      }
      parsed = num;
      choices = spec.choices;
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
      choices = spec.choices;
    } else {
      parsed = raw;
      choices = spec.choices;
    }

    if (choices !== undefined && !choices.includes(parsed)) {
      errors.push(`Value for [${key}] ("${raw}") is not one of allowable choices: [${choices.join(', ')}]`);
      continue;
    }

    result[key] = parsed;
  }

  if (errors.length > 0) {
    throw new EnvAssertError(errors);
  }

  return result as InferEnv<S>;
}

export default envAssert;
