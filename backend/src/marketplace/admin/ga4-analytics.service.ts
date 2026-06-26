import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Ga4ServiceAccountCredentials } from '../../config/ga4.config';
import { Ga4AnalyticsCache } from './ga4-analytics-cache';
import {
  avgEngagementSec,
  dimensionAt,
  formatGa4Date,
  ga4DateRange,
  metricAt,
} from './ga4-analytics.util';

export type Ga4PageRow = {
  pagePath: string;
  pageTitle: string | null;
  screenPageViews: number;
  activeUsers: number;
  avgEngagementSec: number | null;
};

export type Ga4DailyRow = {
  date: string;
  activeUsers: number;
  screenPageViews: number;
  sessions: number;
};

export type Ga4EventRow = {
  eventName: string;
  eventCount: number;
};

export type Ga4CountryRow = {
  country: string;
  activeUsers: number;
  sessions: number;
};

export type Ga4DeviceRow = {
  deviceCategory: string;
  activeUsers: number;
  sessions: number;
};

export type Ga4AnalyticsDashboard =
  | {
      configured: false;
      setup: {
        propertyId: boolean;
        serviceAccount: boolean;
        measurementId: string | null;
        steps: string[];
      };
    }
  | {
      configured: true;
      periodDays: number;
      fetchedAt: string;
      cached: boolean;
      realtime: { activeUsers: number };
      overview: {
        activeUsers: number;
        newUsers: number;
        sessions: number;
        screenPageViews: number;
        averageSessionDurationSec: number;
        engagementRatePct: number | null;
      };
      topPages: Ga4PageRow[];
      topEvents: Ga4EventRow[];
      topCountries: Ga4CountryRow[];
      topDevices: Ga4DeviceRow[];
      timeseries: Ga4DailyRow[];
    };

const SETUP_STEPS = [
  'Google Cloud → enable "Google Analytics Data API".',
  'Create a service account and download JSON key.',
  'GA4 Admin → Property access → add service account email as Viewer.',
  'Copy numeric Property ID (Admin → Property settings — not G-XXXXXXXX).',
  'Set backend env: GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON (or GA4_SERVICE_ACCOUNT_JSON_PATH).',
];

/** GA4 Data API quota — cache report bodies; realtime is always fresh. */
const GA4_REPORT_CACHE_MS = 5 * 60 * 1000;

type Ga4ReportBody = Extract<Ga4AnalyticsDashboard, { configured: true }>;

@Injectable()
export class Ga4AnalyticsService {
  private readonly logger = new Logger(Ga4AnalyticsService.name);
  private client: BetaAnalyticsDataClient | null = null;
  private propertyResource = '';
  private readonly reportCache = new Ga4AnalyticsCache<
    Omit<Ga4ReportBody, 'realtime' | 'fetchedAt' | 'cached'>
  >(GA4_REPORT_CACHE_MS);

  constructor(private readonly config: ConfigService) {
    const ga4 = this.config.get<{
      enabled: boolean;
      propertyId: string;
      measurementId: string;
      credentials: Ga4ServiceAccountCredentials | null;
    }>('ga4');

    if (ga4?.enabled && ga4.credentials) {
      this.client = new BetaAnalyticsDataClient({
        credentials: ga4.credentials,
      });
      this.propertyResource = `properties/${ga4.propertyId}`;
    }
  }

  private isReady(): boolean {
    return this.client != null && this.propertyResource.length > 0;
  }

  private setupStatus(): Ga4AnalyticsDashboard {
    const ga4 = this.config.get<{
      propertyId: string;
      measurementId: string;
      credentials: Ga4ServiceAccountCredentials | null;
    }>('ga4');

    return {
      configured: false,
      setup: {
        propertyId: Boolean(ga4?.propertyId),
        serviceAccount: ga4?.credentials != null,
        measurementId: ga4?.measurementId || null,
        steps: SETUP_STEPS,
      },
    };
  }

