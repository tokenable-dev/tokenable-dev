import {
  isRpcRateLimitError,
  withRpcRateLimitRetry,
} from './rpc-retry.util';

describe('rpc-retry.util', () => {
  it('detects Alchemy 429 payloads', () => {
    expect(
      isRpcRateLimitError({
        code: 'CALL_EXCEPTION',
        info: {
          error: {
            code: 429,
            message: 'compute units per second capacity',
          },
        },
      }),
    ).toBe(true);
  });

  it('retries rate-limited RPC calls', async () => {
    let attempts = 0;
    const result = await withRpcRateLimitRetry(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw { info: { error: { code: 429, message: 'rate limit' } } };
        }
        return 42;
      },
      { maxRetries: 3 },
    );
    expect(result).toBe(42);
    expect(attempts).toBe(2);
  });
});
