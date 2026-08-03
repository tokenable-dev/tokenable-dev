"use client";

import { useState, type FormEvent } from "react";
import { postAdminCreateCatalogCollectionFromCert } from "@/lib/core";
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
        Markets. You can also upload a cover manually on the row below.
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

      {error ? (
        <p className={`mt-3 ${ADMIN_TEXT_ERROR}`} role="alert">
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
