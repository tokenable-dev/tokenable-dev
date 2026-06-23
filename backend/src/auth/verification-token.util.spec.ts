import {
  generateVerificationRawToken,
  hashVerificationToken,
  isValidRawVerificationToken,
} from './verification-token.util';

describe('verification-token.util', () => {
  it('generates and hashes tokens', () => {
    const raw = generateVerificationRawToken();
    expect(isValidRawVerificationToken(raw)).toBe(true);
    expect(hashVerificationToken(raw)).toHaveLength(64);
    expect(hashVerificationToken(raw)).toBe(hashVerificationToken(raw));
  });

  it('rejects short raw tokens', () => {
    expect(isValidRawVerificationToken('short')).toBe(false);
    expect(isValidRawVerificationToken(undefined)).toBe(false);
  });
});
