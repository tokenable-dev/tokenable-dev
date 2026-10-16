import { formatMintRpcError } from './mint-rpc-error.util';

describe('formatMintRpcError', () => {
  it('maps minter role revert', () => {
    expect(
      formatMintRpcError({
        shortMessage: 'execution reverted: ERC721PresetMinterPauserAutoId: must have minter role to mint',
      }),
    ).toContain('MINTER_ROLE');
  });

  it('maps RPC rate limit', () => {
    expect(
      formatMintRpcError({ code: 429, message: 'compute units per second' }),
    ).toContain('rate limit');
  });

  it('passes through a shortMessage when unmatched', () => {
    expect(formatMintRpcError({ shortMessage: 'custom provider error' })).toBe(
      'On-chain mint failed: custom provider error',
    );
  });
});
