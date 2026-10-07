"use client";

import { useCallback, useRef, useState } from "react";
import { TkButton } from "@/components/ds";
import type { SlabPhotoIngestResult } from "@/hooks/sell/useSellFlow";
import { SLAB_UPLOAD_ACCEPT, SLAB_UPLOAD_FORMAT_HINT } from "@/lib/vault/mintImageSource";

export type PartnerSlabBulkRow = {
  key: string;
  fileName: string;
  status: "pending" | "analyzing" | "ready" | "error";
  error?: string;
  name?: string;
  cert?: string;
};

type Props = {
  maxCards: number;
  cardCount: number;
  disabled: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSingleSlab: (file: File) => Promise<void>;
  uploadSlabPhotos: (
    files: File[],
    onProgress?: (index: number, total: number, fileName: string) => void,
  ) => Promise<SlabPhotoIngestResult[]>;
};

function ScanIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function rowsFromOutcomes(
  initial: PartnerSlabBulkRow[],
  outcomes: SlabPhotoIngestResult[],
): PartnerSlabBulkRow[] {
  let fileIdx = 0;
  return initial.map((row) => {
    if (row.status === "error" && row.key.startsWith("overflow-")) {
      return row;
    }
    const outcome = outcomes[fileIdx];
    fileIdx += 1;
    if (!outcome) return { ...row, status: "error", error: "Upload failed." };
    if (outcome.ok) {
      return {
        ...row,
        status: "ready",
        name: outcome.name,
        cert: outcome.cert,
      };
    }
    return { ...row, status: "error", error: outcome.error };
  });
}

