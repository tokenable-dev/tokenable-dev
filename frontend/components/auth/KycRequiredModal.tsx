"use client";

import { AuthModalShell } from "./AuthModalShell";
import { useAuthUiStore } from "@/store/authUiStore";

export function KycRequiredModal() {
  const kycOpen = useAuthUiStore((s) => s.kycOpen);
  const closeKyc = useAuthUiStore((s) => s.closeKyc);
  const titleId = "kyc-required-modal-title";

  return (
    <AuthModalShell open={kycOpen} onClose={closeKyc} titleId={titleId} maxWidthClass="max-w-sm">
      <div className="px-6 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-6 sm:px-7 sm:pb-7">
        <h2 id={titleId} className="text-lg font-bold text-white sm:text-xl">
          Verification required
        </h2>

        <button
          type="button"
          disabled
          className="mt-5 w-full cursor-not-allowed rounded-xl bg-mint/20 py-3 text-sm font-semibold text-mint/70"
        >
          Coming soon
        </button>

        <button
          type="button"
          onClick={closeKyc}
          className="mt-2 w-full py-2 text-sm text-gray-500 hover:text-gray-300"
        >
          Close
        </button>
      </div>
    </AuthModalShell>
  );
}
