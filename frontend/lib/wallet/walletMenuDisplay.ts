import type { AuthUser } from "@/lib/auth";
import { isKycComplete } from "@/lib/auth/accountAccess";
import { formatEther } from "viem";

export function shortenWalletAddress(address: string | null | undefined): string {
  const raw = address?.trim() ?? "";
  if (raw.length < 10) return raw || "—";
  return `${raw.slice(0, 4)}…${raw.slice(-4)}`;
}

export type HeaderKycTone = "pos" | "warn" | "muted";

export function formatHeaderKycLabel(user: AuthUser | null | undefined): {
  text: string;
  tone: HeaderKycTone;
} {
  if (!user) return { text: "KYC: —", tone: "muted" };
  if (isKycComplete(user)) {
    return { text: "KYC: ✓ Verified", tone: "pos" };
  }
  if (user.kycStatus === "pending") return { text: "KYC: Pending", tone: "warn" };
  if (user.kycStatus === "rejected") return { text: "KYC: Rejected", tone: "warn" };
  return { text: "KYC: Not verified", tone: "muted" };
}

export function formatNativeBalanceLabel(
  value: bigint | undefined,
  symbol = "ETH",
): string {
  if (value === undefined) return `— ${symbol}`;
  const n = Number(formatEther(value));
  if (!Number.isFinite(n)) return `— ${symbol}`;
  return `${n.toFixed(2)} ${symbol}`;
}
