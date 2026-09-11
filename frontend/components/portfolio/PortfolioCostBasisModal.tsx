"use client";

import { useEffect, useState } from "react";
import { TkButton, TkField, TkInput } from "@/components/ds";
import { TkDialog } from "@/components/ds/Dialog";

export function PortfolioCostBasisModal({
  open,
  tokenId,
  assetName,
  initialUsd,
  pending,
  onClose,
  onSave,
}: {
  open: boolean;
  tokenId: number;
  assetName: string;
  initialUsd: number | null;
  pending?: boolean;
  onClose: () => void;
  onSave: (costBasisUsd: number) => void | Promise<void>;
}) {
  const [value, setValue] = useState("");
  const title = assetName.trim() || `RWA #${tokenId}`;

  useEffect(() => {
    if (!open) return;
    setValue(
      initialUsd != null && Number.isFinite(initialUsd) ? String(initialUsd) : "",
    );
  }, [open, initialUsd, tokenId]);

  const parsed = Number(value.replace(/,/g, "").trim());
  const canSave = Number.isFinite(parsed) && parsed >= 0;

  return (
    <TkDialog
      open={open}
      onClose={onClose}
      title="Edit cost basis"
      description={`Set your purchase cost for ${title}. Auto-seeded values can be overridden.`}
      footer={
        <div className="flex flex-col gap-2.5 sm:flex-row-reverse sm:gap-3">
          <TkButton
            variant="primary"
            className="w-full sm:flex-1"
            disabled={pending || !canSave}
            onClick={() => void onSave(parsed)}
          >
            {pending ? "Saving…" : "Save"}
          </TkButton>
          <TkButton
            variant="neutral"
            className="w-full sm:flex-1"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </TkButton>
        </div>
      }
    >
      <TkField label="Cost basis (USD)" htmlFor="cost-basis-usd">
        <TkInput
          id="cost-basis-usd"
          type="text"
          inputMode="decimal"
          placeholder="e.g. 1250"
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
        />
      </TkField>
    </TkDialog>
  );
}
