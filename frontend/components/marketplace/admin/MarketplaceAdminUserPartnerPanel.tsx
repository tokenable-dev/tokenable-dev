"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  patchAdminMarketplacePartner,
  rq,
  type AdminUserPartnerInfo,
} from "@/lib/core";
import { AdminPartnerOriginPanel } from "./AdminPartnerOriginPanel";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_INPUT,
  ADMIN_INPUT_MONO,
  ADMIN_LABEL,
  ADMIN_TEXT_ERROR,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";

const PK = /^(0x)?[a-fA-F0-9]{64}$/;

function shortWallet(addr: string): string {
  const s = addr.trim();
  if (s.length < 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

/**
 * Partner vault ops for a user who already has a marketplace_partners row:
 * rename, Origin (FedEx ship-from), optional encrypted key for bulk mint.
 */
export function MarketplaceAdminUserPartnerPanel({
  partner,
  onChanged,
}: {
  partner: AdminUserPartnerInfo;
  onChanged: () => Promise<void>;
}) {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(partner.displayName);
  const [showOrigin, setShowOrigin] = useState(false);
  const [showRotate, setShowRotate] = useState(false);
  const [rotateKey, setRotateKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(partner.displayName);
  }, [partner.id, partner.displayName]);

  const patchMutation = useMutation({
    mutationFn: (body: { displayName?: string; privateKey?: string }) =>
      patchAdminMarketplacePartner(partner.id, body),
    onSuccess: async () => {
      setError(null);
      setShowRotate(false);
      setRotateKey("");
      await qc.invalidateQueries({ queryKey: rq.adminMarketplacePartners });
      await onChanged();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <section className={`${ADMIN_ARTICLE} mt-5 space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">파트너 vault</h3>
          <p className={`mt-1 text-sm ${ADMIN_TEXT_SECONDARY}`}>
            회사명·Origin·민팅 키는 이 유저 상세에서 관리합니다. 대량 민트는{" "}
            <Link
              href="/marketplace/admin/bulk-mint"
              className="font-medium text-[var(--brand-500)] hover:underline"
            >
              Partner bulk mint
            </Link>
            .
          </p>
        </div>
        <p className={`font-mono text-xs ${ADMIN_TEXT_MUTED}`}>
          {shortWallet(partner.walletAddress)}
        </p>
      </div>

      <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>
        Key: {partner.hasPrivateKey ? "Yes" : "Partner vault only"} · Origin:{" "}
        {partner.hasCompanyAddress ? "Set" : "Missing"}
        {!partner.isActive ? " · Inactive" : null}
      </p>

      <div>
        <label className={ADMIN_LABEL} htmlFor="partner-rename">
          회사 표시명
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            id="partner-rename"
            className={`${ADMIN_INPUT} min-w-0 flex-1`}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={patchMutation.isPending}
          />
          <button
            type="button"
            className={ADMIN_BTN_SECONDARY}
            disabled={
              patchMutation.isPending ||
              !displayName.trim() ||
              displayName.trim() === partner.displayName
            }
            onClick={() =>
              patchMutation.mutate({ displayName: displayName.trim() })
            }
          >
            이름 저장
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={ADMIN_BTN_SECONDARY}
          onClick={() => setShowOrigin((v) => !v)}
        >
          {showOrigin ? "Origin 닫기" : "Origin"}
        </button>
        <button
          type="button"
          className={ADMIN_BTN_SECONDARY}
          onClick={() => {
            setShowRotate((v) => !v);
            setRotateKey("");
            setError(null);
          }}
        >
          {showRotate
            ? "키 입력 취소"
            : partner.hasPrivateKey
              ? "키 교체"
              : "키 추가"}
        </button>
      </div>

      {showRotate ? (
        <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <label className={ADMIN_LABEL} htmlFor="partner-pk">
            Private key (write-only, 32-byte hex)
          </label>
          <input
            id="partner-pk"
            className={ADMIN_INPUT_MONO}
            type="password"
            autoComplete="off"
            value={rotateKey}
            onChange={(e) => setRotateKey(e.target.value)}
            placeholder="0x…"
            disabled={patchMutation.isPending}
          />
          <button
            type="button"
            className={ADMIN_BTN_PRIMARY}
            disabled={patchMutation.isPending}
            onClick={() => {
              if (!PK.test(rotateKey.trim())) {
                setError("Private key must be 32-byte hex.");
                return;
              }
              patchMutation.mutate({ privateKey: rotateKey.trim() });
            }}
          >
            {patchMutation.isPending ? "저장 중…" : "키 저장"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className={ADMIN_TEXT_ERROR} role="alert">
          {error}
        </p>
      ) : null}

      {showOrigin ? (
        <AdminPartnerOriginPanel
          partnerId={partner.id}
          partnerName={partner.displayName}
          onClose={() => {
            setShowOrigin(false);
            void onChanged();
          }}
        />
      ) : null}
    </section>
  );
}
