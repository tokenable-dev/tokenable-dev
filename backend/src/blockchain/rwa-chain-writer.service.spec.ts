import { ConfigService } from '@nestjs/config';
import { RwaChainWriterService } from './rwa-chain-writer.service';
import type { ChainConfigService } from './chain-config.service';

/** Well-known hardhat test key #0 — never used on a real network. */
const TEST_PK =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_PK_2 =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

function makeService(): RwaChainWriterService {
  const ownerIndex = {
    recordOwner: jest.fn().mockResolvedValue(undefined),
    recordBurn: jest.fn().mockResolvedValue(undefined),
  };
  return new RwaChainWriterService(
    new ConfigService({}),
    {} as ChainConfigService,
    ownerIndex as never,
  );
}

type WithSignerLock = (
  chainId: number,
  privateKey: string,
  fn: () => Promise<unknown>,
) => Promise<unknown>;

function signerLock(service: RwaChainWriterService): WithSignerLock {
  return (
    service as unknown as { withSignerLock: WithSignerLock }
  ).withSignerLock.bind(service);
}

describe('RwaChainWriterService.withSignerLock', () => {
  it('serializes concurrent writes for the same signer + chain', async () => {
    const lock = signerLock(makeService());
    const order: string[] = [];

    const first = lock(1, TEST_PK, async () => {
      order.push('first:start');
      await new Promise((r) => setTimeout(r, 30));
      order.push('first:end');
    });
    const second = lock(1, TEST_PK, async () => {
      order.push('second:start');
      order.push('second:end');
    });

    await Promise.all([first, second]);
    expect(order).toEqual([
      'first:start',
      'first:end',
      'second:start',
      'second:end',
    ]);
  });

  it('continues the chain after a failed write', async () => {
    const lock = signerLock(makeService());

    await expect(
      lock(1, TEST_PK, () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    await expect(lock(1, TEST_PK, () => Promise.resolve('ok'))).resolves.toBe(
      'ok',
    );
  });

  it('does not serialize different signers or chains', async () => {
    const lock = signerLock(makeService());
    const order: string[] = [];

    let releaseFirst!: () => void;
    const gate = new Promise<void>((r) => (releaseFirst = r));

    const slowSameSigner = lock(1, TEST_PK, async () => {
      order.push('chain1-signer1:start');
      await gate;
      order.push('chain1-signer1:end');
    });
    // Different chain and different signer — both should run without waiting.
    const otherChain = lock(2, TEST_PK, async () => {
      order.push('chain2-signer1');
    });
    const otherSigner = lock(1, TEST_PK_2, async () => {
      order.push('chain1-signer2');
    });

    await Promise.all([otherChain, otherSigner]);
    expect(order).toContain('chain2-signer1');
    expect(order).toContain('chain1-signer2');
    expect(order).not.toContain('chain1-signer1:end');

    releaseFirst();
    await slowSameSigner;
    expect(order[order.length - 1]).toBe('chain1-signer1:end');
  });
});
