import { inferExternalSalePlatform } from './cardhedger-sale-platform.util';

describe('inferExternalSalePlatform', () => {
  it('maps eBay sold listing URLs', () => {
    expect(
      inferExternalSalePlatform({
        saleUrl: 'https://www.ebay.com/itm/123456?hash=abc',
        priceSource: 'marketplace',
      }),
    ).toBe('eBay');
  });

  it('maps COMC and PWCC hosts', () => {
    expect(
      inferExternalSalePlatform({
        saleUrl: 'https://www.comc.com/Cards/Baseball/123',
      }),
    ).toBe('COMC');
    expect(
      inferExternalSalePlatform({
        saleUrl: 'https://www.pwccmarketplace.com/items/999',
      }),
    ).toBe('PWCC');
  });

  it('falls back to price_source when url is missing', () => {
    expect(
      inferExternalSalePlatform({
        priceSource: 'ebay',
      }),
    ).toBe('eBay');
  });

  it('returns null for generic marketplace without url', () => {
    expect(
      inferExternalSalePlatform({
        priceSource: 'marketplace',
      }),
    ).toBeNull();
  });
});
