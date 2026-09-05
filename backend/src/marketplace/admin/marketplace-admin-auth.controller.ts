import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { resolveCookieSecure } from '../../auth/auth-session.util';
import { apiBodyDefault } from '../../swagger/api-body.util';
import { SWAGGER_BODY_EXAMPLES } from '../../swagger/examples';
import { MarketplaceAdminService } from './marketplace-admin.service';
import {
  MARKETPLACE_ADMIN_COOKIE,
  issueMarketplaceAdminToken,
} from './marketplace-admin-auth.util';
import { MarketplaceAdminLoginDto } from './dto/marketplace-admin-login.dto';

@ApiTags('marketplace-admin')
@Controller('marketplace/admin/auth')
export class MarketplaceAdminAuthController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly config: ConfigService,
  ) {}

  @Get('session')
  @ApiOperation({ summary: '[Admin] Current admin session' })
  session(@Req() req: Request): { authenticated: boolean; username: string | null } {
    const username = this.admin.getSessionUsername(req);
    return {
      authenticated: Boolean(username),
      username,
    };
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: '[Admin] Sign in with username and password',
    description:
      '성공 시 `marketplace_admin` HttpOnly 쿠키. 이후 marketplace-admin 태그 API는 별도 Bearer 없이 쿠키로 인증됩니다 (동일 origin Try it out).',
  })
  @ApiBody(apiBodyDefault(MarketplaceAdminLoginDto, SWAGGER_BODY_EXAMPLES.adminLogin))
  async login(
    @Body() body: MarketplaceAdminLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true; username: string; expiresIn: number }> {
    const username = await this.admin.verifyCredentials(
      body.username,
      body.password,
    );
    if (!username) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const sessionSeconds = this.config.get<number>(
      'marketplace.adminSessionSeconds',
      28_800,
    );
    const secret = this.config.getOrThrow<string>(
      'marketplace.adminSessionSecret',
    );
    const token = issueMarketplaceAdminToken(secret, sessionSeconds);
    const frontBase = this.config.getOrThrow<string>('FRONTEND_URL').replace(/\/$/, '');
    const secure = resolveCookieSecure(this.config, frontBase);

    res.cookie(MARKETPLACE_ADMIN_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: sessionSeconds * 1000,
    });

    return { ok: true, username, expiresIn: sessionSeconds };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: '[Admin] Sign out' })
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    const frontBase = this.config.getOrThrow<string>('FRONTEND_URL').replace(/\/$/, '');
    const secure = resolveCookieSecure(this.config, frontBase);
    res.clearCookie(MARKETPLACE_ADMIN_COOKIE, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
    });
    return { ok: true };
  }
}