/** One control: camera or gallery, single or multiple PSA slab photos. */
export function SellFlowPartnerSlabUpload({
  maxCards,
  cardCount,
  disabled,
  inputRef,
  onSingleSlab,
  uploadSlabPhotos,
}: Props) {
  const [rows, setRows] = useState<PartnerSlabBulkRow[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [dragOver, setDragOver] = useState(false);
  const dragDepthRef = useRef(0);

  const clearInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  const runBatch = useCallback(
    async (files: File[]) => {
      const slotsLeft = Math.max(0, maxCards - cardCount);
      if (slotsLeft === 0) return;

      const slice = files.slice(0, slotsLeft);
      const skipped = files.length - slice.length;

      const initial: PartnerSlabBulkRow[] = slice.map((f, i) => ({
        key: `${f.name}-${f.size}-${i}-${Date.now()}`,
        fileName: f.name || `photo-${i + 1}.jpg`,
        status: "pending",
      }));
      if (skipped > 0) {
        initial.push({
          key: `overflow-${Date.now()}`,
          fileName: `${skipped} more file${skipped === 1 ? "" : "s"} skipped`,
          status: "error",
          error: `Max ${maxCards} cards per submission.`,
        });
      }

      setRows(initial);
      setBatchBusy(true);
      setProgress({ current: 0, total: slice.length, label: "Analyzing slab photos" });

      const outcomes = await uploadSlabPhotos(slice, (i, total) => {
        setProgress({
          current: i,
          total,
          label: `Analyzing ${i + 1} of ${total}`,
        });
        setRows((prev) =>
          prev.map((r, idx) => {
            if (idx > slice.length - 1) return r;
            if (idx === i) return { ...r, status: "analyzing" as const };
            return r;
          }),
        );
      });

      setRows((prev) => rowsFromOutcomes(prev, outcomes));
      setProgress({
        current: slice.length,
        total: slice.length,
        label: "Done",
      });
      setBatchBusy(false);
      clearInput();
    },
    [cardCount, maxCards, uploadSlabPhotos, inputRef],
  );

  const onFiles = useCallback(
    async (list: FileList | null) => {
      const files = Array.from(list ?? []);
      if (files.length === 0 || disabled || batchBusy) return;

      if (files.length === 1) {
        setRows([]);
        await onSingleSlab(files[0]!);
        clearInput();
        return;
      }

      await runBatch(files);
    },
    [batchBusy, disabled, onSingleSlab, runBatch],
  );

  const barPct =
    progress.total > 0
      ? Math.min(100, (progress.current / progress.total) * 100)
      : 0;

  const errorCount = rows.filter((r) => r.status === "error").length;
  const readyCount = rows.filter((r) => r.status === "ready").length;
  const showBatchLog = rows.length > 0 && !batchBusy;

  return (
    <div
      className={`sell-flow-partner-slab-upload${dragOver ? " sell-flow-partner-slab-upload--drag" : ""}`}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepthRef.current += 1;
        setDragOver(true);
      }}
      onDragLeave={() => {
        dragDepthRef.current -= 1;
        if (dragDepthRef.current <= 0) {
          dragDepthRef.current = 0;
          setDragOver(false);
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        dragDepthRef.current = 0;
        setDragOver(false);
        void onFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={SLAB_UPLOAD_ACCEPT}
        multiple
        className="sr-only"
        disabled={disabled || batchBusy}
        onChange={(e) => void onFiles(e.target.files)}
      />
      <TkButton
        type="button"
        variant="subtle"
        className="sell-flow-scan-btn sell-flow-partner-btn--ghost sell-flow-partner-scan-slab"
        disabled={disabled || batchBusy}
        onClick={() => inputRef.current?.click()}
      >
        <ScanIcon />
        Scan slab
      </TkButton>
      <p className="sell-flow-slab-upload-hint">
        {SLAB_UPLOAD_FORMAT_HINT} · one or many at once
      </p>

      {batchBusy ? (
        <div
          className="sell-flow-csv-chip sell-flow-csv-chip--loading sell-flow-partner-slab-bulk-progress"
          role="status"
          aria-live="polite"
        >
          <div className="sell-flow-csv-chip__loading-row">
            <span className="sell-flow-csv-spin" aria-hidden />
            <span className="sell-flow-csv-chip__loading-text">{progress.label}</span>
            {progress.total > 0 ? (
              <span className="sell-flow-csv-chip__loading-frac tkl-mono">
                {progress.current}/{progress.total}
              </span>
            ) : null}
          </div>
          <div className="sell-flow-csv-bar">
            <span style={{ width: `${barPct}%` }} />
          </div>
        </div>
      ) : null}

      {showBatchLog ? (
        <div className="sell-flow-partner-slab-bulk-results">
          {readyCount > 0 || errorCount > 0 ? (
            <p className="sell-flow-slab-bulk-summary" role="status">
              {readyCount > 0 ? `${readyCount} added` : null}
              {readyCount > 0 && errorCount > 0 ? " · " : null}
              {errorCount > 0 ? `${errorCount} failed` : null}
            </p>
          ) : null}
          <ul className="sell-flow-slab-bulk-rows">
            {rows.map((row) => (
              <li
                key={row.key}
                className={`sell-flow-slab-bulk-row sell-flow-slab-bulk-row--${row.status}`}
              >
                <span
                  className={`sell-flow-csv-ic sell-flow-csv-ic--${
                    row.status === "ready"
                      ? "ok"
                      : row.status === "error"
                        ? "bad"
                        : "warn"
                  }`}
                  aria-hidden
                >
                  {row.status === "ready" ? "✓" : row.status === "error" ? "!" : "…"}
                </span>
                <span className="sell-flow-slab-bulk-row__file">{row.fileName}</span>
                <span className="sell-flow-slab-bulk-row__detail">
                  {row.status === "ready"
                    ? row.name ?? row.cert
                    : row.status === "error"
                      ? row.error
                      : "Queued"}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="sell-flow-csv-link sell-flow-slab-bulk-clear"
            onClick={() => setRows([])}
          >
            Clear upload log
          </button>
        </div>
      ) : null}
    </div>
  );
}
