import { describe, it, expect } from 'vitest';
import { envAssert, EnvAssertError } from './index.js';

describe('envAssert', () => {
  it('parses and coerces valid strings, numbers, and booleans', () => {
    const env = envAssert(
      {
        PORT: { type: 'number', required: true },
        ENABLE_LOGS: { type: 'boolean', required: true },
        APP_NAME: { type: 'string', required: true },
      },
      { PORT: '8080', ENABLE_LOGS: 'true', APP_NAME: 'ProductionCore' }
    );

    expect(env.PORT).toBe(8080);
    expect(env.ENABLE_LOGS).toBe(true);
    expect(env.APP_NAME).toBe('ProductionCore');
  });

  it('accepts case-insensitive boolean spellings', () => {
    const env = envAssert(
      {
        A: { type: 'boolean', required: true },
        B: { type: 'boolean', required: true },
        C: { type: 'boolean', required: true },
      },
      { A: 'YES', B: ' No ', C: '0' }
    );

    expect(env.A).toBe(true);
    expect(env.B).toBe(false);
    expect(env.C).toBe(false);
  });

  it('applies default values when variables are unset', () => {
    const env = envAssert(
      {
        HOST: { type: 'string', default: '0.0.0.0' },
        RETRIES: { type: 'number', default: 5 },
      },
      {}
    );

    expect(env.HOST).toBe('0.0.0.0');
    expect(env.RETRIES).toBe(5);
  });

  it('treats empty strings as unset', () => {
    const env = envAssert({ HOST: { type: 'string', default: 'fallback' } }, { HOST: '' });
    expect(env.HOST).toBe('fallback');
  });

  it('treats whitespace-only values as unset', () => {
    const env = envAssert(
      { PORT: { type: 'number', default: 8080 }, FLAG: { type: 'boolean', default: false } },
      { PORT: '   ', FLAG: '\t' }
    );
    expect(env.PORT).toBe(8080);
    expect(env.FLAG).toBe(false);
  });

  it('leaves optional variables undefined when unset and not defaulted', () => {
    const env = envAssert({ OPTIONAL: { type: 'string' } }, {});
    expect(env.OPTIONAL).toBeUndefined();
  });

  it('enforces choices', () => {
    const env = envAssert(
      { NODE_ENV: { type: 'string', required: true, choices: ['development', 'production'] } },
      { NODE_ENV: 'production' }
    );
    expect(env.NODE_ENV).toBe('production');

    expect(() =>
      envAssert(
        { NODE_ENV: { type: 'string', required: true, choices: ['development', 'production'] } },
        { NODE_ENV: 'staging' }
      )
    ).toThrow(/Value for \[NODE_ENV\] \("staging"\) is not one of allowable choices/);
  });

  it('rejects default: undefined as a schema error', () => {
    expect(() => envAssert({ X: { type: 'string', default: undefined } }, {})).toThrow(
      /Invalid schema for \[X\]/
    );
  });

  it('throws EnvAssertError with every failure enumerable', () => {
    const bad = () =>
      envAssert(
        {
          SECRET_KEY: { type: 'string', required: true },
          RETRIES: { type: 'number', required: true },
        },
        { RETRIES: 'not_a_number' }
      );

    expect(bad).toThrow(EnvAssertError);
    try {
      bad();
    } catch (err) {
      if (!(err instanceof EnvAssertError)) throw new TypeError('expected EnvAssertError');
      expect(err.name).toBe('EnvAssertError');
      expect(err.errors).toEqual([
        'Missing required environment variable: [SECRET_KEY]',
        'Invalid number for environment variable [RETRIES]: received "not_a_number"',
      ]);
      expect(err.message).toContain('Configuration failed');
    }
  });

  it('rejects non-finite numbers', () => {
    expect(() =>
      envAssert({ LIMIT: { type: 'number', required: true } }, { LIMIT: 'Infinity' })
    ).toThrow(/Invalid number.*LIMIT/);
  });

  it('rejects invalid booleans', () => {
    expect(() =>
      envAssert({ FLAG: { type: 'boolean', required: true } }, { FLAG: 'maybe' })
    ).toThrow(/Invalid boolean.*FLAG/);
  });

  it('reads process.env when no source is given', () => {
    process.env.ENV_ASSERT_TYPED_TEST = '42';
    try {
      const env = envAssert({ ENV_ASSERT_TYPED_TEST: { type: 'number', required: true } });
      expect(env.ENV_ASSERT_TYPED_TEST).toBe(42);
    } finally {
      delete process.env.ENV_ASSERT_TYPED_TEST;
    }
  });
});
