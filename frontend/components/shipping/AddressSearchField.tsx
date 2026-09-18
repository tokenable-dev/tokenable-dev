"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AddressSearchDetails, AddressSearchSuggestion } from "@/lib/core/api/shipping-addresses";
import {
  getAddressAutocomplete,
  getAddressPlace,
} from "@/lib/core/api/shipping-addresses";

function Highlight({ text, q }: { text: string; q: string }) {
  const needle = q.trim();
  const i = needle ? text.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <b>{text.slice(i, i + needle.length)}</b>
      {text.slice(i + needle.length)}
    </>
  );
}

function newSessionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}`;
}

export function AddressSearchField({
  label = "Address",
  disabled = false,
  line1FieldId,
  onPick,
}: {
  label?: string;
  disabled?: boolean;
  line1FieldId?: string;
  onPick: (place: AddressSearchDetails) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef(newSessionToken());
  const [enabled, setEnabled] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AddressSearchSuggestion[]>([]);
  const [blockedNote, setBlockedNote] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getAddressAutocomplete({}).then((res) => {
      if (!cancelled) setEnabled(res.enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled || q.trim().length < 2) {
      setRows([]);
      setOpen(false);
      return;
    }
    const t = window.setTimeout(() => {
      void getAddressAutocomplete({
        q,
        sessionToken: sessionRef.current,
      }).then((res) => {
        setEnabled(res.enabled);
        setRows(res.suggestions);
        setOpen(true);
        setActive(0);
      });
    }, 220);
    return () => window.clearTimeout(t);
  }, [q, enabled]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!enabled) return null;

  const focusManual = () => {
    setOpen(false);
    if (!line1FieldId) return;
    document.getElementById(line1FieldId)?.focus();
  };

  const pick = async (placeId: string) => {
    setOpen(false);
    try {
      const place = await getAddressPlace({
        placeId,
        sessionToken: sessionRef.current,
      });
      sessionRef.current = newSessionToken();
      if (place.blocked) {
        setBlockedNote(
          place.blockedName
            ? `We can’t ship an insured vault package to ${place.blockedName}. Pick another destination, or contact support about a forwarding agent.`
            : "We can’t ship an insured vault package to this destination.",
        );
      } else {
        setBlockedNote(null);
      }
      onPick(place);
      setQ(place.main);
    } catch {
      setBlockedNote(null);
    }
  };

  return (
    <div
      ref={rootRef}
      className={[
        "tka",
        q ? "is-typing" : "",
        open ? "is-open" : "",
        blockedNote ? "is-blocked" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="tka__label">
        {label}
        <button type="button" className="tka__link" onClick={focusManual}>
          Enter manually
        </button>
      </div>
      <div className="tka__field">
        <span className="tka__ic" aria-hidden>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
        </span>
        <input
          className="tka__input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          placeholder="Start typing an address…"
          disabled={disabled}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setBlockedNote(null);
          }}
          onFocus={() => {
            if (q.trim().length >= 2) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && rows[active]) {
              e.preventDefault();
              void pick(rows[active]!.placeId);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          className="tka__clear"
          aria-label="Clear"
          onClick={() => {
            setQ("");
            setRows([]);
            setBlockedNote(null);
            setOpen(false);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>
      <div id={listId} className="tka__panel" role="listbox">
        {open && q.trim().length >= 2 ? (
          <>
            {rows.length > 0 ? (
              rows.map((row, i) => (
                <button
                  key={row.placeId}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={["tka__row", i === active ? "is-active" : ""].join(" ")}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => void pick(row.placeId)}
                >
                  <span className="tka__pin" aria-hidden>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11z" />
                      <circle cx="12" cy="10" r="2.6" />
                    </svg>
                  </span>
                  <span>
                    <span className="tka__main">
                      <Highlight text={row.main} q={q} />
                    </span>
                    {row.sec ? (
                      <span className="tka__sec">{row.sec}</span>
                    ) : null}
                  </span>
                </button>
              ))
            ) : (
              <div className="tka__none">
                No address matches “{q.trim()}”.
                <br />
                Check the spelling, or{" "}
                <button type="button" className="tka__link" onClick={focusManual}>
                  enter it manually
                </button>
                .
              </div>
            )}
            <div className="tka__attr">Powered by Google</div>
          </>
        ) : null}
      </div>
      {blockedNote ? (
        <div className="tka__warn" role="alert">
          <div className="tka__warnt">{blockedNote}</div>
        </div>
      ) : null}
    </div>
  );
}
