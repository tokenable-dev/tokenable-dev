import {
  isCardhedgerBrandedPlaceholderUrl,
  isUsableCardhedgerMintImageUrl,
  resolveRemoteMintImageUrl,
} from './rwa-mint-image.util';

describe('rwa-mint-image.util', () => {
  const psaSlab =
    'https://d1htnxwo4o0jhw.cloudfront.net/cert/153256185/small/front.jpg';
  const catalog =
    'https://942284f33c575895b4be9de571ca6e40.cdn.bubble.io/foo/crop_image';
  const chPlaceholder =
    'https://942284f33c575895b4be9de571ca6e40.cdn.bubble.io/cardhedger-default/crop_image';

  it('detects Cardhedger branded placeholder URLs', () => {
    expect(isCardhedgerBrandedPlaceholderUrl(chPlaceholder)).toBe(true);
    expect(isCardhedgerBrandedPlaceholderUrl(catalog)).toBe(false);
  });

  it('accepts real Cardhedger catalog art for mint', () => {
    expect(isUsableCardhedgerMintImageUrl(catalog)).toBe(true);
    expect(isUsableCardhedgerMintImageUrl(chPlaceholder)).toBe(false);
    expect(isUsableCardhedgerMintImageUrl(psaSlab)).toBe(false);
  });

  it('resolves remote mint priority PSA → user → Cardhedger', () => {
    expect(
      resolveRemoteMintImageUrl({
        psaCertSlabUrl: psaSlab,
        userImageUrl: 'https://user.example/slab.jpg',
        cardhedgerImageUrl: catalog,
      }),
    ).toEqual({ url: psaSlab, source: 'psa_cert' });

    expect(
      resolveRemoteMintImageUrl({
        userImageUrl: 'https://user.example/slab.jpg',
        cardhedgerImageUrl: catalog,
      }),
    ).toEqual({
      url: 'https://user.example/slab.jpg',
      source: 'user_upload',
    });

    expect(
      resolveRemoteMintImageUrl({
        cardhedgerImageUrl: catalog,
      }),
    ).toEqual({ url: catalog, source: 'cardhedger_catalog' });

    expect(
      resolveRemoteMintImageUrl({
        userImageUrl: catalog,
      }),
    ).toEqual({ url: catalog, source: 'cardhedger_catalog' });

    expect(
      resolveRemoteMintImageUrl({
        cardhedgerImageUrl: chPlaceholder,
      }),
    ).toEqual({ url: null, source: null });
  });
});
