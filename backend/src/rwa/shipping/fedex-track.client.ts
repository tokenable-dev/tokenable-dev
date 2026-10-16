import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  fedExPublicConfig,
  fedExTruthy,
  fetchFedExAccessToken,
  postFedExJson,
  requireFedExOAuthCreds,
  type FedExApiCallResult,
} from './fedex-api.util';
import {
  parseFedExTrackResponse,
  type FedExTrackPackageResult,
} from './fedex-track.util';

/** FedEx Track v1 paths — see `backend/openapi/fedex-track-v1.openapi.json`. */
export const FEDEX_TRACK_PATHS = {
  trackingNumbers: '/track/v1/trackingnumbers',
  associatedShipments: '/track/v1/associatedshipments',
  notifications: '/track/v1/notifications',
  referenceNumbers: '/track/v1/referencenumbers',
  tcn: '/track/v1/tcn',
  trackingDocuments: '/track/v1/trackingdocuments',
} as const;

export type FedExTrackPathKey = keyof typeof FEDEX_TRACK_PATHS;

/** FedEx Track API max tracking numbers per request. */
export const FEDEX_TRACK_BATCH_SIZE = 30;

/**
 * FedEx Track API (Basic Integrated Visibility).
 * Uses FEDEX_TRACK_CLIENT_ID/SECRET when set (separate FedEx project from Rate).
 */
@Injectable()
export class FedExTrackClient {
  private readonly logger = new Logger(FedExTrackClient.name);

  constructor(private readonly config: ConfigService) {}

  enabled(): boolean {
    return fedExTruthy(this.config, 'FEDEX_TRACK_ENABLED');
  }

  private async authorizedPost(
    path: string,
    body: unknown,
  ): Promise<FedExApiCallResult> {
    const { token, status } = await fetchFedExAccessToken(this.config, 'track');
    if (!status.ok || !token) {
      throw new Error(status.error ?? 'FedEx OAuth failed');
    }
    return postFedExJson(this.config, path, body, token);
  }

  /** Low-level POST — returns raw FedEx HTTP status + JSON body. */
  async post(path: FedExTrackPathKey | string, body: unknown): Promise<FedExApiCallResult> {
    const resolved =
      path in FEDEX_TRACK_PATHS
        ? FEDEX_TRACK_PATHS[path as FedExTrackPathKey]
        : path.startsWith('/')
          ? path
          : `/${path}`;
    return this.authorizedPost(resolved, body);
  }

  /** POST /track/v1/trackingnumbers */
  async trackByTrackingNumbersPayload(
    body: Record<string, unknown>,
  ): Promise<FedExApiCallResult> {
    return this.post('trackingNumbers', body);
  }

  /** POST /track/v1/associatedshipments — MPS / Group MPS / return link. */
  async trackAssociatedShipments(
    body: Record<string, unknown>,
  ): Promise<FedExApiCallResult> {
    return this.post('associatedShipments', body);
  }

  /** POST /track/v1/notifications — email tracking event notifications. */
  async sendTrackingNotification(
    body: Record<string, unknown>,
  ): Promise<FedExApiCallResult> {
    return this.post('notifications', body);
  }

  /** POST /track/v1/referencenumbers — PO / BOL / customer reference, etc. */
  async trackByReferences(
    body: Record<string, unknown>,
  ): Promise<FedExApiCallResult> {
    return this.post('referenceNumbers', body);
  }

  /** POST /track/v1/tcn — Transportation Control Number. */
  async trackByTcn(body: Record<string, unknown>): Promise<FedExApiCallResult> {
    return this.post('tcn', body);
  }

  /** POST /track/v1/trackingdocuments — SPOD / signature proof PDF. */
  async requestTrackingDocuments(
    body: Record<string, unknown>,
  ): Promise<FedExApiCallResult> {
    return this.post('trackingDocuments', body);
  }

  /**
   * Convenience: track numbers (chunks of 30) and parse Delivered status.
   * Used by redeem delivery cron.
   */
  async trackByNumbers(
    trackingNumbers: string[],
  ): Promise<FedExTrackPackageResult[]> {
    const cleaned = [
      ...new Set(
        trackingNumbers
          .map((n) => n.replace(/\s+/g, '').toUpperCase())
          .filter(Boolean),
      ),
    ];
    if (cleaned.length === 0) return [];

    const out: FedExTrackPackageResult[] = [];

    for (let i = 0; i < cleaned.length; i += FEDEX_TRACK_BATCH_SIZE) {
      const chunk = cleaned.slice(i, i + FEDEX_TRACK_BATCH_SIZE);
      const payload = {
        includeDetailedScans: false,
        trackingInfo: chunk.map((trackingNumber) => ({
          trackingNumberInfo: { trackingNumber },
        })),
      };
      const res = await this.trackByTrackingNumbersPayload(payload);
      if (res.httpStatus < 200 || res.httpStatus >= 300) {
        const errBody = res.body as {
          errors?: Array<{ message?: string; code?: string }>;
        };
        const msg =
          errBody.errors?.[0]?.message ||
          `FedEx Track HTTP ${res.httpStatus}`;
        this.logger.warn(
          `FedEx Track failed chunk=${chunk.length}: ${msg}`,
        );
        throw new Error(msg);
      }
      out.push(...parseFedExTrackResponse(res.body));
    }

    return out;
  }

  /**
   * Admin/dev probe — OAuth status + raw FedEx request/response.
   * Never returns client secret.
   */
  async probe(
    pathKey: FedExTrackPathKey,
    body: Record<string, unknown>,
  ): Promise<{
    config: ReturnType<typeof fedExPublicConfig>;
    oauth: { ok: boolean; expiresInSec?: number; error?: string };
    request: Record<string, unknown>;
    fedexPath: string;
    fedexHttpStatus: number | null;
    fedexResponse: unknown;
    note: string;
  }> {
    const cfg = fedExPublicConfig(this.config);
    const fedexPath = FEDEX_TRACK_PATHS[pathKey];

    try {
      requireFedExOAuthCreds(this.config, 'track');
    } catch (e) {
      return {
        config: cfg,
        oauth: {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        },
        request: body,
        fedexPath,
        fedexHttpStatus: null,
        fedexResponse: null,
        note: 'Configure FEDEX_TRACK_CLIENT_ID / FEDEX_TRACK_CLIENT_SECRET (or shared FEDEX_CLIENT_ID / SECRET) in backend .env',
      };
    }

    if (!this.enabled()) {
      return {
        config: cfg,
        oauth: { ok: false, error: 'FEDEX_TRACK_ENABLED is off' },
        request: body,
        fedexPath,
        fedexHttpStatus: null,
        fedexResponse: null,
        note: 'Set FEDEX_TRACK_ENABLED=true to call Track API.',
      };
    }

    const { token, status } = await fetchFedExAccessToken(this.config, 'track');
    if (!status.ok || !token) {
      return {
        config: cfg,
        oauth: status,
        request: body,
        fedexPath,
        fedexHttpStatus: null,
        fedexResponse: null,
        note: 'OAuth failed — check sandbox/production API key pair.',
      };
    }

    const res = await postFedExJson(this.config, fedexPath, body, token);
    return {
      config: cfg,
      oauth: status,
      request: body,
      fedexPath,
      fedexHttpStatus: res.httpStatus,
      fedexResponse: res.body,
      note:
        res.httpStatus >= 200 && res.httpStatus < 300
          ? 'OK'
          : 'FedEx returned an error — see fedexResponse.errors',
    };
  }
}
