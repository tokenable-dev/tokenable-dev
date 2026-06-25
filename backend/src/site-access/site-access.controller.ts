import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { resolveCookieSecure } from '../auth/auth-session.util';
import { apiBodyDefault } from '../swagger/api-body.util';
import { SWAGGER_BODY_EXAMPLES } from '../swagger/examples';
import { VerifySiteAccessDto } from './dto/verify-site-access.dto';
import {
  SITE_ACCESS_COOKIE,
  issueSiteAccessToken,
  readSiteAccessConfig,
} from './site-access.util';

@ApiTags('site-access')
@Controller('site-access')
export class SiteAccessController {
  constructor(private readonly config: ConfigService) {}

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Site access 비밀번호 검증',
    description:
      '배포 환경(`SITE_ACCESS_ENABLED`)에서 API Try it out 전에 먼저 호출하세요. 성공 시 `site_access` 쿠키가 설정됩니다.',
  })
  @ApiBody(
    apiBodyDefault(VerifySiteAccessDto, SWAGGER_BODY_EXAMPLES.siteAccessVerify),
  )
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
