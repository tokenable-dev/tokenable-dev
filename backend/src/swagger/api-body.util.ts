import type { Type } from '@nestjs/common';
import type { ApiBodyOptions } from '@nestjs/swagger';

/** Swagger Try it out — 단일 기본 예시 (드롭다운 1개, UI 단순화). */
export function apiBodyDefault<T>(
  type: Type<T>,
  value: Record<string, unknown>,
  summary = '기본 예시',
): ApiBodyOptions {
  return {
    type,
    examples: {
      default: { summary, value },
    },
  };
}
