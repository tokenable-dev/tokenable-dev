import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SCRYPT_PREFIX = 'scrypt';
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN);
  return `${SCRYPT_PREFIX}:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored?.startsWith(`${SCRYPT_PREFIX}:`)) return false;
  const parts = stored.split(':');
  if (parts.length !== 3) return false;
  const [, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== KEY_LEN) return false;
  const actual = scryptSync(password, salt, KEY_LEN);
  return timingSafeEqual(expected, actual);
}
