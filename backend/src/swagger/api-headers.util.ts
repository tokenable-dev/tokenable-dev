import { ApiHeader } from '@nestjs/swagger';
import { CHAIN_ID_HEADER } from '../blockchain/chain-config.service';

/** Optional multi-chain selector — used by marketplace read/write paths. */
export function ApiChainIdHeader(): MethodDecorator & ClassDecorator {
  return ApiHeader({
    name: CHAIN_ID_HEADER,
    required: false,
    description:
      'Chain ID (예: 11155111 Sepolia, 1 Ethereum, 137 Polygon). 미설정 시 서버 기본 체인.',
    schema: { type: 'integer', example: 80002 },
  });
}
