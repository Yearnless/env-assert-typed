# env-assert-typed

Zero-dependency environment variable parsing and validation with **automatic TypeScript type inference**. Under 1 kB minified + gzipped.

## Why

Schema validators like Zod or Joi are excellent — and cost 15–50 kB of bundle. A serverless worker, Docker entrypoint, or small CLI usually validates three to five variables and shouldn't pay that tax for launch-time-only checks. `env-assert-typed` does exactly that job, statically infers every field's type, and aggregates all failures into one readable error.

```bash
npm install env-assert-typed
```

## Usage

```ts
import { envAssert } from 'env-assert-typed';

const env = envAssert({
  PORT:   { type: 'number', required: true },
  HOST:   { type: 'string', default: '0.0.0.0' },
  DEBUG:  { type: 'boolean' },
  REGION: { type: 'string', required: true, choices: ['us', 'eu'] },
});

const port: number = env.PORT;               // required => always present
const host: string = env.HOST;               // default => always present
const debug: boolean | undefined = env.DEBUG; // optional, no default
```

Types are inferred — no annotations, no casting:

- `required: true` → the value type (`string` / `number` / `boolean`)
- `default` present → the value type
- neither → value type `| undefined`

## Field definition

| Property | Type | Description |
| :--- | :--- | :--- |
| `type` | `'string' \| 'number' \| 'boolean'` | How the raw string is coerced. |
| `required` | `boolean` | Fail if unset. |
| `default` | value | Used when unset **or empty**. Implies presence in the result type. |
| `choices` | `readonly value[]` | Runtime allow-list; the value must be one of these after coercion. |

### Coercion rules

| Type | Accepted input | Result |
| :--- | :--- | :--- |
| `string` | anything | the raw string |
| `number` | anything `Number()` parses as finite | `NaN`/`Infinity`/garbage → error |
| `boolean` | `true`, `1`, `yes`, `false`, `0`, `no` (case-insensitive, whitespace-trimmed) | `true` / `false`; anything else → error |

Empty strings count as unset.

## Errors

Every failure is collected, then thrown as a single aggregate error — fail fast without losing information:

```
[env-assert] Configuration failed:
 - Missing required environment variable: [SECRET_KEY]
 - Invalid number for environment variable [RETRIES]: received "not_a_number"
```

## API

```ts
envAssert(schema, source?)
```

`source` defaults to `process.env` when available (and `{}` in environments without it, e.g. the browser), so tests can pass a plain object.

## License

MIT
