// Compile-time proof that envAssert infers correct types.
// Verified by `npm run typecheck` (tsc --noEmit). Excluded from the build.
import { envAssert } from './index.js';

const env = envAssert(
  {
    PORT: { type: 'number', required: true },
    HOST: { type: 'string', default: '0.0.0.0' },
    DEBUG: { type: 'boolean' },
    REGION: { type: 'string', required: true, choices: ['us', 'eu'] },
  },
  { PORT: '8080', REGION: 'us' }
);

// required => always present
const port: number = env.PORT;
// default => always present
const host: string = env.HOST;
// optional without default => may be undefined
const debug: boolean | undefined = env.DEBUG;
// string type (choices do not narrow; they validate at runtime)
const region: string = env.REGION;

// @ts-expect-error PORT is always a number, not a string
const portAsString: string = env.PORT;
// @ts-expect-error DEBUG may be undefined
const debugAsBoolean: boolean = env.DEBUG;
// @ts-expect-error HOST is always defined
const hostAsUndefined: undefined = env.HOST;

void portAsString;
void debugAsBoolean;
void hostAsUndefined;
