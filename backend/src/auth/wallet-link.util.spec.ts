import { getAddress, verifyMessage } from 'ethers';
import {
  assertWalletLinkSignature,
  buildWalletLinkMessage,
} from './wallet-link.util';

describe('wallet-link.util', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const nonce = 'abc123';
  const issuedAt = '2026-01-01T00:00:00.000Z';

  it('builds a stable link message', () => {
    const message = buildWalletLinkMessage({ userId, nonce, issuedAt });
    expect(message).toContain(userId);
    expect(message).toContain(nonce);
    expect(message).toContain(issuedAt);
  });

  it('accepts a valid signature for the address', () => {
    const privateKey =
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const { Wallet } = require('ethers') as typeof import('ethers');
    const wallet = new Wallet(privateKey);
    const message = buildWalletLinkMessage({ userId, nonce, issuedAt });
    const signature = wallet.signMessageSync(message);
    expect(() =>
      assertWalletLinkSignature(message, signature, wallet.address),
    ).not.toThrow();
    expect(getAddress(verifyMessage(message, signature))).toBe(
      getAddress(wallet.address),
    );
  });
});
