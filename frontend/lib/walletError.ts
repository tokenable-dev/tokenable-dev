/**
 * MetaMask / wagmi / viem에서 넘어오는 원문 에러를 사용자용 문구로 매핑한다.
 */

export type WalletErrorCode =
  | "USER_REJECTED"
  | "INSUFFICIENT_FUNDS"
  | "NETWORK_MISMATCH"
  | "TIMEOUT"
  | "NONCE"
  | "RATE_LIMIT"
  | "REVERT"
  | "UNKNOWN";

export interface WalletErrorResult {
  code: WalletErrorCode;
  /** UI에 표시할 짧은 문장 */
  message: string;
}

/** Pulls viem / RPC revert reason when present so the UI is not a generic sentence. */
function extractRevertDetail(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const patterns = [
    /reverted with the following reason:\s*\n?\s*([^\n]+)/i,
    /reverted with reason:\s*([^\n]+)/i,
    /Reason:\s*([^\n]+)/i,
    /revert:\s*([^\n]+)/i,
    /details:\s*"([^"]+)"/i,
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

function stringifyUnknown(err: unknown): string {
  if (err == null) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    const c = (err as Error & { cause?: unknown }).cause;
    const causeStr =
      c instanceof Error
        ? c.message
        : typeof c === "object" && c !== null && "message" in c
          ? String((c as { message: unknown }).message)
          : "";
    return `${err.message} ${causeStr}`.trim();
  }
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    const parts = [o.shortMessage, o.message, o.details, o.reason, o.body]
      .filter((x) => typeof x === "string" && x.length > 0)
      .map(String);
    if (parts.length) return parts.join(" ");
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

/**
 * 지갑·트랜잭션 관련 에러를 사용자 친화 문구로 변환한다.
 */
export function mapWalletError(err: unknown): WalletErrorResult {
  const text = stringifyUnknown(err);
  const lower = text.toLowerCase();

  const code =
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 4001
      ? 4001
      : undefined;
  if (code === 4001) {
    return {
      code: "USER_REJECTED",
      message: "Transaction was cancelled in your wallet.",
    };
  }

  if (
    /user rejected|user denied|denied transaction|rejected the request|action rejected|cancelled by user|user rejected signing/i.test(
      text,
    ) ||
    /user rejected|user denied|rejected the request/i.test(lower)
  ) {
    return {
      code: "USER_REJECTED",
      message: "Transaction was cancelled in your wallet.",
    };
  }

  if (/insufficient funds|insufficient funds for gas|exceeds the balance/i.test(lower)) {
    return {
      code: "INSUFFICIENT_FUNDS",
      message:
        "Not enough ETH for gas. Add Sepolia ETH to your wallet and try again.",
    };
  }

  if (
    /wrong network|chain mismatch|switch network|chain id|unrecognized chain|network not supported|please switch|expected chain/i.test(
      lower,
    )
  ) {
    return {
      code: "NETWORK_MISMATCH",
      message: "Wrong network. Switch to Sepolia in your wallet and try again.",
    };
  }

  if (/timeout|timed out|time out|deadline/i.test(lower)) {
    return {
      code: "TIMEOUT",
      message: "Transaction timed out. Try again.",
    };
  }

  if (/nonce|replacement|underpriced|already known/i.test(lower)) {
    return {
      code: "NONCE",
      message:
        "A pending transaction may be blocking this one. Wait for confirmation or reset your wallet.",
    };
  }

  if (/429|rate limit|too many requests/i.test(lower)) {
    return {
      code: "RATE_LIMIT",
      message: "Too many requests. Wait a moment and try again.",
    };
  }

  if (/execution reverted|revert|reverted|requirement failed/i.test(lower)) {
    const detail =
      extractRevertDetail(text) ||
      extractRevertDetail(
        typeof err === "object" && err !== null && "shortMessage" in err
          ? String((err as { shortMessage?: unknown }).shortMessage)
          : ""
      );
    return {
      code: "REVERT",
      message:
        detail ??
        "The contract could not complete this action. Check balances, approvals, and listing status.",
    };
  }

  if (
    /no contract code|returned no data|could not decode|contract not deployed|call exception/i.test(
      lower,
    )
  ) {
    return {
      code: "NETWORK_MISMATCH",
      message:
        "RPC returned no contract data. Confirm you are on Sepolia and that USDC / Seaport addresses match this app’s config.",
    };
  }

  const condensed = text.replace(/\s+/g, " ").trim();
  if (condensed.length > 0) {
    return {
      code: "UNKNOWN",
      message:
        condensed.length <= 360
          ? condensed
          : `${condensed.slice(0, 340)}…`,
    };
  }

  return {
    code: "UNKNOWN",
    message: "Something went wrong. Please try again.",
  };
}
