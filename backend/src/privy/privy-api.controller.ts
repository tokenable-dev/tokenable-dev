import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { PrivyService } from '../auth/privy';
import { apiBodyDefault } from '../swagger/api-body.util';
import { SWAGGER_BODY_EXAMPLES } from '../swagger/examples';
import {
  assertPrivyConfigured,
  readBearerFromAuthHeader,
} from './privy-catalog.controller';
import { assessPrivyFundingReadiness } from './privy-funding.util';
import {
  PrivyCreateUserDto,
  PrivyLookupEmailDto,
  PrivyLookupWalletDto,
  PrivySearchUsersDto,
  PrivySetMetadataDto,
  PrivyVerifyAccessTokenDto,
} from './dto/privy-api.dto';

@ApiTags('privy-auth')
@Controller('privy')
export class PrivyAuthDevController {
  constructor(private readonly privy: PrivyService) {}

  @Post('verify-access-token')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Privy access token 검증 (dev)',
    description:
      'Privy JWT를 검증하고 `user_id`를 반환합니다. `POST /auth/privy/session` 호출 전 토큰 확인용.',
  })
  @ApiBody(apiBodyDefault(PrivyVerifyAccessTokenDto, SWAGGER_BODY_EXAMPLES.privyVerifyToken))
  async verifyAccessToken(@Body() body: PrivyVerifyAccessTokenDto) {
    assertPrivyConfigured(this.privy);
    const { userId } = await this.privy.verifyAccessToken(body.accessToken.trim());
    return { valid: true, userId };
  }

  @Post('verify-access-token/header')
  @HttpCode(200)
  @ApiBearerAuth('privy-access-token')
  @ApiOperation({
    summary: 'Privy access token 검증 (Authorization 헤더)',
    description: 'Authorize에 Privy token을 넣고 Try it out.',
  })
  async verifyAccessTokenHeader(@Req() req: Request) {
    assertPrivyConfigured(this.privy);
    const token = readBearerFromAuthHeader(req.headers.authorization);
    const { userId } = await this.privy.verifyAccessToken(token);
    return { valid: true, userId };
  }
}

@ApiTags('privy-users')
@Controller('privy/users')
export class PrivyUsersController {
  constructor(private readonly privy: PrivyService) {}

  @Get()
  @ApiOperation({ summary: 'Privy 사용자 목록 (cursor)' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'cursor', required: false })
  async list(
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    assertPrivyConfigured(this.privy);
    const client = this.privy.requireClient();
    const limit = Math.min(Math.max(Number(limitRaw) || 20, 1), 100);
    const page = await client.users().list({ limit, cursor: cursor ?? undefined });
    return {
      data: page.data,
      next_cursor: page.next_cursor,
    };
  }

  @Get(':privyUserId')
  @ApiOperation({ summary: 'Privy 사용자 조회 (ID)' })
  @ApiParam({ name: 'privyUserId', example: 'did:privy:...' })
  async get(@Param('privyUserId') privyUserId: string) {
    assertPrivyConfigured(this.privy);
    return this.privy.fetchUser(privyUserId);
  }

  @Post('search')
  @HttpCode(200)
  @ApiOperation({ summary: 'Privy 사용자 검색' })
  @ApiBody(apiBodyDefault(PrivySearchUsersDto, SWAGGER_BODY_EXAMPLES.privySearchUsers))
  async search(@Body() body: PrivySearchUsersDto) {
    assertPrivyConfigured(this.privy);
    const client = this.privy.requireClient();
    if (body.searchTerm) {
      return client.users().search({ searchTerm: body.searchTerm });
    }
    if (body.emails?.length || body.walletAddresses?.length) {
      return client.users().search({
        emails: body.emails ?? [],
        phoneNumbers: [],
        walletAddresses: body.walletAddresses ?? [],
      });
    }
    throw new BadRequestException('Provide searchTerm, emails, or walletAddresses');
  }

