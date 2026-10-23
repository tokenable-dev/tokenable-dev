import {
  deriveRwaSlabS3Prefix,
  isPlatformHostedRwaSlabUrl,
  publicUrlForRwaSlab,
  sanitizeCertForS3Key,
  sealedBoxObjectKey,
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

  it('builds a sealed-box key that is not cert-scoped', () => {
    expect(
      sealedBoxObjectKey(
        'dev/covers/',
        11155111,
        'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
      ),
    ).toBe(
      'dev/covers/rwa-boxes/11155111/a1b2c3d4-e5f6-7890-abcd-ef1234567890/photo',
    );
  });

  it('builds stable per-chain cert slab keys', () => {
    expect(stableRwaSlabObjectKey(slabPrefix, 84532, '84089328')).toBe(
      'dev/covers/rwa-slabs/84532/84089328/slab',
    );
    expect(stableRwaSlabObjectKey(slabPrefix, 84532, '84089328', 'back')).toBe(
      'dev/covers/rwa-slabs/84532/84089328/slab-back',
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
