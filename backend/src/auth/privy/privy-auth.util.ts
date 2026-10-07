import type { Request } from 'express';

/** Extract Bearer token from Authorization header. */
export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization?.trim();
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() ?? null;
}
