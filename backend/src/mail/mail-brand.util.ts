import { existsSync } from 'fs';
import { join } from 'path';

/** Content-ID for inline logo attachment (no external image URL). */
export const MAIL_LOGO_CID = 'tokenable-logo@mail';

export function resolveMailLogoPath(): string | null {
  const candidates = [
    join(__dirname, '..', 'assets', 'mail', 'tokenable_icon.png'),
    join(process.cwd(), 'dist', 'assets', 'mail', 'tokenable_icon.png'),
    join(process.cwd(), 'src', 'assets', 'mail', 'tokenable_icon.png'),
    join(
      process.cwd(),
      '..',
      'frontend',
      'public',
      'assets',
      'icons',
      'tokenable_icon.png',
    ),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}
