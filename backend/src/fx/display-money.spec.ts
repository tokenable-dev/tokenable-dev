import {
  formatDisplayMoney,
  formatUsdcAmount,
  setDisplayFxSnapshot,
  type DisplayFx,
} from "@/lib/market/displayMoney";
import {
  CURRENCY_OPTIONS,
  SUPPORTED_CURRENCIES,
  LOCALE_OPTIONS,
  resolveAppLocale,
  resolveDisplayCurrency,
  resolveLocale,
  SUPPORTED_LOCALES,
} from "@/lib/i18n/preferences";

const KRW: DisplayFx = {
  currency: "KRW",
  rates: { USD: 1, KRW: 1325.28 },
  observationDate: "2026-10-26",
  fetchedAt: "2026-10-27T15:30:00.000Z",
  stale: false,
  fallbackToUsd: false,
};

describe("formatDisplayMoney", () => {
  it("converts a USD reference with the ECB quote and rounds to whole units", () => {
    expect(formatDisplayMoney(100, KRW)).toBe("₩132,528");
  });

  it("leaves USD references in dollars", () => {
    expect(
      formatDisplayMoney(100, { ...KRW, currency: "USD" }),
    ).toBe("$100");
  });

  it("rounds every display currency to a whole unit and uses its symbol", () => {
    expect(
      formatDisplayMoney(100, {
        ...KRW,
        currency: "EUR",
        rates: { USD: 1, EUR: 0.89381 },
      }),
    ).toBe("€89");
    expect(
      formatDisplayMoney(100, {
        ...KRW,
        currency: "GBP",
        rates: { USD: 1, GBP: 0.7492 },
      }),
    ).toBe("£75");
    expect(
      formatDisplayMoney(100, {
        ...KRW,
        currency: "SGD",
        rates: { USD: 1, SGD: 1.2806 },
      }),
    ).toBe("S$ 128");
    expect(
      formatDisplayMoney(100, {
        ...KRW,
        currency: "AUD",
        rates: { USD: 1, AUD: 1.4236 },
      }),
    ).toBe("A$ 142");
    expect(
      formatDisplayMoney(100, {
        ...KRW,
        currency: "CAD",
        rates: { USD: 1, CAD: 1.4028 },
      }),
    ).toBe("C$ 140");
    expect(
      formatDisplayMoney(1, {
        ...KRW,
        currency: "IDR",
        rates: { USD: 1, IDR: 18163 },
      }),
    ).toBe("Rp 18,163");
    expect(
      formatDisplayMoney(1, {
        ...KRW,
        currency: "VND",
        rates: { USD: 1, VND: 25858 },
      }),
    ).toBe("₫25,858");
    expect(
      formatDisplayMoney(100, {
        ...KRW,
        currency: "THB",
        rates: { USD: 1, THB: 33.805 },
      }),
    ).toBe("฿3,381");
  });

  it("does not invent a rate when the selected currency is missing", () => {
    expect(formatDisplayMoney(100, { ...KRW, rates: { USD: 1 } })).toBe("$100");
  });

  it("still converts when the rate is marked stale", () => {
    expect(formatDisplayMoney(100, { ...KRW, stale: true })).toBe("₩132,528");
  });

  it("returns a dash for null and follows the module snapshot", () => {
    expect(formatDisplayMoney(null)).toBe("—");
    setDisplayFxSnapshot({
      currency: "EUR",
      rates: { USD: 1, EUR: 0.5 },
      observationDate: "2026-10-26",
      fetchedAt: null,
      stale: false,
      fallbackToUsd: false,
    });
    expect(formatDisplayMoney(10)).toBe("€5");
    setDisplayFxSnapshot({
      currency: "USD",
      rates: { USD: 1 },
      observationDate: null,
      fetchedAt: null,
      stale: false,
      fallbackToUsd: false,
    });
    expect(formatDisplayMoney(10)).toBe("$10");
  });
});

