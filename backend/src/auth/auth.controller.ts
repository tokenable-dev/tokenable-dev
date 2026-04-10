import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { getAddress } from 'ethers';
import type { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { LinkWalletDto } from './dto/link-wallet.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly users: UserService,
  ) {}

  /** COOKIE_SECURE 미설정 시 FRONTEND_URL 이 https 면 true, http(IP) 면 false */
  private resolveCookieSecure(frontUrl: string): boolean {
    const explicit = this.config.get<string>('COOKIE_SECURE');
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    return frontUrl.startsWith('https:');
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth 시작 (302 → Google)' })
  googleAuth(): void {
    /* Passport redirects */
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth 콜백 → JWT 쿠키 후 프론트로 리다이렉트' })
  googleCallback(@Req() req: Request & { user: User }, @Res() res: Response): void {
    const user = req.user;
    void this.auth.sendVerificationEmailAfterOAuth(user.id).catch((err: unknown) => {
      this.logger.warn(`Verification email enqueue failed: ${String(err)}`);
    });
    const token = this.auth.issueAccessToken(user);
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    const frontBase = this.config.getOrThrow<string>('FRONTEND_URL').replace(/\/$/, '');
    /** HTTPS 또는 COOKIE_SECURE=true 일 때만 Secure 플래그 (HTTP + IP 배포는 false) */
    const cookieSecure = this.resolveCookieSecure(frontBase);
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'lax',
      maxAge,
      path: '/',
    });
    const front = frontBase;
    res.redirect(`${front}/auth/callback?ok=1`);
  }

  @Get('verify-email')
  @ApiOperation({ summary: '이메일 인증 링크 (메일에서 클릭)' })
  @ApiQuery({
    name: 'token',
    required: true,
    description: '메일에 포함된 일회용 인증 토큰',
  })
  async verifyEmail(
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const front = this.config.getOrThrow<string>('FRONTEND_URL').replace(/\/$/, '');
    if (!token?.trim()) {
      res.redirect(`${front}/?email_verify=missing`);
      return;
    }
    const ok = await this.auth.verifyEmailToken(token);
    res.redirect(
      ok ? `${front}/?email_verify=ok` : `${front}/?email_verify=invalid`,
    );
  }

  @Post('send-verification-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(200)
  @ApiOperation({ summary: '인증 메일 재발송 (로그인 필요)' })
  async sendVerificationEmail(@Req() req: Request & { user: User }) {
    await this.auth.resendVerificationEmail(req.user.id);
    return { ok: true };
  }

  @Get('session')
  @ApiOperation({
    summary: '현재 세션 (비로그인도 200 + user: null — 브라우저 콘솔 401 노이즈 방지)',
  })
  async session(@Req() req: Request) {
    const u = await this.auth.sessionUserFromRequest(req);
    if (!u) return { user: null };
    return {
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        pictureUrl: u.pictureUrl,
        walletAddress: u.walletAddress,
        walletLinkedAt: u.walletLinkedAt,
        platformEmailVerifiedAt: u.platformEmailVerifiedAt
          ? u.platformEmailVerifiedAt.toISOString()
          : null,
      },
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '현재 로그인 사용자 (Cookie 또는 Bearer) — 미인증 시 401' })
  me(@Req() req: { user: User }) {
    const u = req.user;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      pictureUrl: u.pictureUrl,
      walletAddress: u.walletAddress,
      walletLinkedAt: u.walletLinkedAt,
      platformEmailVerifiedAt: u.platformEmailVerifiedAt
        ? u.platformEmailVerifiedAt.toISOString()
        : null,
    };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: '로그아웃 (쿠키 삭제)' })
  logout(@Res() res: Response): void {
    res.clearCookie('access_token', { path: '/' });
    res.end();
  }

  @Post('wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '지갑 주소를 계정에 연결 (체크섬 정규화)' })
  async linkWallet(
    @Req() req: Request & { user: User },
    @Body() dto: LinkWalletDto,
  ) {
    const normalized = getAddress(dto.address);
    const u = await this.users.setWalletAddress(req.user.id, normalized);
    return {
      id: u.id,
      walletAddress: u.walletAddress,
      walletLinkedAt: u.walletLinkedAt,
    };
  }

  @Delete('wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '지갑 연결 해제' })
  async unlinkWallet(@Req() req: Request & { user: User }) {
    const u = await this.users.clearWallet(req.user.id);
    return { walletAddress: u.walletAddress };
  }
}
