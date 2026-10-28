"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import {
  useDisplayFx,
  useSelectDisplayCurrency,
  useSelectLocale,
} from "@/components/i18n/DisplayPreferencesProvider";
import { cn } from "@/lib/ds/cn";
import {
  CURRENCY_OPTIONS,
  LOCALE_OPTIONS,
  resolveLocale,
  type DisplayCurrency,
} from "@/lib/i18n/preferences";

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <ellipse cx="12" cy="12" rx="4" ry="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16.5L20 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="gnb-locale__check" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l4.2 4.2L19 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HeaderLocaleMenu() {
  const t = useTranslations("Locale");
  const panelId = "gnb-locale-panel";
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; right: number } | null>(null);
  const [view, setView] = useState<"home" | "currency" | "language">("home");
  const [query, setQuery] = useState("");
  const fx = useDisplayFx();
  const selectCurrency = useSelectDisplayCurrency();
  const selectLocale = useSelectLocale();
  const activeLocale = resolveLocale(useLocale());
  const activeLanguage =
    LOCALE_OPTIONS.find((row) => row.code === activeLocale) ?? LOCALE_OPTIONS[0];
  const selected = CURRENCY_OPTIONS.find((row) => row.code === fx.currency) ?? CURRENCY_OPTIONS[0];
  const close = useCallback(() => {
    setOpen(false);
    setView("home");
    setQuery("");
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURRENCY_OPTIONS;
    return CURRENCY_OPTIONS.filter(
      (row) =>
        row.code.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.chip.toLowerCase().includes(q),
    );
  }, [query]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      setBox({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown);
    }, 0);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  useEffect(() => {
    if (!open || view !== "currency") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    searchRef.current?.focus();
  }, [open, view]);

  function choose(code: DisplayCurrency) {
    selectCurrency(code);
    close();
  }

  return (
    <div className="gnb-locale" ref={wrapRef}>
      <button
        type="button"
        className={cn("gnb-locale__btn", open && "is-open")}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <GlobeIcon />
        <span className="gnb-locale__code">
          {activeLanguage.short} <span className="gnb-locale__slash">/</span> {selected?.chip ?? "$"}
        </span>
      </button>

      {open && box
        ? createPortal(
            <LocalePanel
              panelRef={panelRef}
              panelId={panelId}
              label={
                view === "currency" ? t("currency") : view === "language" ? t("language") : t("menu")
              }
              style={{ top: box.top, right: box.right }}
            >
        {view === "home" ? (
          <>
            <div className="gnb-locale__title">{t("title")}</div>
            <button
              type="button"
              className="gnb-locale__row gnb-locale__row--btn"
              onClick={() => setView("language")}
            >
              <span className="gnb-locale__key">{t("language")}</span>
              <span className="gnb-locale__value">
                <span className="gnb-locale__flag" aria-hidden>
                  {activeLanguage.flag}
                </span>
                {activeLanguage.name}
                <ChevronIcon />
              </span>
            </button>
            <button
              type="button"
              className="gnb-locale__row gnb-locale__row--btn"
              onClick={() => setView("currency")}
            >
              <span className="gnb-locale__key">{t("currency")}</span>
              <span className="gnb-locale__value">
                <span className="gnb-locale__mark" aria-hidden>
                  {selected?.chip ?? "$"}
                </span>
                {fx.currency}
                <ChevronIcon />
              </span>
            </button>
          </>
        ) : view === "language" ? (
          <>
            <div className="gnb-locale__head">
              <button
                type="button"
                className="gnb-locale__back"
                aria-label={t("back")}
                onClick={() => setView("home")}
              >
                <BackIcon />
              </button>
              <div className="gnb-locale__head-title">{t("language")}</div>
            </div>
            <div className="gnb-locale__list" role="listbox" aria-label={t("language")}>
              {LOCALE_OPTIONS.map((row) => {
                const active = row.code === activeLocale;
                return (
                  <button
                    key={row.code}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className="gnb-locale__option"
                    onClick={() => {
                      selectLocale(row.code);
                      close();
                    }}
                  >
                    <span className="gnb-locale__flag" aria-hidden>
                      {row.flag}
                    </span>
                    <span className="gnb-locale__meta">
                      <span className="gnb-locale__full-name">{row.name}</span>
                    </span>
                    {active ? <CheckIcon /> : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="gnb-locale__head">
              <button
                type="button"
                className="gnb-locale__back"
                aria-label={t("back")}
                onClick={() => {
                  setView("home");
                  setQuery("");
                }}
              >
                <BackIcon />
              </button>
              <div className="gnb-locale__head-title">{t("currency")}</div>
            </div>
            <label className="gnb-locale__search">
              <SearchIcon />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("search")}
                aria-label={t("search")}
                autoComplete="off"
              />
            </label>
            {filtered.length === 0 ? (
              <p className="gnb-locale__empty">{t("empty")}</p>
            ) : (
              <div className="gnb-locale__list" role="listbox" aria-label={t("currency")}>
                {filtered.map((row) => {
                  const active = row.code === fx.currency;
                  return (
                    <button
                      key={row.code}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className="gnb-locale__option"
                      onClick={() => choose(row.code)}
                    >
                      <span className="gnb-locale__chip" aria-hidden>
                        {row.chip}
                      </span>
                      <span className="gnb-locale__meta">
                        <span className="gnb-locale__code-name">{row.code}</span>
                        <span className="gnb-locale__full-name">{row.name}</span>
                      </span>
                      {active ? <CheckIcon /> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
            </LocalePanel>,
            document.body,
          )
        : null}
    </div>
  );
}

function LocalePanel({
  panelRef,
  panelId,
  label,
  style,
  children,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
  panelId: string;
  label: string;
  style: { top: number; right: number };
  children: ReactNode;
}) {
  return (
    <div
      ref={panelRef}
      id={panelId}
      role="dialog"
      aria-label={label}
      className="gnb-locale__panel"
      style={style}
    >
      {children}
    </div>
  );
}