  @Post('lookup/email')
  @HttpCode(200)
  @ApiOperation({ summary: 'Privy 사용자 — 이메일로 조회' })
  @ApiBody(apiBodyDefault(PrivyLookupEmailDto, SWAGGER_BODY_EXAMPLES.privyLookupEmail))
  async lookupEmail(@Body() body: PrivyLookupEmailDto) {
    assertPrivyConfigured(this.privy);
    return this.privy.requireClient().users().getByEmailAddress({
      address: body.address.toLowerCase(),
    });
  }

  @Post('lookup/wallet')
  @HttpCode(200)
  @ApiOperation({ summary: 'Privy 사용자 — 지갑 주소로 조회' })
  @ApiBody(apiBodyDefault(PrivyLookupWalletDto, SWAGGER_BODY_EXAMPLES.privyLookupWallet))
  async lookupWallet(@Body() body: PrivyLookupWalletDto) {
    assertPrivyConfigured(this.privy);
    return this.privy.requireClient().users().getByWalletAddress({
      address: body.address,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Privy 사용자 생성' })
  @ApiBody(apiBodyDefault(PrivyCreateUserDto, SWAGGER_BODY_EXAMPLES.privyCreateUser))
  async create(@Body() body: PrivyCreateUserDto) {
    assertPrivyConfigured(this.privy);
    return this.privy.requireClient().users().create({
      linked_accounts: body.linked_accounts as never,
    });
  }

  @Delete(':privyUserId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Privy 사용자 삭제' })
  async remove(@Param('privyUserId') privyUserId: string): Promise<void> {
    assertPrivyConfigured(this.privy);
    await this.privy.requireClient().users().delete(privyUserId);
  }

  @Patch(':privyUserId/metadata')
  @ApiOperation({ summary: 'Privy custom metadata 설정' })
  @ApiBody(apiBodyDefault(PrivySetMetadataDto, SWAGGER_BODY_EXAMPLES.privySetMetadata))
  async setMetadata(
    @Param('privyUserId') privyUserId: string,
    @Body() body: PrivySetMetadataDto,
  ) {
    assertPrivyConfigured(this.privy);
    return this.privy.requireClient().users().setCustomMetadata(privyUserId, {
      custom_metadata: body.custom_metadata,
    });
  }
}

@ApiTags('privy-funding')
@Controller('privy/apps')
export class PrivyFundingController {
  constructor(private readonly privy: PrivyService) {}

  @Get('settings')
  @ApiOperation({
    summary: 'Privy 앱 설정 (펀딩 / on-ramp)',
    description:
      'Dashboard MoonPay on-ramp readiness. Default funding network must be Polygon + USDC (`eip155:137`) to match Tokenable `supportedChains`.',
  })
  async appSettings() {
    assertPrivyConfigured(this.privy);
    const appId = this.privy.getAppId();
    if (!appId) throw new BadRequestException('Missing PRIVY_APP_ID');
    const settings = await this.privy.requireClient().apps().getSettings();
    const fundingReadiness = assessPrivyFundingReadiness(settings);
    return {
      appId,
      funding_config: settings.funding_config ?? null,
      fiat_on_ramp_enabled: settings.fiat_on_ramp_enabled,
      fundingReadiness,
      auth_methods: {
        email: settings.email_auth,
        google: settings.google_oauth,
        apple: settings.apple_oauth,
        wallet_signup: settings.external_wallets_for_signup_enabled,
      },
      embedded_wallet_config: settings.embedded_wallet_config ?? null,
      integration: {
        clientHook: 'useFiatOnramp (primary) · useFundWallet (legacy Privy modal)',
        provider: 'MoonPay only — card, Apple Pay, Google Pay via MoonPay when enabled in Dashboard',
        requiredDashboardDefaults: {
          chain: 'eip155:137',
          asset: 'USDC',
        },
        testnet:
          'On-ramps deliver mainnet tokens only — testnets use MockUSDC faucet in dev, not MoonPay.',
      },
    };
  }
}