describe("formatUsdcAmount", () => {
  const aud: DisplayFx = {
    currency: "AUD",
    rates: { USD: 1, AUD: 1.4236 },
    observationDate: "2026-10-26",
    fetchedAt: "2026-10-27T15:30:00.000Z",
    stale: false,
    fallbackToUsd: false,
  };

  it("shows a USDC settlement as dollars at 1:1", () => {
    expect(formatUsdcAmount(10000)).toBe("$10,000");
    expect(formatUsdcAmount(0)).toBe("$0");
    expect(formatUsdcAmount(10.4)).toBe("$10");
    expect(formatUsdcAmount(10.5)).toBe("$11");
    expect(formatUsdcAmount(-2.2)).toBe("-$2");
    expect(formatUsdcAmount(null)).toBe("—");
    expect(formatUsdcAmount(Number.NaN)).toBe("—");
  });

  it("does not convert a USDC amount when the display currency changes", () => {
    setDisplayFxSnapshot(aud);
    expect(formatUsdcAmount(154600)).toBe("$154,600");
    expect(formatDisplayMoney(100, aud)).toBe("A$ 142");
    setDisplayFxSnapshot({
      currency: "USD",
      rates: { USD: 1 },
      observationDate: null,
      fetchedAt: null,
      stale: false,
      fallbackToUsd: false,
    });
  });
});

describe("currency picker catalog", () => {
  it("lists only the verified display currencies, in picker order", () => {
    expect(CURRENCY_OPTIONS.map((row) => row.code)).toEqual([...SUPPORTED_CURRENCIES]);
    expect(new Set(CURRENCY_OPTIONS.map((row) => row.name)).size).toBe(
      CURRENCY_OPTIONS.length,
    );
  });
});

describe("display preference precedence", () => {
  it("uses USD and English for a first visit", () => {
    expect(resolveLocale(undefined)).toBe("en");
    expect(
      resolveDisplayCurrency({ authenticated: false, profile: null, cookie: null }),
    ).toBe("USD");
  });

  it("keeps a guest cookie and ignores a malformed currency", () => {
    expect(
      resolveDisplayCurrency({
        authenticated: false,
        profile: null,
        cookie: "KRW",
      }),
    ).toBe("KRW");
    expect(
      resolveDisplayCurrency({
        authenticated: false,
        profile: null,
        cookie: "BTC",
      }),
    ).toBe("USD");
  });

  it("lets a saved profile beat a disagreeing cookie", () => {
    expect(
      resolveDisplayCurrency({
        authenticated: true,
        profile: "JPY",
        cookie: "EUR",
      }),
    ).toBe("JPY");
  });

  it("does not let a guest cookie overwrite an empty profile until one is saved", () => {
    expect(
      resolveDisplayCurrency({
        authenticated: true,
        profile: null,
        cookie: "GBP",
      }),
    ).toBe("GBP");
  });

  it("falls back when the saved profile currency is unsupported", () => {
    expect(
      resolveDisplayCurrency({
        authenticated: true,
        profile: "BTC",
        cookie: null,
      }),
    ).toBe("USD");
    expect(resolveLocale("ko")).toBe("en");
    expect(resolveLocale("en-US")).toBe("en");
    expect(resolveLocale("zh")).toBe("en");
    expect(resolveLocale("")).toBe("en");
  });

  it("accepts the four customer locales and keeps canonical case", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "zh-CN", "ja", "zh-TW"]);
    expect(LOCALE_OPTIONS.map((row) => row.code)).toEqual([...SUPPORTED_LOCALES]);
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("zh-CN")).toBe("zh-CN");
    expect(resolveLocale("ZH-cn")).toBe("zh-CN");
    expect(resolveLocale("ja")).toBe("ja");
    expect(resolveLocale("zh-tw")).toBe("zh-TW");
  });

  it("lets a saved profile locale beat a guest cookie", () => {
    expect(
      resolveAppLocale({
        authenticated: true,
        profile: "ja",
        cookie: "zh-CN",
      }),
    ).toBe("ja");
  });

  it("uses the guest cookie when the profile has no locale", () => {
    expect(
      resolveAppLocale({
        authenticated: true,
        profile: null,
        cookie: "zh-TW",
      }),
    ).toBe("zh-TW");
    expect(
      resolveAppLocale({
        authenticated: false,
        profile: "ja",
        cookie: "zh-CN",
      }),
    ).toBe("zh-CN");
  });

  it("falls back to English when the saved locale is not supported", () => {
    expect(
      resolveAppLocale({
        authenticated: true,
        profile: "ko",
        cookie: null,
      }),
    ).toBe("en");
    expect(
      resolveAppLocale({
        authenticated: true,
        profile: "ko",
        cookie: "ja",
      }),
    ).toBe("ja");
  });
});
