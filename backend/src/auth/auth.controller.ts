import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import {
  clearAccessTokenCookie,
  resolveCookieSecure,
  serializeAuthUser,
  setAccessTokenCookie,
  userMayAuthenticate,
} from './auth-session.util';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { AuthSessionResponseDto } from './dto/auth-session.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { extractBearerToken } from './privy';
import { apiBodyDefault } from '../swagger/api-body.util';
import { SWAGGER_BODY_EXAMPLES } from '../swagger/examples';
import { maybeRefreshSiteAccessCookie } from '../site-access/site-access.util';

/** Privy-only auth — session cookie issued after `POST /auth/privy/session`. */
@ApiTags('privy-auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly users: UserService,
  ) {}

  @Get('session')
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiOperation({
    summary: '현재 Tokenable 세션 조회',
    description:
      '쿠키 `access_token` 또는 Bearer JWT. Privy 로그인 후 `POST /auth/privy/session`으로 발급된 세션.',
  })
  async session(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const u = await this.auth.sessionUserFromRequest(req);
    if (!u) return { user: null };
    if (!userMayAuthenticate(u)) {
      clearAccessTokenCookie(res, this.config);
      return { user: null };
    }
    const wallets = await this.users.listWalletsForUser(u.id);
    const authProviders = await this.users.listAuthProvidersForUser(u.id);
    return { user: serializeAuthUser(u, wallets, authProviders) };
  }

  @Post('privy/session')
  @HttpCode(200)
  @ApiHeader({
    name: 'Authorization',
    description: 'Bearer &lt;Privy access token&gt; from `getAccessToken()`',
    required: true,
  })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiOperation({
    summary: 'Privy → Tokenable 세션 동기화',
    description:
      '1) 프론트 Privy 로그인 → 2) `getAccessToken()` → 3) 이 API → `access_token` 쿠키 + user JSON. Site access 켜져 있으면 먼저 `POST /site-access/verify`.',
  })
  async privySession(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = extractBearerToken(req);
    if (!token) {
      throw new BadRequestException('Missing Privy access token');
    }
    const user = await this.auth.authenticatePrivyAccessToken(token);
    const front = this.config.getOrThrow<string>('FRONTEND_URL').replace(/\/$/, '');
    setAccessTokenCookie(res, this.auth.issueAccessToken(user), this.config);
    maybeRefreshSiteAccessCookie(
      res,
      process.env,
      resolveCookieSecure(this.config, front),
    );
    const wallets = await this.users.listWalletsForUser(user.id);
    const authProviders = await this.users.listAuthProvidersForUser(user.id);
    return { user: serializeAuthUser(user, wallets, authProviders) };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Tokenable 로그아웃',
    description: '쿠키 삭제. 클라이언트에서 Privy `logout`도 호출하세요.',
  })
  logout(@Res() res: Response): void {
    clearAccessTokenCookie(res, this.config);
    res.end();
  }

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(204)
  @ApiOperation({ summary: '회원 탈퇴' })
  @ApiBody(apiBodyDefault(DeleteAccountDto, SWAGGER_BODY_EXAMPLES.authDeleteAccount))
  async deleteAccount(
    @Req() req: Request & { user: User },
    @Res() res: Response,
  ): Promise<void> {
    await this.auth.deleteAccount(req.user.id);
    clearAccessTokenCookie(res, this.config);
    res.end();
  }
}
