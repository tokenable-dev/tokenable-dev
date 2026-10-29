"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { updateAuthProfile } from "@/lib/auth/auth";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  CURRENCY_COOKIE,
  LOCALE_COOKIE,
  resolveAppLocale,
  resolveDisplayCurrency,
  resolveLocale,
  SUPPORTED_CURRENCIES,
  type AppLocale,
  type DisplayCurrency,
} from "@/lib/i18n/preferences";
import { setDisplayFxSnapshot,
  USD_DISPLAY_FX,
  type DisplayFx,
} from "@/lib/market/displayMoney";
import { useCatalogNameRevision } from "@/lib/marketplace/catalogNameTranslation";
import { setDisplayLocaleSnapshot } from "@/lib/marketplace/localizePokemonCardName";
import { useAuthStore } from "@/store/authStore";

type RatesBody = {
  observationDate?: string | null;
  fetchedAt?: string | null;
  stale?: boolean;
  rates?: Record<string, number>;
};

type DisplayPreferences = DisplayFx & {
  selectCurrency: (currency: DisplayCurrency) => void;
  selectLocale: (locale: AppLocale) => void;
};

const DisplayPreferencesContext = createContext<DisplayPreferences>({
  ...USD_DISPLAY_FX,
  selectCurrency: () => {},
  selectLocale: () => {},
});

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const row = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  if (!row) return null;
  try {
    return decodeURIComponent(row.slice(prefix.length));
  } catch {
    return null;
  }
}

function writeCookie(name: string, value: string): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

function ratesFromBody(body: RatesBody | null): DisplayFx["rates"] {
  const rates: DisplayFx["rates"] = { USD: 1 };
  for (const code of SUPPORTED_CURRENCIES) {
    const n = body?.rates?.[code];
    if (typeof n === "number" && Number.isFinite(n) && n > 0) rates[code] = n;
  }
  return rates;
}

function composeFx(currency: DisplayCurrency, body: RatesBody | null): DisplayFx {
  const rates = ratesFromBody(body);
  const fallbackToUsd = currency !== "USD" && rates[currency] == null;
  return {
    currency,
    rates,
    observationDate: body?.observationDate ?? null,
    fetchedAt: body?.fetchedAt ?? null,
    stale: fallbackToUsd || body == null ? currency !== "USD" : Boolean(body.stale),
    fallbackToUsd,
  };
}

