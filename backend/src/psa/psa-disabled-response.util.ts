import {
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  PSA_RATE_LIMIT_CODE,
  PSA_RATE_LIMIT_MESSAGE,
} from './psa-rate-limit.exception';

export type PsaPublicApiDisabledReason =
  | 'no_token'
  | 'upstream_disabled'
  | 'all_tokens_rate_limited';

export type PsaPublicApiDisabledResult = {
  status: 'disabled';
  reason: PsaPublicApiDisabledReason;
};

export function throwPsaPublicApiDisabledException(
  reason: PsaPublicApiDisabledReason,
): never {
  switch (reason) {
    case 'upstream_disabled':
      throw new ServiceUnavailableException(
        'PSA Public API upstream is disabled. Set PSA_PUBLIC_API_UPSTREAM_ENABLED=true and PSA_PUBLIC_API_TOKEN or PSA_PUBLIC_API_TOKENS in backend/.env, then restart the server.',
      );
    case 'all_tokens_rate_limited':
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: PSA_RATE_LIMIT_CODE,
          message: PSA_RATE_LIMIT_MESSAGE,
          detail:
            'All PSA Public API tokens in PSA_PUBLIC_API_TOKENS are temporarily blocked after HTTP 429 (daily quota). Retry after UTC midnight, add more tokens, or upgrade PSA API access.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    case 'no_token':
      throw new ServiceUnavailableException(
        'PSA_PUBLIC_API_TOKEN or PSA_PUBLIC_API_TOKENS is not set. Add token(s) from psacard.com/publicapi to backend/.env and restart the server.',
      );
  }
}
