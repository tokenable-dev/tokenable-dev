import {
  BadRequestException,
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrivyService } from '../auth/privy';
import {
  groupPrivyCatalogByCategory,
  listSwaggerTryPaths,
  PRIVY_FEATURE_CATALOG,
} from './privy-catalog';
import { PrivyStatusResponseDto } from './dto/privy-response.dto';

@ApiTags('privy')
@Controller('privy')
export class PrivyCatalogController {
  constructor(private readonly privy: PrivyService) {}

  @Get('catalog')
  @ApiOperation({
    summary: 'Privy 기능 카탈로그 (전체)',
    description:
      'Privy가 제공하는 인증·지갑·펀딩·MFA·컨트롤 기능을 한눈에 조회합니다. `swaggerTryPath`가 있으면 Swagger Try it out 가능.',
  })
  catalog() {
    return {
      total: PRIVY_FEATURE_CATALOG.length,
      categories: groupPrivyCatalogByCategory(),
      entries: PRIVY_FEATURE_CATALOG,
    };
  }

  @Get('status')
  @ApiOkResponse({ type: PrivyStatusResponseDto })
  @ApiOperation({
    summary: 'Privy 연동 상태',
    description:
      '서버 Privy 설정 + Apple Pay / Google Pay는 **클라이언트 `useFiatOnramp`** (메인넷)에서 사용.',
  })
  status(): PrivyStatusResponseDto {
    return {
      configured: this.privy.isConfigured(),
      appId: this.privy.getAppId(),
      catalogCount: PRIVY_FEATURE_CATALOG.length,
      swaggerTryPaths: listSwaggerTryPaths(),
      applePayGooglePay: {
        available: true,
        surface: 'client-sdk (useFiatOnramp)',
        clientHook: 'useFiatOnramp',
        note:
          'Debit/credit, Apple Pay, Google Pay via Privy modal. Amoy/testnet on-ramps are not supported — use mainnet + sandbox providers in Dashboard.',
      },
    };
  }

  @Get('routes')
  @ApiOperation({
    summary: 'Swagger 테스트 가능 경로 목록',
    description: 'Tokenable API에서 Try it out 가능한 Privy 관련 경로만 추립니다.',
  })
  routes() {
    return { paths: listSwaggerTryPaths() };
  }
}

/** Throws when Privy server credentials are missing. */
export function assertPrivyConfigured(privy: PrivyService): void {
  if (!privy.isConfigured()) {
    throw new ServiceUnavailableException(
      'Privy is not configured — set PRIVY_APP_ID and PRIVY_APP_SECRET in backend/.env',
    );
  }
}

export function readBearerFromAuthHeader(
  authorization: string | undefined,
): string {
  if (!authorization?.startsWith('Bearer ')) {
    throw new BadRequestException('Missing Authorization: Bearer <token>');
  }
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) throw new BadRequestException('Empty Bearer token');
  return token;
}
