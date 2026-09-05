import {
  deriveUserAvatarS3Prefix,
  isPlatformHostedAvatarUrl,
  stableUserAvatarObjectKey,
} from './catalog-cover-s3.service';

describe('user avatar S3 key helpers', () => {
  it('derives avatar prefix under the covers IAM scope', () => {
    expect(deriveUserAvatarS3Prefix('dev/covers/')).toBe(
      'dev/covers/user-avatars/',
    );
    expect(deriveUserAvatarS3Prefix('covers')).toBe('covers/user-avatars/');
  });

  it('builds a stable per-user key', () => {
    expect(
      stableUserAvatarObjectKey(
        'dev/covers/user-avatars/',
        'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
      ),
    ).toBe(
      'dev/covers/user-avatars/a1b2c3d4-e5f6-7890-abcd-ef1234567890/avatar',
    );
  });

  it('detects platform-hosted avatar URLs', () => {
    const base = 'https://cdn.example.com';
    expect(
      isPlatformHostedAvatarUrl(
        `${base}/dev/covers/user-avatars/u1/avatar?v=1`,
        base,
        'dev/covers/user-avatars/',
      ),
    ).toBe(true);
    expect(
      isPlatformHostedAvatarUrl(
        `${base}/dev/covers/abc/cover`,
        base,
        'dev/covers/user-avatars/',
      ),
    ).toBe(false);
    expect(
      isPlatformHostedAvatarUrl(
        'https://lh3.googleusercontent.com/a/xxx',
        base,
        'dev/covers/user-avatars/',
      ),
    ).toBe(false);
  });
});

