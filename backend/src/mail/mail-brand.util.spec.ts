import { existsSync } from 'fs';
import { join } from 'path';
import { resolveMailLogoPath } from './mail-brand.util';

describe('resolveMailLogoPath', () => {
  it('finds the bundled favicon asset', () => {
    const logoPath = resolveMailLogoPath();
    expect(logoPath).toBeTruthy();
    expect(existsSync(logoPath!)).toBe(true);
    expect(logoPath!).toContain('tokenable_icon.png');
  });

  it('resolves from src/assets in dev workspace', () => {
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
