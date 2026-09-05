"use client";

import { useState } from "react";
import {
  postAdminCollectionCoverFromToken,
  postAdminDeleteCollection,
  postAdminSetCollectionCover,
  postAdminUploadCollectionCover,
} from "@/lib/core";

export type AdminCoverBusyState =
  | "url"
  | "upload"
  | "fetch"
  | "apply"
  | "delete"
  | null;

export function useCollectionAdminCover({
  collectionKey,
  onSaved,
  onDeleted,
}: {
  collectionKey: string;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState<AdminCoverBusyState>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveCoverUrl(url: string): Promise<boolean> {
    setBusy("url");
    setError(null);
    try {
      await postAdminSetCollectionCover(collectionKey, {
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

  async function uploadCoverFile(file: File): Promise<string | null> {
    setBusy("upload");
    setError(null);
    try {
      const res = await postAdminUploadCollectionCover(collectionKey, file);
      onSaved();
      return res.coverImageUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function fetchCoverFromToken(
    tokenId: string,
    save: boolean,
  ): Promise<string | null> {
    setBusy(save ? "apply" : "fetch");
    setError(null);
    try {
      const res = await postAdminCollectionCoverFromToken(collectionKey, {
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

  async function deleteCollection(confirmKey: string): Promise<void> {
    setBusy("delete");
    setError(null);
    try {
      await postAdminDeleteCollection(collectionKey, {
        confirmCollectionKey: confirmKey,
      });
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  return {
    busy,
    error,
    setError,
    saveCoverUrl,
    uploadCoverFile,
    fetchCoverFromToken,
    deleteCollection,
  };
}
