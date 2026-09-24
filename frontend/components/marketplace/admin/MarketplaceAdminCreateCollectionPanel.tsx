"use client";

import { useState, type FormEvent } from "react";
import {
  postAdminCreateCatalogCollectionFromCert,
  type AdminCatalogCollectionCreateResult,
} from "@/lib/core";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_INPUT_MONO,
  ADMIN_LABEL,
  ADMIN_TEXT_ERROR,
  ADMIN_TEXT_META,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";

export function MarketplaceAdminCreateCollectionPanel({
  onCreated,
}: {
  onCreated: (result: {
    collectionKey: string;
    created: boolean;
    displayLabel: string;
  }) => void | Promise<void>;
}) {
  const [cert, setCert] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [batchInput, setBatchInput] = useState("");
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchRows, setBatchRows] = useState<
    Array<{
      cert: string;
      ok: boolean;
      detail: string;
    }>
  >([]);

  function parseCertList(raw: string): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of raw.match(/\d{7,10}/g) ?? []) {
      if (seen.has(m)) continue;
      seen.add(m);
      out.push(m);
    }
    return out;
  }

  async function runBatchTest() {
    const certs = parseCertList(batchInput);
    if (certs.length === 0) {
      setError("Paste one or more PSA cert numbers (7–10 digits).");
      return;
    }
    if (certs.length > 200) {
      setError("Batch limit is 200 certs per run.");
      return;
    }
    setBatchBusy(true);
    setError(null);
    setSuccess(null);
    setBatchRows([]);
    const rows: Array<{ cert: string; ok: boolean; detail: string }> = [];
    let lastOk: AdminCatalogCollectionCreateResult | null = null;
    try {
      for (let i = 0; i < certs.length; i++) {
        const certNumber = certs[i];
        try {
          const result = await postAdminCreateCatalogCollectionFromCert({
            certNumber,
          });
          lastOk = result;
          const detail = result.created
            ? `created · ${result.reviewStatus}`
            : `already exists · ${result.reviewStatus}`;
          rows.push({ cert: certNumber, ok: true, detail });
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : "Create failed (unknown error)";
          rows.push({ cert: certNumber, ok: false, detail: msg });
        }
        setBatchRows([...rows]);
        if (i < certs.length - 1) {
          await new Promise((r) => setTimeout(r, 350));
        }
      }
      const failed = rows.filter((r) => !r.ok).length;
      const passed = rows.length - failed;
      setSuccess(
        `Batch done: ${passed} ok, ${failed} failed (of ${rows.length}).` +
          (failed === 0 && lastOk ? " Open Pending review to approve new rows." : ""),
      );
      if (lastOk && failed < rows.length) {
        await onCreated(lastOk);
      }
    } finally {
      setBatchBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const certNumber = cert.replace(/\D/g, "");
    if (!/^\d{7,10}$/.test(certNumber)) {
      setError("Enter a PSA cert number (7–10 digits).");
      setSuccess(null);
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await postAdminCreateCatalogCollectionFromCert({
        certNumber,
      });
      const coverNote = result.coverImageUrl
        ? " Cardhedger cover saved to S3."
        : " No Cardhedger cover found — upload one on the row below, then Approve.";
      setSuccess(
        result.created
          ? `Created “${result.displayLabel}” — pending review.${coverNote}`
          : `Collection already exists: “${result.displayLabel}” (${result.reviewStatus}).${
              result.coverImageUrl ? "" : coverNote
            }`,
      );
      setCert("");
      await onCreated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`${ADMIN_ARTICLE} mb-6`}>
      <h2 className="text-base font-semibold text-zinc-900">
        Create collection from PSA cert
      </h2>
      <p className={`mt-1 text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
        No mint or listing required. Looks up the cert on PSA, pulls a Cardhedger
        catalog image into S3 when available, creates a marketplace bucket as{" "}
        <span className="font-medium">Pending review</span>, then you Approve for
        Markets. Bids can be placed before any copy is minted; sellers can fill
        only after a card is minted and the bidder updates that offer. You can
        also upload a cover manually on the row below.
      </p>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <label className="min-w-0 flex-1">
          <span className={ADMIN_LABEL}>PSA cert number</span>
          <input
            className={ADMIN_INPUT_MONO}
            inputMode="numeric"
            autoComplete="off"
            placeholder="83179580"
            value={cert}
            disabled={busy}
            onChange={(e) => setCert(e.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className={ADMIN_BTN_PRIMARY}
          >
            {busy ? "Creating…" : "Create collection"}
          </button>
          <button
            type="button"
            disabled={busy || !cert}
            className={ADMIN_BTN_SECONDARY}
            onClick={() => {
              setCert("");
              setError(null);
              setSuccess(null);
            }}
          >
            Clear
          </button>
        </div>
      </form>

      <details className="mt-6 border-t border-zinc-200 pt-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-800">
          Batch create test (paste many certs)
        </summary>
        <p className={`mt-2 text-xs leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
          Runs create-from-cert for each number (whitespace / line breaks ok).
          Failures show the API message (PSA, graded identity, auth). ~350ms
          between calls to respect PSA rate limits.
        </p>
        <textarea
          className={`mt-2 min-h-[120px] w-full ${ADMIN_INPUT_MONO} text-sm`}
          placeholder="161820328 137244794 …"
          value={batchInput}
          disabled={batchBusy || busy}
          onChange={(e) => setBatchInput(e.target.value)}
        />
        <button
          type="button"
          disabled={batchBusy || busy || !batchInput.trim()}
          className={`mt-2 ${ADMIN_BTN_SECONDARY}`}
          onClick={() => void runBatchTest()}
        >
          {batchBusy ? "Running batch…" : "Run batch create test"}
        </button>
        {batchRows.length > 0 ? (
          <div className="mt-3 max-h-64 overflow-auto rounded-md border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-2 py-1 font-medium">Cert</th>
                  <th className="px-2 py-1 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {batchRows.map((row) => (
                  <tr key={row.cert} className="border-t border-zinc-100">
                    <td className="px-2 py-1 font-mono">{row.cert}</td>
                    <td
                      className={`px-2 py-1 ${
                        row.ok ? "text-zinc-700" : ADMIN_TEXT_ERROR
                      }`}
                    >
                      {row.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </details>

      {error ? (
        <p className={`mt-3 whitespace-pre-wrap ${ADMIN_TEXT_ERROR}`} role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className={`mt-3 text-sm ${ADMIN_TEXT_META}`} role="status">
          {success}
        </p>
      ) : null}
    </article>
  );
}
