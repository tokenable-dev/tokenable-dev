import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseFilters,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { getAddress } from 'ethers';
import type { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import {
  clearAccessTokenCookie,
  serializeAuthUser,
  setAccessTokenCookie,
  userMayAuthenticate,
} from './auth-session.util';
import { GoogleOAuthExceptionFilter } from './filters/google-oauth-exception.filter';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LinkWalletDto } from './dto/link-wallet.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { apiBodyDefault } from '../swagger/api-body.util';
import { SWAGGER_BODY_EXAMPLES } from '../swagger/examples';

/**
 * 인증·세션 — Google OAuth, email/password, JWT httpOnly 쿠키, 지갑 연결.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly users: UserService,
  ) {}

  /** Google 로그인 시작 (Google로 리다이렉트) */
  @Post('register')
  @HttpCode(200)
  @ApiOperation({ summary: '이메일 회원가입' })
  @ApiBody(apiBodyDefault(RegisterDto, SWAGGER_BODY_EXAMPLES.authRegister))
  async register(@Body() dto: RegisterDto) {
    const user = await this.auth.registerWithEmail(dto);
    return {
      ok: true,
      email: user.email,
      message: 'Check your email to verify your account before signing in.',
    };
  }

  /** 이메일·비밀번호 로그인 */
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: '이메일 로그인' })
  @ApiBody(apiBodyDefault(LoginDto, SWAGGER_BODY_EXAMPLES.authLogin))
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.loginWithEmail(dto.email, dto.password);
    setAccessTokenCookie(res, this.auth.issueAccessToken(user), this.config);
    const wallets = await this.users.listWalletsForUser(user.id);
    return { user: serializeAuthUser(user, wallets) };
  }

  /** Google 로그인 시작 (Google로 리다이렉트) */
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth 시작' })
  googleAuth(): void {
    /* Passport redirects */
  }

  /** Google 콜백 — JWT 쿠키 설정 후 프론트 `/auth/callback` */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @UseFilters(GoogleOAuthExceptionFilter)
  @ApiOperation({ summary: 'Google OAuth 콜백 (JWT 쿠키)' })
  googleCallback(
    @Req() req: Request & { user: User },
    @Res() res: Response,
  ): void {
    const user = req.user;
    const front = this.config
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');
    if (!userMayAuthenticate(user)) {
      const message = encodeURIComponent(
        'Verify your email before signing in with Google.',
      );
      res.redirect(`${front}/auth/callback?error=${message}`);
      return;
    }
    const token = this.auth.issueAccessToken(user);
    setAccessTokenCookie(res, token, this.config);
    res.redirect(`${front}/auth/callback?ok=1`);
  }

  /** 메일 인증 링크 클릭 처리 */
  @Get('verify-email')
  @ApiOperation({ summary: '이메일 인증 링크' })
  @ApiQuery({ name: 'token', required: true, description: '인증 메일의 token', example: 'paste-verification-token-from-email' })
  async verifyEmail(
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const front = this.config
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');
    if (!token?.trim()) {
      res.redirect(`${front}/?email_verify=missing`);
      return;
    }
    const result = await this.auth.verifyEmailToken(token);
    if (result.ok) {
      res.redirect(`${front}/?email_verify=ok`);
      return;
    }
    res.redirect(`${front}/?email_verify=${result.reason}`);
  }

  /** 인증 메일 재발송 (로그인 사용자) */
  @Post('send-verification-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(200)
  @ApiOperation({ summary: '인증 메일 재발송 (로그인)' })
  async sendVerificationEmail(@Req() req: Request & { user: User }) {
    await this.auth.resendVerificationEmail(req.user.id);
    return { ok: true };
  }

  /** 인증 메일 재발송 (비로그인 — 이메일 주소) */
  @Post('resend-verification-email')
  @HttpCode(200)
  @ApiOperation({ summary: '인증 메일 재발송 (이메일)' })
  @ApiBody(apiBodyDefault(ResendVerificationDto, SWAGGER_BODY_EXAMPLES.authResendVerification))
  async resendVerificationEmailPublic(@Body() dto: ResendVerificationDto) {
    await this.auth.resendVerificationEmailByEmail(dto.email);
    return { ok: true };
  }

  /** Request a password reset email (email/password accounts only). */
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: '비밀번호 재설정 메일 요청' })
  @ApiBody(apiBodyDefault(ForgotPasswordDto, SWAGGER_BODY_EXAMPLES.authForgotPassword))
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.requestPasswordReset(dto.email);
    return { ok: true };
  }

  /** Set a new password using the token from the reset email. */
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: '비밀번호 재설정' })
  @ApiBody(apiBodyDefault(ResetPasswordDto, SWAGGER_BODY_EXAMPLES.authResetPassword))
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.resetPasswordWithToken(
      dto.token,
      dto.password,
    );
    if (!result.ok) {
      throw new BadRequestException(
        result.reason === 'expired'
          ? 'Reset link expired. Request a new one.'
          : 'Invalid or expired reset link.',
      );
    }
    const user = result.user;
    setAccessTokenCookie(res, this.auth.issueAccessToken(user), this.config);
    const wallets = await this.users.listWalletsForUser(user.id);
    return { ok: true, user: serializeAuthUser(user, wallets) };
  }

  /** Change password while signed in (email/password accounts). */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(200)
  @ApiOperation({ summary: '비밀번호 변경 (로그인)' })
  @ApiBody(apiBodyDefault(ChangePasswordDto, SWAGGER_BODY_EXAMPLES.authChangePassword))
  async changePassword(
    @Req() req: Request & { user: User },
    @Body() dto: ChangePasswordDto,
  ) {
    await this.auth.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return { ok: true };
  }

  /** Permanently delete the signed-in account (email or Google). */
  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(204)
  @ApiOperation({ summary: '회원 탈퇴' })
  @ApiBody(apiBodyDefault(DeleteAccountDto, SWAGGER_BODY_EXAMPLES.authDeleteAccount))
  async deleteAccount(
    @Req() req: Request & { user: User },
    @Body() dto: DeleteAccountDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.auth.deleteAccount(req.user.id, dto.password);
    clearAccessTokenCookie(res, this.config);
    res.end();
  }

  /** 현재 로그인 사용자 (비로그인 시 `user: null`, 200) */
  @Get('session')
  @ApiOperation({ summary: '현재 세션 조회' })
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
    return { user: serializeAuthUser(u, wallets) };
  }

  /** access_token 쿠키 삭제 */
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: '로그아웃' })
  logout(@Res() res: Response): void {
    clearAccessTokenCookie(res, this.config);
    res.end();
  }

  /** 지갑 연결용 서명 메시지 발급 */
  @Get('wallet/challenge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '지갑 연결 challenge' })
  walletLinkChallenge(@Req() req: Request & { user: User }) {
    return this.auth.createWalletLinkChallenge(req.user.id);
  }

  /** 계정에 지갑 주소 연결 (서명 검증) */
  @Post('wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '지갑 연결' })
  async linkWallet(
    @Req() req: Request & { user: User },
    @Body() dto: LinkWalletDto,
  ) {
    const normalized = getAddress(dto.address);
    const u = await this.auth.linkWalletWithSignature(
      req.user.id,
      normalized,
      dto.signature,
      dto.challenge,
    );
    const wallets = await this.users.listWalletsForUser(u.id);
    return serializeAuthUser(u, wallets);
  }

  /** Remove one linked wallet from the account */
  @Delete('wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '지갑 연결 해제' })
  @ApiQuery({ name: 'address', required: true, description: 'Unlink wallet address' })
  async unlinkWallet(
    @Req() req: Request & { user: User },
    @Query('address') address: string,
  ) {
    const normalized = getAddress(address);
    const u = await this.users.removeWallet(req.user.id, normalized);
    const wallets = await this.users.listWalletsForUser(u.id);
    return serializeAuthUser(u, wallets);
  }
}
