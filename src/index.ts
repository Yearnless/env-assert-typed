export type FieldDefinition =
  | { type: 'number'; required?: boolean; default?: number; choices?: readonly number[]; transform?: (value: number) => number }
  | { type: 'boolean'; required?: boolean; default?: boolean; choices?: readonly boolean[]; transform?: (value: boolean) => boolean }
  | { type: 'string'; required?: boolean; default?: string; choices?: readonly string[]; transform?: (value: string) => string };

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
    if ('default' in spec && spec.default === undefined) {
      errors.push(`Invalid schema for [${key}]: default must not be undefined; omit the key instead`);
      continue;
    }

    const raw = source[key];

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

    if (spec.type === 'number') {
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        errors.push(`Invalid number for environment variable [${key}]: received "${raw}"`);
        continue;
      }
      if (spec.choices && !spec.choices.includes(num)) {
        errors.push(`Value for [${key}] ("${raw}") is not one of allowable choices: [${spec.choices.join(', ')}]`);
        continue;
      }
      if (spec.transform !== undefined) {
        result[key] = spec.transform(num);
      } else {
        result[key] = num;
      }
    } else if (spec.type === 'boolean') {
      const lower = raw.trim().toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') {
        if (spec.choices && !spec.choices.includes(true)) {
          errors.push(`Value for [${key}] ("${raw}") is not one of allowable choices: [${spec.choices.join(', ')}]`);
          continue;
        }
        if (spec.transform !== undefined) {
          result[key] = spec.transform(true);
        } else {
          result[key] = true;
        }
      } else if (lower === 'false' || lower === '0' || lower === 'no') {
        if (spec.choices && !spec.choices.includes(false)) {
          errors.push(`Value for [${key}] ("${raw}") is not one of allowable choices: [${spec.choices.join(', ')}]`);
          continue;
        }
        if (spec.transform !== undefined) {
          result[key] = spec.transform(false);
        } else {
          result[key] = false;
        }
      } else {
        errors.push(`Invalid boolean for environment variable [${key}]: received "${raw}"`);
        continue;
      }
    } else {
      if (spec.choices && !spec.choices.includes(raw)) {
        errors.push(`Value for [${key}] ("${raw}") is not one of allowable choices: [${spec.choices.join(', ')}]`);
        continue;
      }
      if (spec.transform !== undefined) {
        result[key] = spec.transform(raw);
      } else {
        result[key] = raw;
      }
    }
  }

  if (errors.length > 0) {
    throw new EnvAssertError(errors);
  }

  return result as InferEnv<S>;
}

export default envAssert;