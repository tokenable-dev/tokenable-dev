"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TkButton } from "@/components/ds";
import type { SellFlowCard } from "@/hooks/sell/useSellFlow";
import {
  downloadPartnerExcelTemplate,
  downloadPartnerUnresolvedCerts,
  parsePartnerBulkCertFile,
  PARTNER_BULK_UPLOAD_ACCEPT,
} from "@/lib/sell/partnerBulkCertUpload";
import {
  PARTNER_CSV_ERROR_BADGE,
  partnerCsvErrorHint,
  type PartnerCsvErrorKind,
} from "@/lib/sell/partnerCsvLookup";

export type PartnerCsvRow = {
  cert: string;
  status: "pending" | "looking" | "ready" | "error";
  name?: string;
  /** Set when status is `error` — drives the right-hand badge only. */
  errorKind?: PartnerCsvErrorKind;
};

type CsvFilter = "all" | "ready" | "fix";

type Props = {
  maxCards: number;
  cards: SellFlowCard[];
  csvRows: PartnerCsvRow[];
  onCsvRowsChange: (rows: PartnerCsvRow[]) => void;
  csvFileName: string | null;
  onCsvFileNameChange: (name: string | null) => void;
  csvParseError: string | null;
  onCsvParseErrorChange: (msg: string | null) => void;
  csvLookupBusy: boolean;
  onCsvLookupBusyChange: (busy: boolean) => void;
  lookupCertByNumber: (
    cert: string,
  ) => Promise<
    | { ok: true; name: string }
    | { ok: false; errorKind: PartnerCsvErrorKind; name?: string }
  >;
  mintBusy: boolean;
  mintError: string | null;
  canMint: boolean;
  onMint: () => void;
  onSaveDraft: () => void;
  draftSavedFlash: boolean;
  onRemoveCert?: (cert: string) => void;
  /** `picker` = drop zone inside glass; `workspace` = list + mint below glass. */
  section: "picker" | "workspace";
};

function UploadArrowIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3 4 11h5v10h6V11h5z" />
    </svg>
  );
}

