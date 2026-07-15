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

export function verifySumsubWebhookDigest(params: {
  secret: string;
  rawBody: Buffer | string;
  digestHeader: string | undefined;
}): boolean {
  const provided = params.digestHeader?.trim();
  if (!provided || !params.secret) return false;

  const expected = createHmac('sha256', params.secret)
    .update(params.rawBody)
    .digest('hex');

  const providedHex = provided.toLowerCase().startsWith('sha256=')
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
