import { createHmac, timingSafeEqual } from 'crypto';

export function signSumsubRequest(params: {
  secretKey: string;
  method: string;
  path: string;
  body?: string;
  timestampSec?: number;
}): { timestamp: number; signature: string } {
  const ts = params.timestampSec ?? Math.floor(Date.now() / 1000);
  const body = params.body ?? '';
  const signature = createHmac('sha256', params.secretKey)
    .update(`${ts}${params.method.toUpperCase()}${params.path}${body}`)
    .digest('hex');
  return { timestamp: ts, signature };
}

/** Map Sumsub `X-Payload-Digest-Alg` → Node crypto HMAC algorithm. */
export function resolveSumsubDigestAlgo(
  digestAlgHeader: string | undefined,
): 'sha1' | 'sha256' | 'sha512' {
  const alg = (digestAlgHeader ?? '').trim().toUpperCase();
  if (alg === 'HMAC_SHA1_HEX' || alg === 'SHA1') return 'sha1';
  if (alg === 'HMAC_SHA512_HEX' || alg === 'SHA512') return 'sha512';
  // Default / HMAC_SHA256_HEX / SHA256 / missing
  return 'sha256';
}

export function verifySumsubWebhookDigest(params: {
  secret: string;
  rawBody: Buffer | string;
  digestHeader: string | undefined;
  digestAlgHeader?: string | undefined;
}): boolean {
  const provided = params.digestHeader?.trim();
  if (!provided || !params.secret) return false;

  const nodeAlgo = resolveSumsubDigestAlgo(params.digestAlgHeader);
  const expected = createHmac(nodeAlgo, params.secret)
    .update(params.rawBody)
    .digest('hex');

  const providedHex = provided.toLowerCase().startsWith('sha256=')
    ? provided.slice(7)
    : provided.toLowerCase().startsWith('sha1=')
      ? provided.slice(5)
      : provided.toLowerCase().startsWith('sha512=')
        ? provided.slice(7)
        : provided;

  if (providedHex.length !== expected.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(providedHex, 'hex'),
      Buffer.from(expected, 'hex'),
    );
  } catch {
    return false;
  }
}

/** Try webhook secret first, then app API secret (common Sumsub setup mismatch). */
export function verifySumsubWebhookDigestWithSecrets(params: {
  secrets: Array<string | undefined | null>;
  rawBody: Buffer | string;
  digestHeader: string | undefined;
  digestAlgHeader?: string | undefined;
}): boolean {
  const seen = new Set<string>();
  for (const secret of params.secrets) {
    const s = secret?.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    if (
      verifySumsubWebhookDigest({
        secret: s,
        rawBody: params.rawBody,
        digestHeader: params.digestHeader,
        digestAlgHeader: params.digestAlgHeader,
      })
    ) {
      return true;
    }
  }
  return false;
}