export function SellFlowPartnerCsvSection({
  maxCards,
  cards,
  csvRows,
  onCsvRowsChange,
  csvFileName,
  onCsvFileNameChange,
  csvParseError,
  onCsvParseErrorChange,
  csvLookupBusy,
  onCsvLookupBusyChange,
  lookupCertByNumber,
  mintBusy,
  mintError,
  canMint,
  onMint,
  onSaveDraft,
  draftSavedFlash,
  onRemoveCert,
  section,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [csvFilter, setCsvFilter] = useState<CsvFilter>("all");
  const [lookupProgress, setLookupProgress] = useState({
    current: 0,
    total: 0,
    label: "Reading file",
  });

  const readyCount = csvRows.filter((r) => r.status === "ready").length;
  const errorCount = csvRows.filter((r) => r.status === "error").length;
  const runLookups = useCallback(
    async (certs: string[]) => {
      if (csvLookupBusy) return;
      onCsvLookupBusyChange(true);
      onCsvParseErrorChange(null);
      setLookupProgress({
        current: 0,
        total: certs.length,
        label: "Looking up cert numbers",
      });
      let rows: PartnerCsvRow[] = certs.map((cert) => ({
        cert,
        status: "pending",
      }));
      onCsvRowsChange(rows);

      for (let i = 0; i < certs.length; i++) {
        const cert = certs[i]!;
        setLookupProgress({
          current: i,
          total: certs.length,
          label: `Looking up cert ${i + 1} of ${certs.length}`,
        });
        rows = rows.map((r) =>
          r.cert === cert ? { ...r, status: "looking" as const } : r,
        );
        onCsvRowsChange([...rows]);

        const res = await lookupCertByNumber(cert);
        rows = rows.map((r) => {
          if (r.cert !== cert) return r;
          if (res.ok) {
            return {
              ...r,
              status: "ready" as const,
              name: res.name,
              errorKind: undefined,
            };
          }
          return {
            ...r,
            status: "error" as const,
            name: res.name,
            errorKind: res.errorKind,
          };
        });
        onCsvRowsChange([...rows]);
      }
      setLookupProgress({
        current: certs.length,
        total: certs.length,
        label: "Done",
      });
      onCsvLookupBusyChange(false);
    },
    [
      csvLookupBusy,
      lookupCertByNumber,
      onCsvLookupBusyChange,
      onCsvParseErrorChange,
      onCsvRowsChange,
    ],
  );

  const ingestFile = useCallback(
    async (file: File) => {
      onCsvParseErrorChange(null);
      setLookupProgress({ current: 0, total: 0, label: "Reading file" });
      onCsvLookupBusyChange(true);
      let certs: string[];
      try {
        certs = await parsePartnerBulkCertFile(file);
      } catch (e) {
        onCsvLookupBusyChange(false);
        onCsvParseErrorChange(
          e instanceof Error ? e.message : "Could not read this file.",
        );
        return;
      }
      if (!certs.length) {
        onCsvLookupBusyChange(false);
        onCsvParseErrorChange(
          "No valid cert numbers found. Use one cert per row in column A (7–10 digits).",
        );
        return;
      }
      if (certs.length > maxCards) {
        onCsvLookupBusyChange(false);
        onCsvParseErrorChange(
          `This file has ${certs.length} certs. Max ${maxCards} per upload.`,
        );
        return;
      }
      onCsvFileNameChange(file.name);
      void runLookups(certs);
    },
    [
      maxCards,
      onCsvFileNameChange,
      onCsvLookupBusyChange,
      onCsvParseErrorChange,
      runLookups,
    ],
  );

  const onFileChange = (file: File | null) => {
    if (!file) return;
    void ingestFile(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const clearFile = () => {
    onCsvFileNameChange(null);
    onCsvRowsChange([]);
    onCsvParseErrorChange(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const validCount = readyCount;

  const filteredRows = useMemo(() => {
    if (csvFilter === "ready") {
      return csvRows.filter((r) => r.status === "ready");
    }
    if (csvFilter === "fix") {
      return csvRows.filter((r) => r.status === "error");
    }
    return csvRows;
  }, [csvFilter, csvRows]);

  useEffect(() => {
    if (csvFilter === "fix" && errorCount === 0) {
      setCsvFilter("all");
    }
  }, [csvFilter, errorCount]);

  const unresolvedCerts = useMemo(
    () => csvRows.filter((r) => r.status === "error").map((r) => r.cert),
    [csvRows],
  );

  const lookupBarPct =
    lookupProgress.total > 0
      ? Math.min(
          100,
          (lookupProgress.current / lookupProgress.total) * 100,
        )
      : lookupProgress.label === "Reading file"
        ? 35
        : 0;

  const listCount = cards.length > 0 ? cards.length : validCount;

  if (section === "picker") {
    return (
      <div className="sell-flow-partner-csv-upload">
        {csvLookupBusy && !csvFileName ? (
          <div
            className="sell-flow-csv-chip sell-flow-csv-chip--loading"
            role="status"
            aria-live="polite"
          >
            <div className="sell-flow-csv-chip__loading-row">
              <span className="sell-flow-csv-spin" aria-hidden />
              <span className="sell-flow-csv-chip__loading-text">
                {lookupProgress.label}
              </span>
              {lookupProgress.total > 0 ? (
                <span className="sell-flow-csv-chip__loading-frac tkl-mono">
                  {lookupProgress.current}/{lookupProgress.total}
                </span>
              ) : null}
            </div>
            <div className="sell-flow-csv-bar">
              <span style={{ width: `${lookupBarPct}%` }} />
            </div>
          </div>
        ) : !csvFileName ? (
          <label
            className={`sell-flow-csv-drop${dragOver ? " sell-flow-csv-drop--drag" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onFileChange(f);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept={PARTNER_BULK_UPLOAD_ACCEPT}
              className="sr-only"
              disabled={csvLookupBusy || mintBusy}
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
            <span className="sell-flow-csv-drop__ic" aria-hidden>
              <UploadArrowIcon />
            </span>
            <div className="sell-flow-csv-drop__t">
              Drop your CSV here or{" "}
              <span className="sell-flow-csv-drop__browse">browse</span>
            </div>
            <div className="sell-flow-csv-drop__d">
              One cert number per row, up to{" "}
              <span className="tkl-mono">{maxCards}</span>.
            </div>
            <button
              type="button"
              className="sell-flow-csv-link sell-flow-csv-drop__template"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void downloadPartnerExcelTemplate();
              }}
            >
              Download Excel template
            </button>
          </label>
        ) : csvLookupBusy ? (
          <div
            className="sell-flow-csv-chip sell-flow-csv-chip--loading"
            role="status"
            aria-live="polite"
          >
            <div className="sell-flow-csv-chip__loading-row">
              <span className="sell-flow-csv-spin" aria-hidden />
              <span className="sell-flow-csv-chip__loading-text">
                {lookupProgress.label}
              </span>
              <span className="sell-flow-csv-chip__loading-frac tkl-mono">
                {lookupProgress.current}/{lookupProgress.total || "…"}
              </span>
            </div>
            <div className="sell-flow-csv-bar">
              <span style={{ width: `${lookupBarPct}%` }} />
            </div>
          </div>
        ) : (
          <div className="sell-flow-csv-chip">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
              className="sell-flow-csv-chip__icon"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <div className="sell-flow-csv-chip__meta">
              <div className="sell-flow-csv-chip__name">{csvFileName}</div>
              <div className="sell-flow-csv-chip__stat">
                <span className="tkl-mono">{csvRows.length}</span> rows ·{" "}
                <span className="tkl-mono">{validCount}</span> valid ·{" "}
                <span className="tkl-mono">{errorCount}</span> need attention
              </div>
            </div>
            <TkButton
              type="button"
              variant="subtle"
              className="sell-flow-partner-btn--ghost sell-flow-csv-chip__replace"
              disabled={csvLookupBusy || mintBusy}
              onClick={() => fileRef.current?.click()}
            >
              Replace
            </TkButton>
            <button
              type="button"
              className="sell-flow-csv-clear"
              aria-label="Remove file"
              title="Remove file"
              disabled={mintBusy}
              onClick={clearFile}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={PARTNER_BULK_UPLOAD_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
          </div>
        )}
        {csvParseError ? (
          <p className="sell-flow-partner-cert-error" role="alert">
            {csvParseError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="sell-flow-partner-csv-section">
      <div className="sell-flow-partner-csv-listwrap">
        <div className="sell-flow-csv-list-header">
          <div className="sell-flow-cards-title">
            Your cards{" "}
            <span className="sell-flow-cards-count">
              (
              <span className="tkl-mono">{listCount}</span> of{" "}
              <span className="tkl-mono">{maxCards}</span>)
            </span>
          </div>
          {csvRows.length > 0 ? (
            <div
              className="sell-flow-csv-badges"
              role="tablist"
              aria-label="Filter cards"
            >
              <button
                type="button"
                role="tab"
                className={`sell-flow-csv-badge sell-flow-csv-badge--filter${csvFilter === "all" ? " sell-flow-csv-badge--on" : ""}`}
                aria-selected={csvFilter === "all"}
                onClick={() => setCsvFilter("all")}
              >
                All <span className="tkl-mono">{csvRows.length}</span>
              </button>
              {validCount > 0 ? (
                <button
                  type="button"
                  role="tab"
                  className={`sell-flow-csv-badge sell-flow-csv-badge--filter sell-flow-csv-badge--ok${csvFilter === "ready" ? " sell-flow-csv-badge--on" : ""}`}
                  aria-selected={csvFilter === "ready"}
                  onClick={() => setCsvFilter("ready")}
                >
                  ✓ Ready <span className="tkl-mono">{validCount}</span>
                </button>
              ) : null}
              {errorCount > 0 ? (
                <button
                  type="button"
                  role="tab"
                  className={`sell-flow-csv-badge sell-flow-csv-badge--filter sell-flow-csv-badge--warn${csvFilter === "fix" ? " sell-flow-csv-badge--on" : ""}`}
                  aria-selected={csvFilter === "fix"}
                  onClick={() => setCsvFilter("fix")}
                >
                  ! To fix <span className="tkl-mono">{errorCount}</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="sell-flow-csv-box">
          {csvRows.length === 0 ? (
            <div className="sell-flow-cards-empty">No cards yet.</div>
          ) : filteredRows.length === 0 ? (
            <div className="sell-flow-cards-empty">No cards in this filter.</div>
          ) : (
            <ul className="sell-flow-csv-rows">
              {filteredRows.map((row) => {
                const errorBadge =
                  row.errorKind != null
                    ? PARTNER_CSV_ERROR_BADGE[row.errorKind]
                    : "Error";
                const centerLabel =
                  row.status === "looking"
                    ? "Looking up…"
                    : row.status === "pending"
                      ? "Queued"
                      : row.status === "error"
                        ? row.name?.trim() || "Unknown card"
                        : row.name ??
                          cards.find((c) => c.cert === row.cert)?.name ??
                          "Ready";
                const rowHint =
                  row.status === "error" && row.errorKind
                    ? partnerCsvErrorHint(row.errorKind)
                    : undefined;

                return (
                <li
                  key={row.cert}
                  className={`sell-flow-csv-row${row.status === "error" ? " sell-flow-csv-row--bad" : ""}`}
                  aria-label={
                    rowHint ? `${centerLabel}. ${rowHint}` : undefined
                  }
                >
                  <span
                    className={`sell-flow-csv-ic sell-flow-csv-ic--${row.status === "ready" ? "ok" : row.status === "error" ? "bad" : "warn"}`}
                    aria-hidden
                  >
                    {row.status === "ready"
                      ? "✓"
                      : row.status === "error"
                        ? "✕"
                        : "…"}
                  </span>
                  <span className="sell-flow-csv-cert tkl-mono">{row.cert}</span>
                  <span className="sell-flow-csv-nm">{centerLabel}</span>
                  {row.status === "error" ? (
                    <span
                      className={`sell-flow-csv-tag${
                        row.errorKind === "grade_not_accepted" ||
                        row.errorKind === "rate_limit"
                          ? " sell-flow-csv-tag--warn"
                          : " sell-flow-csv-tag--bad"
                      }`}
                    >
                      {errorBadge}
                    </span>
                  ) : row.status === "pending" || row.status === "looking" ? (
                    <span className="sell-flow-csv-tag sell-flow-csv-tag--warn">
                      Pending
                    </span>
                  ) : (
                    <span aria-hidden />
                  )}
                  {onRemoveCert && row.status === "error" ? (
                    <div className="sell-flow-csv-acts">
                      <button
                        type="button"
                        className="sell-flow-csv-act sell-flow-csv-act--rm"
                        onClick={() => {
                          onRemoveCert(row.cert);
                          onCsvRowsChange(
                            csvRows.filter((r) => r.cert !== row.cert),
                          );
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <span aria-hidden />
                  )}
                </li>
              );
              })}
            </ul>
          )}
        </div>
        {errorCount > 0 && csvRows.length > 0 && !csvLookupBusy ? (
          <div className="sell-flow-csv-strip" role="status">
            <span>
              <span className="tkl-mono">{errorCount}</span> card
              {errorCount === 1 ? "" : "s"} won&apos;t mint. Fix them in your file
              or remove them.
            </span>
            <button
              type="button"
              className="sell-flow-csv-link"
              onClick={() => downloadPartnerUnresolvedCerts(unresolvedCerts)}
            >
              Download unresolved (
              <span className="tkl-mono">{errorCount}</span>)
            </button>
          </div>
        ) : null}
      </div>

      {mintError ? (
        <p className="sell-flow-mint-error" role="alert">{mintError}</p>
      ) : null}

      {draftSavedFlash ? (
        <p className="sell-flow-csv-toast" role="status">
          Draft saved. {cards.length} cert numbers kept.
        </p>
      ) : null}

      <div className="sell-flow-partner-cta sell-flow-partner-cta--csv">
        <TkButton
          type="button"
          variant="subtle"
          className="sell-flow-partner-btn--ghost sell-flow-csv-draft-btn"
          disabled={mintBusy || csvRows.length === 0}
          onClick={onSaveDraft}
        >
          {draftSavedFlash ? "Saved" : "Save as draft"}
        </TkButton>
        <TkButton
          type="button"
          variant="primary"
          className="sell-flow-partner-register sell-flow-partner-btn--primary sell-flow-csv-mint-btn"
          disabled={!canMint || mintBusy || csvLookupBusy}
          onClick={onMint}
        >
          {mintBusy ? (
            <>
              <span className="sell-flow-spinner" aria-hidden /> Minting…
            </>
          ) : validCount > 0 ? (
            <>
              Mint <span className="tkl-mono">{validCount}</span> to collection{" "}
              <span aria-hidden>→</span>
            </>
          ) : (
            <>
              Mint to collection <span aria-hidden>→</span>
            </>
          )}
        </TkButton>
      </div>
    </div>
  );
}
