import { backendFetch, getApiUrl } from "@/lib/core/api/client";
import type { SupportedChainId } from "@/lib/chains/types";

export const PARTNER_VAULT_MINT_JOB_STORAGE_KEY = "tk_partner_vault_mint_job_id";

export type PartnerVaultMintJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type PartnerVaultMintJobView = {
  id: string;
  status: PartnerVaultMintJobStatus;
  chainId: number;
  itemCount: number;
  processedCount: number;
  succeededCount: number;
  failedCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    certNumber: string;
    status: string;
    displayName: string | null;
    tokenId: string | null;
    errorMessage: string | null;
  }>;
};

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  const body = err as { message?: string | string[] };
  const msg = Array.isArray(body.message)
    ? body.message.join(", ")
    : body.message;
  throw new Error(msg ?? fallback);
}

export async function createPartnerVaultMintJob(
  certNumbers: string[],
  chainId: SupportedChainId,
  recipientAddress?: string,
): Promise<PartnerVaultMintJobView> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/partners/me/vault-mint-jobs`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tokenable-chain-id": String(chainId),
      },
      body: JSON.stringify({
        certNumbers,
        ...(recipientAddress ? { recipientAddress } : {}),
      }),
    },
  );
  if (!res.ok) await parseError(res, "Failed to start vault mint");
  return res.json() as Promise<PartnerVaultMintJobView>;
}

export async function getPartnerVaultMintJob(
  jobId: string,
): Promise<PartnerVaultMintJobView> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/partners/me/vault-mint-jobs/${encodeURIComponent(jobId)}`,
  );
  if (!res.ok) await parseError(res, "Failed to load mint job");
  return res.json() as Promise<PartnerVaultMintJobView>;
}

export function persistPartnerVaultMintJobId(jobId: string): void {
  try {
    localStorage.setItem(PARTNER_VAULT_MINT_JOB_STORAGE_KEY, jobId);
  } catch {
    /* ignore */
  }
}

export function readPartnerVaultMintJobId(): string | null {
  try {
    return localStorage.getItem(PARTNER_VAULT_MINT_JOB_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPartnerVaultMintJobId(): void {
  try {
    localStorage.removeItem(PARTNER_VAULT_MINT_JOB_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