export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  setDisplayLocaleSnapshot(useLocale());
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const [fx, setFx] = useState<DisplayFx>(USD_DISPLAY_FX);
  const ratesRef = useRef<RatesBody | null>(null);
  const savingRef = useRef(false);
  /**
   * Last explicit picker choice in this tab. Any auth store update (session sync,
   * KYC merge, a /auth/me that started before the PATCH) carries the *old* profile
   * value, and profile beats cookie for signed-in users — so without this the effect
   * below silently reverted the choice. Cleared once the profile catches up.
   */
  const choiceRef = useRef<{ locale?: AppLocale; currency?: DisplayCurrency }>({});

  const publish = useCallback((next: DisplayFx) => {
    setDisplayFxSnapshot(next);
    setFx(next);
  }, []);

  const ratesInflightRef = useRef<Promise<void> | null>(null);

  /**
   * Fetch FX rates (deduped). Re-run when a picked currency has no rate yet —
   * the mount fetch can fail or still be in flight on slow mobile networks, and
   * previously it was never retried, so the UI stayed on USD (fallbackToUsd).
   */
  const loadRates = useCallback(() => {
    if (ratesInflightRef.current) return ratesInflightRef.current;
    const run = (async () => {
      try {
        const res = await fetch("/api/fx/rates", { headers: { accept: "application/json" } });
        if (!res.ok) return;
        const body = (await res.json()) as RatesBody;
        ratesRef.current = body;
        // A picker choice made while this was in flight must win over the (possibly
        // stale) profile value — otherwise the late response reverted it.
        const currency =
          choiceRef.current.currency ??
          resolveDisplayCurrency({
            authenticated: Boolean(useAuthStore.getState().user),
            profile: useAuthStore.getState().user?.preferredCurrency,
            cookie: readCookie(CURRENCY_COOKIE),
          });
        publish(composeFx(currency, body));
      } catch {
        /* Keep the last snapshot. USD stays available. */
      } finally {
        ratesInflightRef.current = null;
      }
    })();
    ratesInflightRef.current = run;
    return run;
  }, [publish]);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  useEffect(() => {
    if (!initialized || savingRef.current) return;
    const choice = choiceRef.current;
    if (choice.locale && (!user || user.preferredLocale === choice.locale)) choice.locale = undefined;
    if (choice.currency && (!user || user.preferredCurrency === choice.currency)) {
      choice.currency = undefined;
    }
    const currency = choice.currency ?? resolveDisplayCurrency({
      authenticated: Boolean(user),
      profile: user?.preferredCurrency,
      cookie: readCookie(CURRENCY_COOKIE),
    });
    if (user?.preferredCurrency === currency) {
      writeCookie(CURRENCY_COOKIE, currency);
    }
    const locale = choice.locale ?? resolveAppLocale({
      authenticated: Boolean(user),
      profile: user?.preferredLocale,
      cookie: readCookie(LOCALE_COOKIE),
    });
    if (locale !== resolveLocale(readCookie(LOCALE_COOKIE))) {
      writeCookie(LOCALE_COOKIE, locale);
      router.refresh();
    }
    publish(composeFx(currency, ratesRef.current));
  }, [initialized, publish, router, user, user?.preferredCurrency, user?.preferredLocale]);

  const selectCurrency = useCallback(
    (currency: DisplayCurrency) => {
      savingRef.current = true;
      choiceRef.current.currency = currency;
      writeCookie(CURRENCY_COOKIE, currency);
      publish(composeFx(currency, ratesRef.current));
      if (currency !== "USD" && ratesRef.current?.rates?.[currency] == null) {
        void loadRates();
      }
      const current = useAuthStore.getState().user;
      if (!current) {
        savingRef.current = false;
        return;
      }
      void updateAuthProfile({ preferredCurrency: currency })
        .then((next) => {
          useAuthStore.getState().setUser(next);
        })
        .catch(() => {
          /* Local cookie stands until the next profile load. */
        })
        .finally(() => {
          savingRef.current = false;
        });
    },
    [loadRates, publish],
  );

  const selectLocale = useCallback(
    (locale: AppLocale) => {
      savingRef.current = true;
      choiceRef.current.locale = locale;
      writeCookie(LOCALE_COOKIE, locale);
      router.refresh();
      const current = useAuthStore.getState().user;
      if (!current) {
        savingRef.current = false;
        return;
      }
      void updateAuthProfile({ preferredLocale: locale })
        .then((next) => {
          useAuthStore.getState().setUser(next);
        })
        .catch(() => {
          /* Cookie stands until the next profile load. */
        })
        .finally(() => {
          savingRef.current = false;
        });
    },
    [router],
  );

  const value = useMemo(
    () => ({ ...fx, selectCurrency, selectLocale }),
    [fx, selectCurrency, selectLocale],
  );

  return (
    <DisplayPreferencesContext.Provider value={value}>
      {children}
    </DisplayPreferencesContext.Provider>
  );
}

/** Subscribes the caller so memoized cards rerender when the currency changes. */
export function useDisplayFx(): DisplayFx {
  useCatalogNameRevision();
  const { selectCurrency: _select, selectLocale: _locale, ...fx } = useContext(
    DisplayPreferencesContext,
  );
  return fx;
}

export function useSelectDisplayCurrency(): (currency: DisplayCurrency) => void {
  return useContext(DisplayPreferencesContext).selectCurrency;
}

export function useSelectLocale(): (locale: AppLocale) => void {
  return useContext(DisplayPreferencesContext).selectLocale;
}
