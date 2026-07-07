import { backendFetch, getApiUrl } from "./client";

export type AdminRwaCardRow = {
  tokenId: number;
  certNumber: string | null;
  displayName: string | null;
  displayImageUrl: string | null;
  catalogImageUrl: string | null;
  resolvedImageUrl: string | null;
  collectionKey: string | null;
  orderHash: string | null;
  priceUsdc: number | null;
  offerer: string | null;
  hasActiveListing: boolean;
  burnedAt: string | null;
  vaultCycleStatus: string | null;
};

/** @deprecated use AdminRwaCardRow */
export type AdminListedRwaCardRow = AdminRwaCardRow;

async function parseAdminError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  throw new Error((err as { message?: string }).message ?? fallback);
}

/** Admin: all RWA registry tokens (listed, unlisted, burned). */
export async function getAdminRwaCards(): Promise<{
  items: AdminRwaCardRow[];
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/rwa-tokens/cards`,
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to load cards");
  }
  return res.json() as Promise<{ items: AdminRwaCardRow[] }>;
}

/** @deprecated use getAdminRwaCards */
export async function getAdminListedRwaCards(): Promise<{
  items: AdminRwaCardRow[];
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/rwa-tokens/listings`,
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to load listed cards");
  }
  return res.json() as Promise<{ items: AdminRwaCardRow[] }>;
}

export async function patchAdminRwaToken(
  tokenId: number,
  body: {
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
): Promise<{ imageRef: string | null; httpsUrl: string | null }> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/rwa-tokens/${tokenId}/preview-metadata-image`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
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

/** Admin: on-chain `_burn` via platform owner wallet. */
export async function postAdminBurnRwaToken(
  tokenId: number,
): Promise<{ txHash: string; cancelledOrderHashes: string[] }> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/rwa-tokens/${tokenId}/burn`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to burn token");
  }
  return res.json() as Promise<{ txHash: string; cancelledOrderHashes: string[] }>;
}

export type AdminCustodyNftRow = {
  tokenId: number;
  certNumber: string | null;
  displayName: string | null;
  resolvedImageUrl: string | null;
  onChainOwner: string;
  custodyWallet: string;
  vaultCycleStatus: string | null;
  depositedByUserId: string | null;
  recipientUserEmail: string | null;
  recipientUserName: string | null;
  recipientPrimaryWallet: string | null;
  hasActiveListing: boolean;
  burnedAt: string | null;
};

export async function getAdminCustodyNfts(): Promise<{
  custodyWallet: string;
  items: AdminCustodyNftRow[];
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/rwa-tokens/custody-nfts`,
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to load custody NFTs");
  }
  return res.json() as Promise<{
    custodyWallet: string;
    items: AdminCustodyNftRow[];
  }>;
}

export async function postAdminDeliverRwaToken(
  tokenId: number,
  body?: { recipientAddress?: string | null },
): Promise<{ txHash: string; recipientAddress: string }> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/rwa-tokens/${tokenId}/deliver`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    },
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to deliver NFT");
  }
  return res.json() as Promise<{ txHash: string; recipientAddress: string }>;
}

export type AdminRwaRoleKey =
  | "default_admin"
  | "minter"
  | "burner"
  | "pauser";

export type AdminRwaRolesOverview = {
  chainId: number;
  contractAddress: string;
  adminSignerAddress: string;
  adminSignerHasDefaultAdmin: boolean;
  roles: {
    key: AdminRwaRoleKey;
    label: string;
    description: string;
  }[];
};

export type AdminRwaWalletRoleStatus = {
  walletAddress: string;
  roles: Record<AdminRwaRoleKey, boolean>;
};

export async function getAdminRwaRolesOverview(): Promise<AdminRwaRolesOverview> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/rwa-tokens/roles/overview`,
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to load contract roles overview");
  }
  return res.json() as Promise<AdminRwaRolesOverview>;
}

export async function getAdminRwaWalletRoleStatus(
  wallet: string,
): Promise<AdminRwaWalletRoleStatus> {
  const q = encodeURIComponent(wallet.trim());
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/rwa-tokens/roles/status?wallet=${q}`,
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to load wallet roles");
  }
  return res.json() as Promise<AdminRwaWalletRoleStatus>;
}

export async function postAdminGrantRwaRole(body: {
  walletAddress: string;
  role: AdminRwaRoleKey;
}): Promise<{ txHash: string; role: string; walletAddress: string }> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/rwa-tokens/roles/grant`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to grant role");
  }
  return res.json() as Promise<{
    txHash: string;
    role: string;
    walletAddress: string;
  }>;
}

export async function postAdminRevokeRwaRole(body: {
  walletAddress: string;
  role: AdminRwaRoleKey;
}): Promise<{ txHash: string; role: string; walletAddress: string }> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/rwa-tokens/roles/revoke`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to revoke role");
  }
  return res.json() as Promise<{
    txHash: string;
    role: string;
    walletAddress: string;
  }>;
}
