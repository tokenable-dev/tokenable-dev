import type { ConfigService } from '@nestjs/config';

/** Server-side Privy credentials (from env). */
export type PrivyEnvConfig = {
  appId: string | null;
  appSecret: string | null;
  jwtVerificationKey: string | undefined;
};

export function readPrivyEnv(config: ConfigService): PrivyEnvConfig {
  return {
    appId: config.get<string>('PRIVY_APP_ID')?.trim() ?? null,
    appSecret: config.get<string>('PRIVY_APP_SECRET')?.trim() ?? null,
    jwtVerificationKey:
      config.get<string>('PRIVY_JWT_VERIFICATION_KEY')?.trim() || undefined,
  };
}

export function isPrivyConfigured(env: PrivyEnvConfig): boolean {
  return Boolean(env.appId && env.appSecret);
}
