import {
  parsePsaEstimateUsdFromHtml,
  parsePsaEstimateUsdFromJson,
  parsePsaEstimateUsdFromPageText,
} from './psa-cert-estimate-parse.util';

describe('psa-cert-estimate-parse.util', () => {
  it('parses labeled page text', () => {
    const text = `PSA Estimate\n\n$415.00\n\nPSA Population\n58`;
    expect(parsePsaEstimateUsdFromPageText(text)).toBe(415);
  });

  it('parses estimate from JSON payloads', () => {
    expect(
      parsePsaEstimateUsdFromJson({
        cert: { estimateUsd: 415 },
      }),
    ).toBe(415);
    expect(
      parsePsaEstimateUsdFromJson({ EstimateUsd: '$1,250.50' }),
    ).toBe(1250.5);
  });

  it('parses estimate from HTML snippets', () => {
    const html = `
      <div class="estimate">PSA Estimate</div>
      <div class="value">$415.00</div>
      <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"estimateUsd":415}}}</script>
    `;
    expect(parsePsaEstimateUsdFromHtml(html)).toBe(415);
  });
});
