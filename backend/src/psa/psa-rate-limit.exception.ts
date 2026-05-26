import { HttpException, HttpStatus } from '@nestjs/common';

export const PSA_RATE_LIMIT_CODE = 'PSA_RATE_LIMIT_EXCEEDED';

export const PSA_RATE_LIMIT_MESSAGE =
  'PSA free Public API lookup quota is temporarily exhausted. Official PSA data (grade, population, slab images) is unavailable until the limit resets. Please try again later or review your plan at psacard.com/publicapi.';

export function isPsaRateLimitHttpStatus(status: number | undefined): boolean {
  return status === 429;
}

export function throwPsaRateLimitHttpException(detail?: string): never {
  throw new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      code: PSA_RATE_LIMIT_CODE,
      message: PSA_RATE_LIMIT_MESSAGE,
      ...(detail?.trim() ? { detail: detail.trim() } : {}),
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
