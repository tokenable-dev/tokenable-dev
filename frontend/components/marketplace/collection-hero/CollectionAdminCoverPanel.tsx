"use client";

import { useMemo, useState } from "react";
import type { Address } from "viem";
import {
  postAdminCollectionCoverFromToken,
  postAdminDeleteCollection,
  postAdminSetCollectionCover,
} from "@/lib/core";
import { useResolvedMediaUrl } from "@/hooks/media";

export function CollectionAdminCoverPanel({
  collectionKey,
  adminWallet,
  currentCoverUrl,
  listingTokenIds,
  onSaved,
  onDeleted,
}: {
  collectionKey: string;
  adminWallet: Address;
  currentCoverUrl: string | null;
  listingTokenIds: number[];
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [urlInput, setUrlInput] = useState(currentCoverUrl ?? "");
  const [tokenIdInput, setTokenIdInput] = useState(
    listingTokenIds.length > 0 ? String(listingTokenIds[0]) : "",
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"url" | "fetch" | "apply" | "delete" | null>(
    null,
  );
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const deleteKeyMatches =
    deleteConfirm.trim().toLowerCase() === collectionKey.trim().toLowerCase();

  const displayPreview = (previewUrl ?? urlInput.trim()) || null;
  const { url: resolvedPreview, isLoading: previewLoading } =
    useResolvedMediaUrl(displayPreview);

  const tokenOptions = useMemo(() => {
    const u = new Set<number>();
    for (const id of listingTokenIds) {
      if (Number.isFinite(id)) u.add(id);
    }
    return [...u].sort((a, b) => a - b);
  }, [listingTokenIds]);

  async function saveUrl(url: string) {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Enter a cover URL");
      return;
    }
    setBusy("url");
    setError(null);
    try {
      await postAdminSetCollectionCover(collectionKey, {
        adminWallet,
        coverImageUrl: trimmed,
      });
      setUrlInput(trimmed);
      setPreviewUrl(null);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function fetchFromToken(save: boolean) {
    const tid = tokenIdInput.trim();
    if (!tid) {
      setError("Enter a token ID");
      return;
    }
    setBusy(save ? "apply" : "fetch");
    setError(null);
    try {
      const res = await postAdminCollectionCoverFromToken(collectionKey, {
        adminWallet,
        tokenId: tid,
        save,
      });
      if (!res.coverImageUrl) {
        setError("No catalog image resolved for this token");
        setPreviewUrl(null);
        return;
      }
      if (save) {
        setUrlInput(res.coverImageUrl);
        setPreviewUrl(null);
        onSaved();
      } else {
        setPreviewUrl(res.coverImageUrl);
        setUrlInput(res.coverImageUrl);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/[0.06] p-3 sm:p-4"
      aria-label="Admin collection cover"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-amber-200/90">
          Admin · Collection cover
        </h2>
        <span className="font-mono text-[10px] text-amber-200/50">
          {adminWallet.slice(0, 6)}…{adminWallet.slice(-4)}
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-700/80 bg-zinc-900/80 sm:h-32 sm:w-28">
          {displayPreview && resolvedPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedPreview}
              alt=""
              className="max-h-full max-w-full object-contain p-1"
            />
          ) : previewLoading ? (
            <span className="text-[10px] text-zinc-500">Loading…</span>
          ) : (
            <span className="text-[10px] text-zinc-600">No preview</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Cover URL (https or ipfs)
            </span>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setPreviewUrl(null);
              }}
              placeholder="https://…"
              className="w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-950/80 px-2.5 py-2 font-mono text-[11px] text-white outline-none focus:border-amber-500/50"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void saveUrl(urlInput)}
              className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-[11px] font-bold text-[#0a0a0a] hover:bg-amber-400 disabled:opacity-50"
            >
              {busy === "url" ? "Saving…" : "Save URL"}
            </button>
          </div>

          <div className="border-t border-zinc-800/80 pt-3">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              From token metadata
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={tokenIdInput}
                onChange={(e) => setTokenIdInput(e.target.value)}
                placeholder="Token ID"
                className="w-24 rounded-lg border border-zinc-700 bg-zinc-950/80 px-2.5 py-1.5 font-mono text-[11px] text-white outline-none focus:border-amber-500/50"
              />
              {tokenOptions.length > 0 ? (
                <select
                  value={tokenIdInput}
                  onChange={(e) => setTokenIdInput(e.target.value)}
                  className="max-w-[min(100%,12rem)] min-w-0 flex-1 truncate rounded-lg border border-zinc-700 bg-zinc-950/80 px-2 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-amber-500/50"
                >
                  {tokenOptions.map((id) => (
                    <option key={id} value={String(id)}>
                      #{id} (listed)
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                disabled={busy != null}
                onClick={() => void fetchFromToken(false)}
                className="rounded-lg border border-zinc-600 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800/80 disabled:opacity-50"
              >
                {busy === "fetch" ? "Fetching…" : "Preview"}
              </button>
              <button
                type="button"
                disabled={busy != null}
                onClick={() => void fetchFromToken(true)}
                className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
              >
                {busy === "apply" ? "Applying…" : "Fetch & save"}
              </button>
            </div>
          </div>

          {error ? (
            <p className="text-[11px] text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <div className="border-t border-red-900/50 pt-3">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-red-400/90">
              Delete collection
            </span>
            <p className="mb-2 text-[10px] leading-relaxed text-zinc-500">
              Removes market snapshots, all orders, rwa_tokens rows, and the
              collection row. On-chain NFTs are not burned. Type the collection
              key to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={collectionKey.slice(0, 16) + "…"}
              className="mb-2 w-full min-w-0 rounded-lg border border-red-900/60 bg-zinc-950/80 px-2.5 py-2 font-mono text-[10px] text-white outline-none focus:border-red-500/60"
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="button"
              disabled={busy != null || !deleteKeyMatches}
              onClick={() => {
                if (
                  !window.confirm(
                    "Permanently delete this collection from the marketplace database?",
                  )
                ) {
                  return;
                }
                void (async () => {
                  setBusy("delete");
                  setError(null);
                  try {
                    await postAdminDeleteCollection(collectionKey, {
                      adminWallet,
                      confirmCollectionKey: deleteConfirm.trim(),
                    });
                    onDeleted();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Delete failed");
                  } finally {
                    setBusy(null);
                  }
                })();
              }}
              className="rounded-lg border border-red-600/70 bg-red-950/40 px-3 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-900/50 disabled:opacity-40"
            >
              {busy === "delete" ? "Deleting…" : "Delete collection permanently"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
