import { randomBytes } from 'crypto';
import {
  decryptPartnerPrivateKey,
  encryptPartnerPrivateKey,
} from './partner-wallet-crypto.util';

describe('partner-wallet-crypto.util', () => {
  const master = randomBytes(32).toString('hex');
  const pk =
    '0x' + 'a'.repeat(64);

  it('round-trips encrypt/decrypt', () => {
    const blob = encryptPartnerPrivateKey(pk, master);
    expect(blob.startsWith('v1:')).toBe(true);
    expect(decryptPartnerPrivateKey(blob, master)).toBe(pk.toLowerCase());
  });

  it('accepts key without 0x prefix', () => {
    const blob = encryptPartnerPrivateKey('b'.repeat(64), master);
    expect(decryptPartnerPrivateKey(blob, master)).toBe('0x' + 'b'.repeat(64));
  });

  it('fails with wrong master key', () => {
    const blob = encryptPartnerPrivateKey(pk, master);
    const other = randomBytes(32).toString('hex');
    expect(() => decryptPartnerPrivateKey(blob, other)).toThrow();
  });

  it('rejects invalid master key length', () => {
    expect(() => encryptPartnerPrivateKey(pk, 'abcd')).toThrow(
      /PARTNER_WALLET_ENCRYPTION_KEY/,
    );
  });
});
