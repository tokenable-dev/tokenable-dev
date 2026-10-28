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
import {
  setDisplayFxSnapshot,
  USD_DISPLAY_FX,
  type DisplayFx,
} from "@/lib/market/displayMoney";
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
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const [fx, setFx] = useState<DisplayFx>(USD_DISPLAY_FX);
  const ratesRef = useRef<RatesBody | null>(null);
  const savingRef = useRef(false);

  const publish = useCallback((next: DisplayFx) => {
    setDisplayFxSnapshot(next);
    setFx(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/fx/rates", { headers: { accept: "application/json" } });
        if (!res.ok) return;
        const body = (await res.json()) as RatesBody;
        if (cancelled) return;
        ratesRef.current = body;
        const currency = resolveDisplayCurrency({
          authenticated: Boolean(useAuthStore.getState().user),
          profile: useAuthStore.getState().user?.preferredCurrency,
          cookie: readCookie(CURRENCY_COOKIE),
        });
        publish(composeFx(currency, body));
      } catch {
        /* Keep the last snapshot. USD stays available. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publish]);

  useEffect(() => {
    if (!initialized || savingRef.current) return;
    const currency = resolveDisplayCurrency({
      authenticated: Boolean(user),
      profile: user?.preferredCurrency,
      cookie: readCookie(CURRENCY_COOKIE),
    });
    if (user?.preferredCurrency === currency) {
      writeCookie(CURRENCY_COOKIE, currency);
    }
    const locale = resolveAppLocale({
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
      writeCookie(CURRENCY_COOKIE, currency);
      publish(composeFx(currency, ratesRef.current));
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
    [publish],
  );

  const selectLocale = useCallback(
    (locale: AppLocale) => {
      savingRef.current = true;
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
