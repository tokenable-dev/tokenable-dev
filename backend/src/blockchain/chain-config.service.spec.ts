import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AbstractProvider, FeeData, parseUnits } from 'ethers';
import {
  ChainConfigService,
  MIN_PRIORITY_FEE_WEI,
  withMinPriorityFee,
} from './chain-config.service';

describe('withMinPriorityFee', () => {
  function providerWithFee(fee: FeeData): AbstractProvider {
    return withMinPriorityFee({
      getFeeData: async () => fee,
    } as unknown as AbstractProvider);
  }

  it('raises a zero tip (Alchemy mainnet) to the floor and keeps base headroom', async () => {
    const base = parseUnits('0.1', 'gwei');
    const fee = await providerWithFee(new FeeData(base, base * 2n, 0n)).getFeeData();
    expect(fee.maxPriorityFeePerGas).toBe(MIN_PRIORITY_FEE_WEI);
    expect(fee.maxFeePerGas).toBe(base * 2n + MIN_PRIORITY_FEE_WEI);
  });

  it('keeps a tip already above the floor (Polygon)', async () => {
    const tip = parseUnits('30', 'gwei');
    const original = new FeeData(null, parseUnits('100', 'gwei'), tip);
    const fee = await providerWithFee(original).getFeeData();
    expect(fee).toBe(original);
  });
});

describe('ChainConfigService.requireChainId', () => {
  function makeService(env: Record<string, string> = {}): ChainConfigService {
    return new ChainConfigService(
      new ConfigService({
        DEFAULT_CHAIN_ID: '11155111',
        CHAIN_11155111_RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com',
        CHAIN_11155111_RWA_ADDRESS: '0x11117C44584dE2912689b62ddEE85ACa3dA17c28',
        CHAIN_137_RPC_URL: 'https://polygon-rpc.com',
        CHAIN_137_RWA_ADDRESS: '0x30D41cC4Efa7F1d5cAFE721Eba5743D9B8e5b96E',
        ...env,
      }),
    );
  }

  it('rejects a missing header instead of falling back to DEFAULT_CHAIN_ID', () => {
    expect(() => makeService().requireChainId(undefined)).toThrow(
      BadRequestException,
    );
    expect(() => makeService().requireChainId('')).toThrow(BadRequestException);
  });

  it('rejects an unsupported chain id', () => {
    expect(() => makeService().requireChainId('999')).toThrow(BadRequestException);
  });

  it('accepts a configured Polygon chain id (must not become Sepolia)', () => {
    expect(makeService().requireChainId('137')).toBe(137);
  });

  it('rejects a supported but unconfigured chain', () => {
    const svc = makeService({
      CHAIN_137_RPC_URL: '',
      CHAIN_137_RWA_ADDRESS: '',
    });
    expect(() => svc.requireChainId('137')).toThrow(BadRequestException);
  });

  it('resolveChainId still falls back for read paths', () => {
    expect(makeService().resolveChainId(undefined)).toBe(11155111);
    expect(makeService().resolveChainId('137')).toBe(137);
  });

  it('reuses one provider per chain', () => {
    const svc = makeService();
    expect(svc.createJsonRpcProvider(11155111)).toBe(
      svc.createJsonRpcProvider(11155111),
    );
    svc.onModuleDestroy();
  });

  it('puts env Alchemy URL first, then public fallbacks', () => {
    const svc = makeService({
      CHAIN_11155111_RPC_URL:
        'https://eth-sepolia.g.alchemy.com/v2/test-key',
    });
    const urls = svc.getRpcUrls(11155111);
    expect(urls[0]).toBe('https://eth-sepolia.g.alchemy.com/v2/test-key');
    expect(urls).toContain('https://ethereum-sepolia-rpc.publicnode.com');
    expect(urls.length).toBeGreaterThan(1);
    svc.onModuleDestroy();
  });

  it('uses quorum 1 so a single healthy RPC is enough (failover, not consensus)', () => {
    const svc = makeService({
      CHAIN_11155111_RPC_URL:
        'https://eth-sepolia.g.alchemy.com/v2/test-key',
    });
    const provider = svc.createJsonRpcProvider(11155111) as { quorum?: number };
    expect(provider.quorum).toBe(1);
    svc.onModuleDestroy();
  });
});