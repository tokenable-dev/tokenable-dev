import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  CATALOG_COVER_MAX_BYTES,
  CatalogCoverS3Service,
} from '../marketplace/collections/catalog-cover-s3.service';
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
import { UpdateProfileDto } from './dto/update-profile.dto';
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
    private readonly catalogCoverS3: CatalogCoverS3Service,
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
  // Each call verifies the Privy token upstream — cap per-IP to protect the
  // Privy API quota during a login stampede.
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
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

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiOperation({
    summary: '프로필 / 알림 설정 업데이트',
    description:
      'Display name, marketing opt-in, email notification master switch + category prefs.',
  })
  async updateProfile(
    @Req() req: Request & { user: User },
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.users.updateProfile(req.user.id, dto);
    const wallets = await this.users.listWalletsForUser(user.id);
    const authProviders = await this.users.listAuthProvidersForUser(user.id);
    return { user: serializeAuthUser(user, wallets, authProviders) };
  }

  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiOperation({
    summary: '프로필 아바타 업로드',
    description:
      'JPEG/PNG/WebP ≤ 8MB. Same S3 bucket as catalog covers (`{prefix}user-avatars/{userId}/avatar`).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: CATALOG_COVER_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          cb(
            new BadRequestException('Avatar must be a JPEG, PNG, or WebP image'),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async uploadAvatar(
    @Req() req: Request & { user: User },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!this.catalogCoverS3.isConfigured()) {
      throw new ServiceUnavailableException(
        'Avatar storage is not configured (set CATALOG_COVER_S3_BUCKET and CATALOG_COVER_PUBLIC_BASE_URL)',
      );
    }
    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }
    try {
      const { publicUrl } = await this.catalogCoverS3.uploadUserAvatar(
        req.user.id,
        file,
      );
      // Cache-bust overwrite so clients refresh the same object key immediately.
      const pictureUrl = `${publicUrl}?v=${Date.now()}`;
      const user = await this.users.updatePictureUrl(req.user.id, pictureUrl);
      const wallets = await this.users.listWalletsForUser(user.id);
      const authProviders = await this.users.listAuthProvidersForUser(user.id);
      return { user: serializeAuthUser(user, wallets, authProviders) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'CATALOG_COVER_S3_NOT_CONFIGURED') {
        throw new ServiceUnavailableException(
          'Avatar storage is not configured (set CATALOG_COVER_S3_BUCKET and CATALOG_COVER_PUBLIC_BASE_URL)',
        );
      }
      if (msg === 'CATALOG_COVER_FILE_TOO_LARGE') {
        throw new BadRequestException('Avatar must be 8MB or smaller');
      }
      if (
        msg === 'CATALOG_COVER_FILE_EMPTY' ||
        msg === 'CATALOG_COVER_FILE_TYPE_INVALID'
      ) {
        throw new BadRequestException('Avatar must be a JPEG, PNG, or WebP image');
      }
      if (/AccessDenied|not authorized to perform: s3:PutObject/i.test(msg)) {
        throw new ServiceUnavailableException(
          'Avatar upload was denied by S3 IAM. Ensure the uploader can PutObject under your CATALOG_COVER_S3_PREFIX (avatars are stored at {prefix}user-avatars/{userId}/avatar).',
        );
      }
      throw e;
    }
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
