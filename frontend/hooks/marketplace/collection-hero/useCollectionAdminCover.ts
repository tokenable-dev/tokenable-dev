"use client";

import { useState } from "react";
import type { Address } from "viem";
import {
  postAdminCollectionCoverFromToken,
  postAdminDeleteCollection,
  postAdminSetCollectionCover,
} from "@/lib/core";

export type AdminCoverBusyState = "url" | "fetch" | "apply" | "delete" | null;

/**
 * Centralises the three admin cover mutations for a collection:
 * - save a cover URL
 * - resolve cover from a token's on-chain metadata (optionally persist)
 * - permanently delete the collection
 *
 * The hook owns `busy` and `error` state so the component only deals
 * with UI-level state (inputs, preview, delete-confirm).
 */
export function useCollectionAdminCover({
  collectionKey,
  adminWallet,
  onSaved,
  onDeleted,
}: {
  collectionKey: string;
  adminWallet: Address;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState<AdminCoverBusyState>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Persist a cover image URL. Returns `true` on success so the component
   * can update its own `urlInput` / `previewUrl` state accordingly.
   */
  async function saveCoverUrl(url: string): Promise<boolean> {
    setBusy("url");
    setError(null);
    try {
      await postAdminSetCollectionCover(collectionKey, {
        adminWallet,
        coverImageUrl: url,
      });
      onSaved();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setBusy(null);
    }
  }

  /**
   * Resolve a cover image from token metadata.
   * `save: true` also persists the result and fires `onSaved`.
   * Returns the resolved `coverImageUrl` string on success, or `null` on failure.
   */
  async function fetchCoverFromToken(
    tokenId: string,
    save: boolean,
  ): Promise<string | null> {
    setBusy(save ? "apply" : "fetch");
    setError(null);
    try {
      const res = await postAdminCollectionCoverFromToken(collectionKey, {
        adminWallet,
        tokenId,
        save,
      });
      if (!res.coverImageUrl) {
        setError("No catalog image resolved for this token");
        return null;
      }
      if (save) onSaved();
      return res.coverImageUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
      return null;
    } finally {
      setBusy(null);
    }
  }

  /**
   * Permanently delete the collection from the marketplace database.
   * Requires `confirmKey === collectionKey` (validated by the caller).
   */
  async function deleteCollection(confirmKey: string): Promise<void> {
    setBusy("delete");
    setError(null);
    try {
      await postAdminDeleteCollection(collectionKey, {
        adminWallet,
        confirmCollectionKey: confirmKey,
      });
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  return { busy, error, setError, saveCoverUrl, fetchCoverFromToken, deleteCollection };
}
