"use client";

import { useEffect, useState } from "react";
import { TkButton, TkDialog } from "@/components/ds";
import { ASSETS } from "@/constants/assets";
import { KBW_MYSTERY_CARD_NAME } from "@/lib/portfolio/kbwMysteryCard";
import "@/styles/tokenable-kbw-mystery-burn.css";

type BurnStep = "staff_gate" | "check";

export function KbwMysteryCardBurnModal({
  open,
  onClose,
  onBurn,
}: {
  open: boolean;
  onClose: () => void;
  onBurn: () => Promise<void>;
}) {
  const [step, setStep] = useState<BurnStep>("check");
  const [burning, setBurning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("check");
      setError(null);
      setBurning(false);
    }
  }, [open]);

  async function handleBurn() {
    setBurning(true);
    setError(null);
    try {
      await onBurn();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Burn failed");
    } finally {
      setBurning(false);
    }
  }

  const staffGate = step === "staff_gate";

  return (
    <TkDialog
      open={open}
      onClose={() => {
        if (!burning) onClose();
      }}
      title={staffGate ? "Staff only" : KBW_MYSTERY_CARD_NAME}
      className="tk-kbw-burn"
      footer={
        staffGate ? (
          <div className="tk-kbw-burn__foot">
            {error ? <p className="tk-kbw-burn__error">{error}</p> : null}
            <TkButton
              type="button"
              variant="subtle"
              className="w-full justify-center"
              disabled={burning}
              onClick={() => {
                setError(null);
                setStep("check");
              }}
            >
              Go back
            </TkButton>
            <TkButton
              type="button"
              variant="danger"
              className="w-full justify-center"
              disabled={burning}
              onClick={() => void handleBurn()}
            >
              {burning ? "Checking…" : "Confirm (staff only)"}
            </TkButton>
          </div>
        ) : (
          <div className="tk-kbw-burn__foot">
            <TkButton
              type="button"
              variant="danger"
              className="w-full justify-center"
              onClick={() => setStep("staff_gate")}
            >
              Check
            </TkButton>
          </div>
        )
      }
    >
      {staffGate ? (
        <div className="tk-kbw-burn__staff-gate">
          <p className="tk-kbw-burn__staff-lead">
            The next step marks this KBW Mystery Card as used. It is for{" "}
            <strong>event staff at the booth only</strong>.
          </p>
          <p className="tk-kbw-burn__staff-warn">
            If you are not staff, please close this window and do not continue.
          </p>
        </div>
      ) : (
        <div className="tk-kbw-burn__art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ASSETS.event.kbwMysteryCard}
            alt={KBW_MYSTERY_CARD_NAME}
            width={163}
            height={253}
          />
        </div>
      )}
    </TkDialog>
  );
}
