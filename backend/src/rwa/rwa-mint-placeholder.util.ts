import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** Bundled via nest-cli `src/assets/**` → `dist/assets/`. Tokenable default slab when PSA/user/Cardhedger art is unavailable. */
export const RWA_MINT_PLACEHOLDER_FILENAME = 'tokenable_mint_placeholder.png';

export function resolveRwaMintPlaceholderPngPath(): string {
  const candidates = [
    join(__dirname, 'assets', RWA_MINT_PLACEHOLDER_FILENAME),
    join(process.cwd(), 'dist', 'assets', RWA_MINT_PLACEHOLDER_FILENAME),
    join(process.cwd(), 'src', 'assets', RWA_MINT_PLACEHOLDER_FILENAME),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `Tokenable mint placeholder missing (${RWA_MINT_PLACEHOLDER_FILENAME}). Expected under dist/assets or src/assets.`,
  );
}

export function readRwaMintPlaceholderPng(): {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
} {
  const path = resolveRwaMintPlaceholderPngPath();
  return {
    buffer: readFileSync(path),
    originalname: RWA_MINT_PLACEHOLDER_FILENAME,
    mimetype: 'image/png',
  };
}