  async getDashboard(days = 30): Promise<Ga4AnalyticsDashboard> {
    if (!this.isReady() || !this.client) {
      return this.setupStatus();
    }

    const periodDays = Math.min(90, Math.max(7, Math.floor(days)));
    const cacheKey = String(periodDays);

    try {
      const cachedBody = this.reportCache.get(cacheKey);
      const realtimeUsers = await this.fetchRealtimeUsers();

      if (cachedBody) {
        return {
          ...cachedBody,
          realtime: { activeUsers: realtimeUsers },
          fetchedAt: new Date().toISOString(),
          cached: true,
        };
      }

      const body = await this.fetchReportBody(periodDays);
      this.reportCache.set(cacheKey, body);

      return {
        ...body,
        realtime: { activeUsers: realtimeUsers },
        fetchedAt: new Date().toISOString(),
        cached: false,
      };
    } catch (err) {
      this.logger.warn(
        `GA4 Data API failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  private async fetchRealtimeUsers(): Promise<number> {
    if (!this.client) return 0;
    const [realtimeRes] = await this.client.runRealtimeReport({
      property: this.propertyResource,
      metrics: [{ name: 'activeUsers' }],
    });
    const row = realtimeRes.rows?.[0];
    return row ? metricAt(row, 0) : 0;
  }

  private async fetchReportBody(
    periodDays: number,
  ): Promise<Omit<Ga4ReportBody, 'realtime' | 'fetchedAt' | 'cached'>> {
    if (!this.client) {
      throw new Error('GA4 client not initialized');
    }

    const range = ga4DateRange(periodDays);

    const [
      overviewRes,
      pagesRes,
      seriesRes,
      eventsRes,
      countriesRes,
      devicesRes,
    ] = await Promise.all([
      this.client.runReport({
        property: this.propertyResource,
        dateRanges: [range],
        metrics: [
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
          { name: 'engagementRate' },
        ],
      }),
      this.client.runReport({
        property: this.propertyResource,
        dateRanges: [range],
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'userEngagementDuration' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 20,
      }),
      this.client.runReport({
        property: this.propertyResource,
        dateRanges: [range],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'sessions' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
      this.client.runReport({
        property: this.propertyResource,
        dateRanges: [range],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 15,
      }),
      this.client.runReport({
        property: this.propertyResource,
        dateRanges: [range],
        dimensions: [{ name: 'country' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
        ],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 15,
      }),
      this.client.runReport({
        property: this.propertyResource,
        dateRanges: [range],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
        ],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10,
      }),
    ]);

    const overviewRow = overviewRes[0]?.rows?.[0];
    const engagementRate = overviewRow ? metricAt(overviewRow, 5) : 0;

    const topPages: Ga4PageRow[] = (pagesRes[0]?.rows ?? []).map((row) => {
      const views = metricAt(row, 0);
      const engagement = metricAt(row, 2);
      return {
        pagePath: dimensionAt(row, 0) || '/',
        pageTitle: dimensionAt(row, 1) || null,
        screenPageViews: views,
        activeUsers: metricAt(row, 1),
        avgEngagementSec: avgEngagementSec(engagement, views),
      };
    });

    const timeseries: Ga4DailyRow[] = (seriesRes[0]?.rows ?? []).map((row) => ({
      date: formatGa4Date(dimensionAt(row, 0)),
      activeUsers: metricAt(row, 0),
      screenPageViews: metricAt(row, 1),
      sessions: metricAt(row, 2),
    }));

    const topEvents: Ga4EventRow[] = (eventsRes[0]?.rows ?? []).map((row) => ({
      eventName: dimensionAt(row, 0) || '(not set)',
      eventCount: metricAt(row, 0),
    }));

    const topCountries: Ga4CountryRow[] = (countriesRes[0]?.rows ?? []).map(
      (row) => ({
        country: dimensionAt(row, 0) || '(not set)',
        activeUsers: metricAt(row, 0),
        sessions: metricAt(row, 1),
      }),
    );

    const topDevices: Ga4DeviceRow[] = (devicesRes[0]?.rows ?? []).map((row) => ({
      deviceCategory: dimensionAt(row, 0) || '(not set)',
      activeUsers: metricAt(row, 0),
      sessions: metricAt(row, 1),
    }));

    return {
      configured: true,
      periodDays,
      overview: {
        activeUsers: overviewRow ? metricAt(overviewRow, 0) : 0,
        newUsers: overviewRow ? metricAt(overviewRow, 1) : 0,
        sessions: overviewRow ? metricAt(overviewRow, 2) : 0,
        screenPageViews: overviewRow ? metricAt(overviewRow, 3) : 0,
        averageSessionDurationSec: overviewRow
          ? metricAt(overviewRow, 4)
          : 0,
        engagementRatePct:
          engagementRate > 0
            ? Math.round(engagementRate * 1000) / 10
            : null,
      },
      topPages,
      topEvents,
      topCountries,
      topDevices,
      timeseries,
    };
  }
}
