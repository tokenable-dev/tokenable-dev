import {
  deriveRwaSlabS3Prefix,
  isPlatformHostedRwaSlabUrl,
  publicUrlForRwaSlab,
  sanitizeCertForS3Key,
  stableRwaSlabObjectKey,
} from './rwa-slab-s3.util';

describe('rwa-slab-s3.util', () => {
  const base = 'https://cdn.example.com';
  const slabPrefix = 'dev/covers/rwa-slabs/';

  it('derives slab prefix under catalog covers IAM scope', () => {
    expect(deriveRwaSlabS3Prefix('dev/covers/')).toBe('dev/covers/rwa-slabs/');
    expect(deriveRwaSlabS3Prefix('covers')).toBe('covers/rwa-slabs/');
  });

  it('sanitizes cert digits for S3 keys', () => {
    expect(sanitizeCertForS3Key('PSA 84089328')).toBe('84089328');
    expect(sanitizeCertForS3Key('')).toBe('unknown');
  });

  it('builds stable per-chain cert slab keys', () => {
    expect(stableRwaSlabObjectKey(slabPrefix, 84532, '84089328')).toBe(
      'dev/covers/rwa-slabs/84532/84089328/slab',
    );
  });

  it('detects platform-hosted slab URLs', () => {
    const url = publicUrlForRwaSlab(base, slabPrefix, 84532, '84089328');
    expect(
      isPlatformHostedRwaSlabUrl(url, base, slabPrefix, 84532, '84089328'),
    ).toBe(true);
    expect(
      isPlatformHostedRwaSlabUrl(
        `${base}/dev/covers/abc/cover`,
        base,
        slabPrefix,
        84532,
        '84089328',
      ),
    ).toBe(false);
    expect(
      isPlatformHostedRwaSlabUrl(url, base, slabPrefix, 84532, '99999999'),
    ).toBe(false);
  });
});
