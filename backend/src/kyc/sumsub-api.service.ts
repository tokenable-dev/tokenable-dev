import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { signSumsubRequest } from './utils/sumsub-auth.util';

type SumsubConfig = {
  appToken: string;
  secretKey: string;
  baseUrl: string;
  levelName: string;
};

@Injectable()
export class SumsubApiService {
  private readonly logger = new Logger(SumsubApiService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return this.readConfig() !== null;
  }

  private readConfig(): SumsubConfig | null {
    const appToken = this.config.get<string>('SUMSUB_APP_TOKEN')?.trim();
    const secretKey = this.config.get<string>('SUMSUB_SECRET_KEY')?.trim();
    const levelName = this.config.get<string>('SUMSUB_LEVEL_NAME')?.trim();
    if (!appToken || !secretKey || !levelName) return null;

    const baseUrl =
      this.config.get<string>('SUMSUB_BASE_URL')?.trim() ||
      'https://api.sumsub.com';

    return { appToken, secretKey, baseUrl: baseUrl.replace(/\/$/, ''), levelName };
  }

  private requireConfig(): SumsubConfig {
    const cfg = this.readConfig();
    if (!cfg) {
      throw new ServiceUnavailableException(
        'Sumsub KYC is not configured (SUMSUB_APP_TOKEN, SUMSUB_SECRET_KEY, SUMSUB_LEVEL_NAME)',
      );
    }
    return cfg;
  }

  private async request<T>(
    params: {
      method: string;
      path: string;
      body?: Record<string, unknown>;
    },
    options?: { allowNotFound?: boolean },
  ): Promise<T | null> {
    const cfg = this.requireConfig();
    const bodyStr = params.body ? JSON.stringify(params.body) : '';
    const { timestamp, signature } = signSumsubRequest({
      secretKey: cfg.secretKey,
      method: params.method,
      path: params.path,
      body: bodyStr,
    });

    const url = `${cfg.baseUrl}${params.path}`;
    const res = await fetch(url, {
      method: params.method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-App-Token': cfg.appToken,
        'X-App-Access-Ts': String(timestamp),
        'X-App-Access-Sig': signature,
      },
      body: bodyStr || undefined,
    });

    const text = await res.text();
    let json: unknown = {};
    if (text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = { raw: text };
      }
    }

    if (!res.ok) {
      if (options?.allowNotFound && res.status === 404) {
        return null;
      }
      this.logger.warn(
        JSON.stringify({
          msg: 'sumsub_api_error',
          method: params.method,
          path: params.path,
          status: res.status,
        }),
      );
      const description =
        typeof json === 'object' &&
        json !== null &&
        'description' in json &&
        typeof (json as { description?: unknown }).description === 'string'
          ? (json as { description: string }).description
          : `Sumsub API error (${res.status})`;
      throw new InternalServerErrorException(description);
    }

    return json as T;
  }

  async getApplicantByExternalUserId(externalUserId: string): Promise<{
    id: string;
  } | null> {
    const path = `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`;
    const data = await this.request<{ id?: string }>(
      { method: 'GET', path },
      { allowNotFound: true },
    );
    if (!data?.id) return null;
    return { id: data.id };
  }

  async createApplicant(params: {
    externalUserId: string;
    email?: string;
  }): Promise<{ id: string }> {
    const cfg = this.requireConfig();
    const path = `/resources/applicants?levelName=${encodeURIComponent(cfg.levelName)}`;
    const body: Record<string, unknown> = {
      externalUserId: params.externalUserId,
    };
    if (params.email?.trim()) {
      body.email = params.email.trim();
    }
    const data = await this.request<{ id?: string }>({
      method: 'POST',
      path,
      body,
    });
    if (!data?.id) {
      throw new InternalServerErrorException('Sumsub applicant id missing in response');
    }
    return { id: data.id };
  }

  async createSdkAccessToken(params: {
    externalUserId: string;
    email?: string;
    ttlInSecs?: number;
  }): Promise<{ token: string; userId: string }> {
    const cfg = this.requireConfig();
    const body: Record<string, unknown> = {
      userId: params.externalUserId,
      levelName: cfg.levelName,
      ttlInSecs: params.ttlInSecs ?? 600,
    };
    if (params.email?.trim()) {
      body.applicantIdentifiers = { email: params.email.trim() };
    }
    const data = await this.request<{ token?: string; userId?: string }>({
      method: 'POST',
      path: '/resources/accessTokens/sdk',
      body,
    });
    if (!data?.token || !data.userId) {
      throw new InternalServerErrorException('Sumsub access token missing in response');
    }
    return { token: data.token, userId: data.userId };
  }
}
