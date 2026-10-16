import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import type { EmailInlineImage } from './types';

/** Resolve paths under monorepo `frontend/public` from Nest cwd (backend/ or image root). */
export function resolveRepoPublicPath(...segments: string[]): string | null {
  const roots = [
    join(process.cwd(), '..'),
    process.cwd(),
    join(process.cwd(), '..', '..'),
  ];
  for (const root of roots) {
    const p = join(root, ...segments);
    if (existsSync(p)) return p;
  }
  return null;
}

export function readRepoPublicAsset(
  publicSegments: string[],
  inline: Omit<EmailInlineImage, 'data'>,
): EmailInlineImage {
  const filePath =
    resolveRepoPublicPath('frontend', 'public', ...publicSegments) ??
    resolveRepoPublicPath('public', ...publicSegments);
  if (!filePath) {
    throw new Error(
      `Email asset not found (expected frontend/public/${publicSegments.join('/')})`,
    );
  }
  return { ...inline, data: readFileSync(filePath) };
}
