/**
 * MetaMask / wagmi / viem에서 넘어오는 원문 에러를 사용자용 문구로 매핑한다.
 */

import { ContractFunctionRevertedError } from "viem";

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
    /reverted with the following signature:\s*\n?\s*([^\n]+)/i,
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

/** Walks `cause` chain so nested viem errors aren’t lost (MetaMask / wagmi often wrap deeply). */
function walkCollectErrorText(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  for (let d = 0; d < 14 && cur != null; d++) {
    if (cur instanceof Error && cur.message) parts.push(cur.message);
    if (typeof cur === "object" && cur !== null) {
      const o = cur as Record<string, unknown>;
      if (typeof o.shortMessage === "string" && o.shortMessage.trim())
        parts.push(o.shortMessage.trim());
      if (typeof o.details === "string" && o.details.trim()) parts.push(o.details.trim());
      if (Array.isArray(o.metaMessages)) {
        for (const m of o.metaMessages) {
          if (typeof m === "string" && m.trim() && !m.startsWith("Docs:")) parts.push(m.trim());
        }
      }
    }
    cur =
      typeof cur === "object" && cur !== null && "cause" in cur
        ? (cur as { cause: unknown }).cause
        : null;
  }
  return parts.join("\n");
}

function extractViemContractRevertReason(err: unknown): string | null {
  let cur: unknown = err;
  for (let d = 0; d < 14 && cur != null; d++) {
    if (cur instanceof ContractFunctionRevertedError) {
      if (cur.reason && cur.reason.toLowerCase() !== "execution reverted") return cur.reason;
      const data = cur.data as
        | { errorName?: string; args?: readonly unknown[] }
        | undefined;
      if (data?.errorName) {
        if (
          data.errorName === "Error" &&
          Array.isArray(data.args) &&
          data.args[0] != null
        ) {
          return String(data.args[0]);
        }
        if (Array.isArray(data.args) && data.args.length > 0) {
          return `${data.errorName}(${data.args.map(String).join(", ")})`;
        }
        return data.errorName;
      }
      if (cur.signature) return `Revert data ${String(cur.signature).slice(0, 18)}… (custom error)`;
    }
    cur =
      typeof cur === "object" && cur !== null && "cause" in cur
        ? (cur as { cause: unknown }).cause
        : null;
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

  /**
   * HTTP 429 / rate limit만 매칭. `/429/` 단독 사용 금지 — 에러 본문·해시·가스값(예: …214291…)에
   * 우연히 포함된 "429"가 실제 rate limit로 오인되어 사용자가 진행 불가로 막히는 문제가 있음.
   */
  if (
    /rate limit|too many requests|throttl/i.test(lower) ||
    /\b429\b/.test(lower) ||
    /status\s*(code)?\s*[:=]\s*429\b/.test(lower)
  ) {
    return {
      code: "RATE_LIMIT",
      message: "Too many requests. Wait a moment and try again.",
    };
  }

  if (/execution reverted|revert|reverted|requirement failed/i.test(lower)) {
    const walked = walkCollectErrorText(err);
    const detail =
      extractRevertDetail(text) ||
      extractViemContractRevertReason(err) ||
      extractRevertDetail(walked) ||
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

  return {
    code: "UNKNOWN",
    message: "Something went wrong. Please try again.",
  };
}
