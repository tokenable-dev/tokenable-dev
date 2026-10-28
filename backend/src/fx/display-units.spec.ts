import type { CollectionPlatformTapeFill } from "@/lib/core/api/marketplace-market-data";
import {
  setDisplayFxSnapshot,
  USD_DISPLAY_FX,
  type DisplayFx,
} from "@/lib/market/displayMoney";
import {
  CARDHEDGER_REFERENCE_DAILY_SALE_TYPE,
  computeHeroTapeActivityStats,
  formatSplitHeroVolume,
  TRADE_VOLUME_180D_SEC,
} from "@/lib/market/tradesVolume";
import { formatCertValueChange } from "@/lib/portfolio/portfolioCertificateFormat";
import { formatPortfolioProfitReturn } from "@/lib/portfolio/portfolioTableHelpers";
import { formatPortfolioValueChangeLabel } from "@/lib/portfolio/portfolioValueChange";
import {
  formatCardHtmlAxisLabel,
  formatCardHtmlHoverWhen,
  formatCardHtmlThreeTickDayLabel,
  formatTickShortMdYear,
  formatTickYearOrMonthLabel,
} from "@/lib/marketplace/collection-dual-price-chart/chartTimeTicks";

const DAY = 86_400;
const NOW = 1_800_000_000;
const JAN_26 = Math.floor(Date.parse("2026-01-26T12:00:00Z") / 1000);
const FEB_3 = Math.floor(Date.parse("2026-02-03T12:00:00Z") / 1000);

const KRW: DisplayFx = {
  currency: "KRW",
  rates: { USD: 1, KRW: 1300 },
  observationDate: "2026-10-26",
  fetchedAt: null,
  stale: false,
  fallbackToUsd: false,
};

function fill(
  partial: Pick<CollectionPlatformTapeFill, "t" | "priceUsdc" | "source"> &
    Partial<CollectionPlatformTapeFill>,
): CollectionPlatformTapeFill {
  return {
    tokenId: "1",
    orderHash: `${partial.source ?? "platform"}:${partial.t}:${partial.priceUsdc}`,
    ...partial,
  };
}

describe("hero volume units", () => {
  it("keeps platform USDC and CardHedger USD apart and annualizes each", () => {
    const stats = computeHeroTapeActivityStats(
      [
        fill({ t: NOW - 200 * DAY, priceUsdc: 5, source: "platform" }),
        fill({ t: NOW - 10 * DAY, priceUsdc: 20, source: "platform" }),
        fill({ t: NOW - 10 * DAY, priceUsdc: 30, source: "cardhedger" }),
        fill({
          t: NOW - 10 * DAY,
          priceUsdc: 999,
          source: "cardhedger",
          externalSaleType: CARDHEDGER_REFERENCE_DAILY_SALE_TYPE,
        }),
      ],
      { t: NOW - DAY, v: 7 },
      60,
      120,
      NOW,
    );

    expect(stats.windowSec).toBe(TRADE_VOLUME_180D_SEC);
    expect(stats.volume1yPlatformUsdc).toBe(54);
    expect(stats.volume1yExternalUsd).toBe(60);
    expect(stats.velocityPct).toBe(50);
  });

  it("does not turn a platform-only tape into a USD velocity", () => {
    const stats = computeHeroTapeActivityStats(
      [
        fill({ t: NOW - 40 * DAY, priceUsdc: 1, source: "platform" }),
        fill({ t: NOW - 10 * DAY, priceUsdc: 10, source: "platform" }),
      ],
      null,
      60,
      1000,
      NOW,
    );
    expect(stats.volume1yPlatformUsdc).toBeGreaterThan(0);
    expect(stats.volume1yExternalUsd).toBe(0);
    expect(stats.velocityPct).toBeNull();
  });

  it("labels both sources and does not add them", () => {
    expect(
      formatSplitHeroVolume({
        platformUsdc: 1200,
        externalUsd: 600,
        formatPlatform: (n) => `$${n}`,
        formatExternal: (n) => `A$ ${n}`,
        platformLabel: "Platform",
        externalLabel: "Comps",
      }),
    ).toBe("Comps A$ 600 · Platform $1200");
    expect(
      formatSplitHeroVolume({
        platformUsdc: null,
        externalUsd: 600,
        formatPlatform: (n) => `$${n}`,
        formatExternal: (n) => `A$ ${n}`,
        platformLabel: "Platform",
        externalLabel: "Comps",
      }),
    ).toBe("A$ 600");
    expect(
      formatSplitHeroVolume({
        platformUsdc: 1200,
        externalUsd: 0,
        formatPlatform: (n) => `$${n}`,
        formatExternal: (n) => `A$ ${n}`,
        platformLabel: "Platform",
        externalLabel: "Comps",
      }),
    ).toBe("Platform $1200");
  });
});

