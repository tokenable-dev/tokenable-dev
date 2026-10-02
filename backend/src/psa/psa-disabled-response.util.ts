import { ServiceUnavailableException } from '@nestjs/common';

export type PsaPublicApiDisabledReason =
  | 'no_token'
  | 'upstream_disabled';

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
    case 'no_token':
      throw new ServiceUnavailableException(
        'PSA_PUBLIC_API_TOKEN or PSA_PUBLIC_API_TOKENS is not set. Add token(s) from psacard.com/publicapi to backend/.env and restart the server.',
      );
  }
}
