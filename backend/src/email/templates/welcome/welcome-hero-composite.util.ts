import { existsSync, readFileSync } from 'fs';
import sharp from 'sharp';
import { resolveRepoPublicPath } from '../../repo-public-assets.util';

const HERO_W = 600;
const HERO_H = 330;
const PAD = 30;

function readAsset(...segments: string[]): Buffer {
  const filePath =
    resolveRepoPublicPath('frontend', 'public', ...segments) ??
    resolveRepoPublicPath('public', ...segments);
  if (!filePath) {
    throw new Error(
      `Email asset not found (expected frontend/public/${segments.join('/')})`,
    );
  }
  return readFileSync(filePath);
}

function heroCopyOverlaySvg(): Buffer {
  const tagline =
    'The safest and fastest way to trade collectibles.';
  return Buffer.from(
    `<svg width="${HERO_W}" height="${HERO_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="45%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.72"/>
    </linearGradient>
  </defs>
  <rect width="${HERO_W}" height="${HERO_H}" fill="url(#heroFade)"/>
  <text x="${PAD}" y="258" fill="#FFFFFF" font-family="Inter,Arial,Helvetica,sans-serif" font-size="38" font-weight="800" letter-spacing="-1">Welcome</text>
  <text x="${PAD}" y="288" fill="rgba(255,255,255,0.80)" font-family="Inter,Arial,Helvetica,sans-serif" font-size="15" font-weight="400">${tagline}</text>
</svg>`,
    'utf8',
  );
}

/** Single 600×330 PNG: vault photo + wordmark + Welcome copy (Gmail-safe). */
export async function buildWelcomeHeroCompositePng(): Promise<Buffer> {
  const hero = readAsset('assets', 'email', 'welcome-hero.png');
  const wordmark = readAsset('assets', 'email', 'welcome-wordmark.png');

  return sharp(hero)
    .resize(HERO_W, HERO_H, { fit: 'cover', position: 'centre' })
    .composite([
      { input: heroCopyOverlaySvg(), top: 0, left: 0 },
      { input: wordmark, top: PAD, left: PAD },
    ])
    .png()
    .toBuffer();
}

export function welcomeHeroCompositePublicPath(): string | null {
  return (
    resolveRepoPublicPath(
      'frontend',
      'public',
      'assets',
      'email',
      'welcome-hero-composite.png',
    ) ??
    resolveRepoPublicPath(
      'public',
      'assets',
      'email',
      'welcome-hero-composite.png',
    )
  );
}

export function tryReadWelcomeHeroCompositeFile(): Buffer | null {
  const p = welcomeHeroCompositePublicPath();
  if (!p || !existsSync(p)) return null;
  return readFileSync(p);
}
