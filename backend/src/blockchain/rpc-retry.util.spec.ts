import {
  isRpcRateLimitError,
  resetRpcSemaphoreForTests,
  withRpcProviderCall,
  withRpcRateLimitRetry,
} from './rpc-retry.util';

describe('rpc-retry.util', () => {
  afterEach(() => {
    resetRpcSemaphoreForTests();
    delete process.env.RPC_MAX_CONCURRENCY;
  });

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

  it('limits concurrent in-flight RPC calls', async () => {
    process.env.RPC_MAX_CONCURRENCY = '1';
    let inflight = 0;
    let maxSeen = 0;

    const work = (ms: number) =>
      withRpcProviderCall(async () => {
        inflight += 1;
        maxSeen = Math.max(maxSeen, inflight);
        await new Promise((r) => setTimeout(r, ms));
        inflight -= 1;
        return ms;
      });

    await Promise.all([work(30), work(30)]);
    expect(maxSeen).toBe(1);
  });
});
