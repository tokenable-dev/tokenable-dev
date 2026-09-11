import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

const PREFIX = 'v1';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

/**
 * Encrypt a partner wallet private key with AES-256-GCM.
 * Blob format: `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`
 */
export function encryptPartnerPrivateKey(
  plaintextKey: string,
  masterKeyHex: string,
): string {
  const key = parseMasterKey(masterKeyHex);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const normalized = normalizePrivateKeyInput(plaintextKey);
  const ciphertext = Buffer.concat([
    cipher.update(normalized, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function decryptPartnerPrivateKey(
  blob: string,
  masterKeyHex: string,
): string {
  const key = parseMasterKey(masterKeyHex);
  const parts = blob.split(':');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error('Invalid encrypted private key blob');
  }
  const iv = Buffer.from(parts[1]!, 'base64');
  const tag = Buffer.from(parts[2]!, 'base64');
  const ciphertext = Buffer.from(parts[3]!, 'base64');
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error('Invalid encrypted private key blob lengths');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
  return normalizePrivateKeyInput(plaintext);
}

function parseMasterKey(hex: string): Buffer {
  const raw = String(hex ?? '').trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(
      'PARTNER_WALLET_ENCRYPTION_KEY must be 32 bytes as 64 hex characters',
    );
  }
  const buf = Buffer.from(raw, 'hex');
  if (buf.length !== KEY_LEN) {
    throw new Error('PARTNER_WALLET_ENCRYPTION_KEY must be 32 bytes');
  }
  return buf;
}

function normalizePrivateKeyInput(raw: string): string {
  const key = String(raw ?? '').trim();
  if (!key) throw new Error('Private key is empty');
  const withOx = key.startsWith('0x') ? key : `0x${key}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(withOx)) {
    throw new Error('Private key must be a 32-byte hex string');
  }
  return withOx.toLowerCase();
}

/** Constant-time-ish compare of two master key hex strings (for tests). */
export function masterKeysEqual(a: string, b: string): boolean {
  try {
    const ba = parseMasterKey(a);
    const bb = parseMasterKey(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
