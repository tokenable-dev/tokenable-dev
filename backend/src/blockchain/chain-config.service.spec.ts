import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChainConfigService } from './chain-config.service';

describe('ChainConfigService.requireChainId', () => {
  function makeService(env: Record<string, string> = {}): ChainConfigService {
    return new ChainConfigService(
      new ConfigService({
        DEFAULT_CHAIN_ID: '11155111',
        CHAIN_11155111_RPC_URL: 'https://rpc.sepolia.org',
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
});
