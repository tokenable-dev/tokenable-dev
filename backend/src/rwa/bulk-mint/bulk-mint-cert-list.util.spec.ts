import {
  BULK_MINT_MAX_ITEMS,
  normalizeBulkMintCert,
  normalizeBulkMintPrice,
  parseCertPriceRowsFromCsvText,
  parseCertPriceRowsFromUpload,
} from './bulk-mint-cert-list.util';

describe('bulk-mint-cert-list.util', () => {
  it('normalizes digit certs', () => {
    expect(normalizeBulkMintCert('83179580')).toBe('83179580');
    expect(normalizeBulkMintCert('PSA 8317-9580')).toBe('83179580');
    expect(normalizeBulkMintCert('123')).toBeNull();
  });

  it('normalizes prices', () => {
    expect(normalizeBulkMintPrice('1250')).toBe('1250');
    expect(normalizeBulkMintPrice('$1,250.50')).toBe('1250.50');
    expect(normalizeBulkMintPrice('0')).toBeNull();
    expect(normalizeBulkMintPrice('-5')).toBeNull();
  });

  it('parses CSV with cert + price headers', () => {
    const text = 'certNumber,price\n83179580,1250\n84956785,980.5\n83179580,1\n';
    expect(parseCertPriceRowsFromCsvText(text)).toEqual([
      { certNumber: '83179580', priceUsdc: '1250' },
      { certNumber: '84956785', priceUsdc: '980.5' },
    ]);
  });

  it('parses rows without header (col0 cert, col1 price)', () => {
    expect(parseCertPriceRowsFromCsvText('83179580,100\n84956785,200\n')).toEqual([
      { certNumber: '83179580', priceUsdc: '100' },
      { certNumber: '84956785', priceUsdc: '200' },
    ]);
  });

  it('parses JSON items via upload helper', () => {
    const out = parseCertPriceRowsFromUpload({
      items: [
        { certNumber: '83179580', price: '10' },
        { certNumber: 'bad', price: '10' },
        { certNumber: '84956785', price: '20' },
      ],
    });
    expect(out).toEqual([
      { certNumber: '83179580', priceUsdc: '10' },
      { certNumber: '84956785', priceUsdc: '20' },
    ]);
  });

  it('exposes max items constant', () => {
    expect(BULK_MINT_MAX_ITEMS).toBe(500);
  });
});