describe("portfolio profit units", () => {
  afterEach(() => {
    setDisplayFxSnapshot(USD_DISPLAY_FX);
  });

  it("subtracts a USD mark from a USD mark", () => {
    const row = formatPortfolioProfitReturn(1000, 1100, "vault_delivery");
    expect(row?.profit).toBe("+$100");
    expect(row?.returnPct).toBe("+10%");
    expect(formatCertValueChange(1100, 1000, "manual")?.usdLabel).toBe("+$100");
  });

  it("does not subtract a USDC fill from a USD mark", () => {
    expect(formatPortfolioProfitReturn(1000, 1100, "marketplace_buy")).toBeNull();
    expect(formatPortfolioProfitReturn(1000, 1100, null)).toBeNull();
    expect(formatCertValueChange(1100, 1000, "marketplace_buy")).toBeNull();
  });

  it("converts a USD profit into the selected display currency", () => {
    setDisplayFxSnapshot(KRW);
    expect(formatPortfolioProfitReturn(1000, 1100, "manual")?.profit).toBe("+₩130,000");
    expect(formatCertValueChange(1100, 1000, "vault_delivery")?.usdLabel).toBe("+₩130,000");
    expect(formatPortfolioValueChangeLabel("up", 100, 2)?.usd).toBe("+₩130,000");
  });
});

describe("chart date locales", () => {
  it("localizes month names on axes and tooltips", () => {
    expect(formatCardHtmlHoverWhen(JAN_26, "en")).toBe("Jan 26, 2026");
    expect(formatCardHtmlHoverWhen(JAN_26, "zh-CN")).toBe("2026年1月26日");
    expect(formatCardHtmlHoverWhen(JAN_26, "ja")).toBe("2026年1月26日");
    expect(formatCardHtmlHoverWhen(JAN_26, "zh-TW")).toBe("2026年1月26日");

    expect(formatCardHtmlAxisLabel(FEB_3, 20, "en")).toBe("Feb 3");
    expect(formatCardHtmlAxisLabel(FEB_3, 20, "zh-CN")).toBe("2月3日");
    expect(formatCardHtmlAxisLabel(FEB_3, 90, "en")).toBe("Feb '26");
    expect(formatCardHtmlAxisLabel(FEB_3, 90, "ja")).toBe("26年2月");

    expect(formatTickShortMdYear(JAN_26, "en")).toBe("1.26 (Jan 2026)");
    expect(formatTickShortMdYear(JAN_26, "zh-TW")).toBe("1.26 (2026年1月)");

    expect(formatTickYearOrMonthLabel(FEB_3, JAN_26, "en")).toBe("Feb");
    expect(formatTickYearOrMonthLabel(FEB_3, JAN_26, "zh-CN")).toBe("2月");
    expect(formatTickYearOrMonthLabel(JAN_26, JAN_26, "ja")).toBe("{year|2026}");
  });

  it("adds a short year when the three ticks cross a calendar year", () => {
    const start = Math.floor(Date.parse("2025-12-01T12:00:00Z") / 1000);
    const end = Math.floor(Date.parse("2026-02-01T12:00:00Z") / 1000);
    expect(formatCardHtmlThreeTickDayLabel(JAN_26, start, end, "en")).toBe("Jan 26 '26");
    expect(formatCardHtmlThreeTickDayLabel(JAN_26, start, end, "zh-CN")).toBe("26年1月26日");
    expect(formatCardHtmlThreeTickDayLabel(JAN_26, JAN_26, FEB_3, "ja")).toBe("1月26日");
  });
});
