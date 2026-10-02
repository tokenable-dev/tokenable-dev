import { existsSync, readFileSync } from 'fs';
import sharp from 'sharp';
import { resolveRepoPublicPath } from '../../repo-public-assets.util';

function arrowSvg(stroke: string): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>`,
    'utf8',
  );
}

export async function buildWelcomeArrowWhitePng(): Promise<Buffer> {
  return sharp(arrowSvg('#FFFFFF')).resize(15, 15).png().toBuffer();
}

export async function buildWelcomeArrowLinkPng(): Promise<Buffer> {
  return sharp(arrowSvg('#8BB4FF')).resize(15, 15).png().toBuffer();
}

function readArrowFile(name: string): Buffer | null {
  const filePath =
    resolveRepoPublicPath('frontend', 'public', 'assets', 'email', name) ??
    resolveRepoPublicPath('public', 'assets', 'email', name);
  if (!filePath || !existsSync(filePath)) return null;
  return readFileSync(filePath);
}

export function tryReadWelcomeArrowWhitePng(): Buffer | null {
  return readArrowFile('welcome-arrow-white.png');
}

export function tryReadWelcomeArrowLinkPng(): Buffer | null {
  return readArrowFile('welcome-arrow-link.png');
}
