import { createHmac } from 'crypto';
import {
  signSumsubRequest,
  verifySumsubWebhookDigest,
} from './sumsub-auth.util';

describe('sumsub-auth.util', () => {
  it('signs requests with ts + method + path + body', () => {
    const { timestamp, signature } = signSumsubRequest({
      secretKey: 'test-secret',
      method: 'POST',
      path: '/resources/accessTokens/sdk',
      body: '{"userId":"u1"}',
      timestampSec: 1700000000,
    });
    expect(timestamp).toBe(1700000000);
    const expected = createHmac('sha256', 'test-secret')
      .update('1700000000POST/resources/accessTokens/sdk{"userId":"u1"}')
      .digest('hex');
    expect(signature).toBe(expected);
  });

  it('verifies webhook digest', () => {
    const secret = 'whsec';
    const rawBody = Buffer.from('{"type":"applicantReviewed"}');
    const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
    expect(
      verifySumsubWebhookDigest({
        secret,
        rawBody,
        digestHeader: digest,
        digestAlgHeader: 'HMAC_SHA256_HEX',
      }),
    ).toBe(true);
    expect(
      verifySumsubWebhookDigest({
        secret,
        rawBody,
        digestHeader: 'bad',
      }),
    ).toBe(false);
  });

  it('verifies sha1 digest when alg header says so', () => {
    const secret = 'whsec';
    const rawBody = Buffer.from('{"type":"applicantPending"}');
    const digest = createHmac('sha1', secret).update(rawBody).digest('hex');
    expect(
      verifySumsubWebhookDigest({
        secret,
        rawBody,
        digestHeader: digest,
        digestAlgHeader: 'HMAC_SHA1_HEX',
      }),
    ).toBe(true);
  });
});
