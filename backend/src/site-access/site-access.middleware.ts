import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  SITE_ACCESS_COOKIE,
  readSiteAccessConfig,
  verifySiteAccessToken,
} from './site-access.util';
import { isAuthPublicApiPath } from '../auth/auth-oauth.util';

function normalizeRequestPath(path: string): string {
  const base = path.split('?')[0] || '/';
  if (base.startsWith('/api/')) return base;
  if (base.startsWith('/')) return `/api${base}`;
  return `/api/${base}`;
}

@Injectable()
export class SiteAccessMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const cfg = readSiteAccessConfig(process.env);
    if (!cfg.enabled) {
      next();
      return;
    }

    const path = normalizeRequestPath(req.originalUrl ?? req.url ?? '/');
    if (isSiteAccessPublicApiPath(path, req.method)) {
      next();
      return;
    }
    if (isAuthPublicApiPath(path, req.method)) {
      next();
      return;
    }

    const token = req.cookies?.[SITE_ACCESS_COOKIE] as string | undefined;
    if (verifySiteAccessToken(token, cfg.secret)) {
      next();
      return;
    }

    throw new UnauthorizedException({
      statusCode: 401,
      message: 'Site access password required',
      code: 'SITE_ACCESS_REQUIRED',
    });
  }
}

function isSiteAccessPublicApiPath(path: string, method: string): boolean {
  if (path === '/api/site-access/verify' && method.toUpperCase() === 'POST') {
    return true;
  }
  if (path === '/api/health' && method.toUpperCase() === 'GET') {
    return true;
  }
  return false;
}
