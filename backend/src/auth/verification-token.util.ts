import { createHash, randomBytes } from 'crypto';

const RAW_TOKEN_BYTES = 32;

export function generateVerificationRawToken(): string {
  return randomBytes(RAW_TOKEN_BYTES).toString('hex');
}

export function hashVerificationToken(rawToken: string): string {
  return createHash('sha256').update(rawToken.trim()).digest('hex');
}

export function isValidRawVerificationToken(raw: string | undefined): boolean {
  const token = raw?.trim() ?? '';
  return token.length >= RAW_TOKEN_BYTES * 2;
}
