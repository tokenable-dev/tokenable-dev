import { backendFetch, getApiUrl } from "./client";

export type AdminListedRwaCardRow = {
  tokenId: number;
  orderHash: string;
  collectionKey: string | null;
  priceUsdc: number;
  displayName: string | null;
  certNumber: string | null;
  displayImageUrl: string | null;
  catalogImageUrl: string | null;
  resolvedImageUrl: string | null;
  offerer: string;
};

async function parseAdminError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  throw new Error((err as { message?: string }).message ?? fallback);
}

/** Admin: all active ask listings with registry + image fields. */
export async function getAdminListedRwaCards(adminWallet: string): Promise<{
  items: AdminListedRwaCardRow[];
}> {
  const q = new URLSearchParams({ adminWallet });
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/rwa-tokens/listings?${q}`,
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to load listed cards");
  }
  return res.json() as Promise<{ items: AdminListedRwaCardRow[] }>;
}

export async function patchAdminRwaToken(
  tokenId: number,
  body: {
    adminWallet: string;
    displayImageUrl?: string | null;
    displayName?: string | null;
    collectionKey?: string | null;
  },
): Promise<{
  tokenId: number;
  displayName: string | null;
  displayImageUrl: string | null;
  collectionKey: string | null;
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/rwa-tokens/${tokenId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to update card");
  }
  return res.json() as Promise<{
    tokenId: number;
    displayName: string | null;
    displayImageUrl: string | null;
    collectionKey: string | null;
  }>;
}

export async function postAdminPreviewRwaMetadataImage(
  tokenId: number,
  body: { adminWallet: string },
): Promise<{ imageRef: string | null; httpsUrl: string | null }> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/rwa-tokens/${tokenId}/preview-metadata-image`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to preview metadata image");
  }
  return res.json() as Promise<{
    imageRef: string | null;
    httpsUrl: string | null;
  }>;
}
