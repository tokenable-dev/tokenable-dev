import { existsSync } from 'fs';
import { join } from 'path';
import { buildEmailBrandHeaderHtml, resolveMailLogoPath } from './mail-brand.util';

describe('mail-brand.util', () => {
  it('finds the bundled favicon asset', () => {
    const logoPath = resolveMailLogoPath();
    expect(logoPath).toBeTruthy();
    expect(existsSync(logoPath!)).toBe(true);
  });

  it('builds left-aligned icon + wordmark header', () => {
    const html = buildEmailBrandHeaderHtml({
      siteName: 'Tokenable',
      logoCid: 'tokenable-logo@mail',
      theme: 'light',
    });
    expect(html).toContain('cid:tokenable-logo@mail');
    expect(html).toContain('align="left"');
    expect(html).toContain('#111827');
    expect(html).toContain('Tokenable');
  });

  it('resolves dev workspace asset path', () => {
    const devAsset = join(
      process.cwd(),
      'src',
      'assets',
      'mail',
      'tokenable_icon.png',
    );
    expect(existsSync(devAsset)).toBe(true);
  });
});
