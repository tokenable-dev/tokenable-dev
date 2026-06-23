import { hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  it('hashes and verifies a password', () => {
    const stored = hashPassword('correct-horse-battery');
    expect(stored.startsWith('scrypt:')).toBe(true);
    expect(verifyPassword('correct-horse-battery', stored)).toBe(true);
    expect(verifyPassword('wrong', stored)).toBe(false);
  });

  it('rejects invalid stored values', () => {
    expect(verifyPassword('x', null)).toBe(false);
    expect(verifyPassword('x', 'bcrypt:abc')).toBe(false);
  });
});
