export type FieldDefinition =
  | { type: 'number'; required?: boolean; default?: number | (() => number); choices?: readonly number[]; transform?: (value: number) => number; coerce?: (value: string) => number; refine?: (value: number, allEnv: Record<string, unknown>) => boolean | string; refineAsync?: (value: number, allEnv: Record<string, unknown>) => Promise<boolean | string>; secret?: boolean }
  | { type: 'boolean'; required?: boolean; default?: boolean | (() => boolean); choices?: readonly boolean[]; transform?: (value: boolean) => boolean; coerce?: (value: string) => boolean; refine?: (value: boolean, allEnv: Record<string, unknown>) => boolean | string; refineAsync?: (value: boolean, allEnv: Record<string, unknown>) => Promise<boolean | string>; secret?: boolean }
  | { type: 'string'; required?: boolean; default?: string | (() => string); choices?: readonly string[]; transform?: (value: string) => string; coerce?: (value: string) => string; refine?: (value: string, allEnv: Record<string, unknown>) => boolean | string; refineAsync?: (value: string, allEnv: Record<string, unknown>) => Promise<boolean | string>; secret?: boolean };

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
    // Reject explicit `default: undefined` as a schema error
    if ('default' in spec && spec.default === undefined) {
      errors.push(`Invalid schema for [${key}]: default must not be undefined; omit the key instead`);
      continue;
    }

    const raw = source[key];
    if (raw === undefined || raw.trim() === '') {
      // Handle default value (including factory functions)
      if (spec.default !== undefined && spec.default !== null) {
        const defaultVal = spec.default;
        result[key] = typeof defaultVal === 'function' ? (defaultVal as () => unknown)() : defaultVal;
      } else if (spec.required) {
        errors.push(`Missing required environment variable: [${key}]`);
      } else {
        result[key] = undefined;
      }
      continue;
    }

    if (spec.type === 'number') {
      let num: number;
      if (spec.coerce !== undefined) {
        try {
          num = spec.coerce(raw);
        } catch (e) {
          errors.push(`Coercion failed for [${key}]: ${e instanceof Error ? e.message : 'Unknown error'}`);
          continue;
        }
      } else {
        num = Number(raw);
      }
      if (!Number.isFinite(num)) {
        errors.push(`Invalid number for environment variable [${key}]: received "${raw}"`);
        continue;
      }
      if (spec.choices && !spec.choices.includes(num)) {
        errors.push(`Value for [${key}] ("${raw}") is not one of allowable choices: [${spec.choices.join(', ')}]`);
        continue;
      }
      if (spec.refine && !spec.refine(num, result)) {
        errors.push(`Validation failed for [${key}]: received ${num}`);
        continue;
      }
      if (spec.refineAsync) {
        errors.push(`Async refinement not supported in sync envAssert; use envAssertAsync for async refinements`);
        continue;
      }
      if (spec.transform !== undefined) {
        num = spec.transform(num);
      }
      result[key] = num;
    } else if (spec.type === 'boolean') {
      const lower = raw.trim().toLowerCase();
      let bool: boolean;
      if (spec.coerce !== undefined) {
        try {
          bool = spec.coerce(raw);
        } catch (e) {
          errors.push(`Coercion failed for [${key}]: ${e instanceof Error ? e.message : 'Unknown error'}`);
          continue;
        }
      } else {
        if (lower === 'true' || lower === '1' || lower === 'yes') bool = true;
        else if (lower === 'false' || lower === '0' || lower === 'no') bool = false;
        else {
          errors.push(`Invalid boolean for environment variable [${key}]: received "${raw}"`);
          continue;
        }
      }
      if (spec.choices && !spec.choices.includes(bool)) {
        errors.push(`Value for [${key}] ("${raw}") is not one of allowable choices: [${spec.choices.join(', ')}]`);
        continue;
      }
      if (spec.refine && !spec.refine(bool, result)) {
        errors.push(`Validation failed for [${key}]: received ${bool}`);
        continue;
      }
      if (spec.transform !== undefined) {
        bool = spec.transform(bool);
      }
      result[key] = bool;
    } else {
      let str: string = raw;
      if (spec.coerce !== undefined) {
        try {
          str = spec.coerce(raw);
        } catch (e) {
          errors.push(`Coercion failed for [${key}]: ${e instanceof Error ? e.message : 'Unknown error'}`);
          continue;
        }
      }
      if (spec.choices && !spec.choices.includes(str)) {
        errors.push(`Value for [${key}] ("${raw}") is not one of allowable choices: [${spec.choices.join(', ')}]`);
        continue;
      }
      if (spec.refine && !spec.refine(str, result)) {
        errors.push(`Validation failed for [${key}]: received ${str}`);
        continue;
      }
      if (spec.transform !== undefined) {
        str = spec.transform(str);
      }
      result[key] = str;
    }
  }

  if (errors.length > 0) {
    throw new EnvAssertError(errors);
  }

  return result as InferEnv<S>;
}

export default envAssert;