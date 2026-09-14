"use client";

import { useEffect, useState } from "react";
import {
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_INPUT,
  ADMIN_INPUT_MONO,
  ADMIN_LABEL,
  ADMIN_TEXT_ERROR,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";

const ETH_ADDR = /^0x[a-fA-F0-9]{40}$/;
const PK = /^(0x)?[a-fA-F0-9]{64}$/;

export function MarketplaceAdminPartnerApproveModal({
  open,
  userLabel,
  initialDisplayName,
  initialWalletAddress,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  userLabel: string;
  initialDisplayName?: string;
  initialWalletAddress?: string | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: {
    displayName: string;
    walletAddress: string;
    privateKey?: string;
  }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDisplayName(initialDisplayName?.trim() ?? "");
    setWalletAddress(initialWalletAddress?.trim() ?? "");
    setPrivateKey("");
    setError(null);
  }, [open, initialDisplayName, initialWalletAddress]);

  if (!open) return null;

  const submit = async () => {
    setError(null);
    const name = displayName.trim();
    const wallet = walletAddress.trim();
    const pk = privateKey.trim();
    if (!name) {
      setError("회사 표시명을 입력하세요");
      return;
    }
    if (!ETH_ADDR.test(wallet)) {
      setError("유효한 이더리움 지갑 주소(0x…)가 필요합니다");
      return;
    }
    if (pk && !PK.test(pk)) {
      setError("Private key는 32-byte hex여야 합니다 (선택)");
      return;
    }
    try {
      await onSubmit({
        displayName: name,
        walletAddress: wallet,
        ...(pk ? { privateKey: pk } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "승인에 실패했습니다");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-approve-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="partner-approve-title"
              className="text-base font-semibold text-zinc-900"
            >
              파트너 승인
            </h2>
            <p className={`mt-0.5 text-sm ${ADMIN_TEXT_MUTED}`}>{userLabel}</p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-lg leading-none text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
            onClick={onClose}
            disabled={busy}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <p className={`mt-4 text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
          파트너는 자체 보관(PSA 입고 없음). Origin·키는 승인 후 이 유저 상세에서
          설정하고, 대량 민트는 Partner bulk mint에서 진행합니다.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className={ADMIN_LABEL} htmlFor="partner-display-name">
              회사 표시명
            </label>
            <input
              id="partner-display-name"
              className={ADMIN_INPUT}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Cardhaus"
              disabled={busy}
              autoFocus
            />
          </div>
          <div>
            <label className={ADMIN_LABEL} htmlFor="partner-wallet">
              지갑 주소
            </label>
            <input
              id="partner-wallet"
              className={ADMIN_INPUT_MONO}
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x..."
              disabled={busy}
            />
            <p className={`mt-1.5 text-xs ${ADMIN_TEXT_MUTED}`}>
              판매 대금(USDC) 수령 지갑
            </p>
          </div>
          <div>
            <label className={ADMIN_LABEL} htmlFor="partner-approve-pk">
              Private key (선택 · bulk mint용)
            </label>
            <input
              id="partner-approve-pk"
              className={ADMIN_INPUT_MONO}
              type="password"
              autoComplete="off"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="0x… (나중에 유저 상세에서 추가 가능)"
              disabled={busy}
            />
          </div>
        </div>

        {error ? (
          <p className={`${ADMIN_TEXT_ERROR} mt-3`} role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className={ADMIN_BTN_SECONDARY}
            onClick={onClose}
            disabled={busy}
          >
            취소
          </button>
          <button
            type="button"
            className={ADMIN_BTN_PRIMARY}
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? "처리 중…" : "파트너 승인"}
          </button>
        </div>
      </div>
    </div>
  );
}
