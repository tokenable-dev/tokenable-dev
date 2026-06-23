import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString, MinLength } from 'class-validator';
import type { Response } from 'express';
import { resolveCookieSecure } from '../auth/auth-session.util';
import {
  SITE_ACCESS_COOKIE,
  issueSiteAccessToken,
  readSiteAccessConfig,
} from './site-access.util';

class VerifySiteAccessDto {
  @IsString()
  @MinLength(1)
  password!: string;
}

@Controller('site-access')
export class SiteAccessController {
  constructor(private readonly config: ConfigService) {}

  @Post('verify')
  @HttpCode(200)
  verify(
    @Body() body: VerifySiteAccessDto,
    @Res({ passthrough: true }) res: Response,
  ): { ok: true; expiresIn: number } {
    const cfg = readSiteAccessConfig(process.env);
    if (!cfg.enabled) {
      return { ok: true, expiresIn: cfg.sessionSeconds };
    }

    const password = (typeof body?.password === 'string' ? body.password : '').trim();
    if (!password || password !== cfg.password) {
      throw new UnauthorizedException('Invalid site access password');
    }

    const token = issueSiteAccessToken(cfg.secret, cfg.sessionSeconds);
    const frontBase = this.config.getOrThrow<string>('FRONTEND_URL').replace(/\/$/, '');
    const secure = resolveCookieSecure(this.config, frontBase);

    res.cookie(SITE_ACCESS_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: cfg.sessionSeconds * 1000,
    });

    return { ok: true, expiresIn: cfg.sessionSeconds };
  }
}
