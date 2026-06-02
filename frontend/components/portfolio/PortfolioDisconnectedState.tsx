"use client";

import { APP_MAIN_SHELL_CLASS } from "@/constants/layout";
import {
  GradientOutlineFrame,
  gradientOutlineInnerButtonClass,
  VAULT_OUTLINE_PAD_CLASS,
} from "@/components/ui/GradientOutlineFrame";
import { WalletConnect } from "@/components/wallet/WalletConnect";

export function PortfolioDisconnectedState() {
  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-black text-white">
      <div
        className={`${APP_MAIN_SHELL_CLASS} flex min-h-[calc(100vh-4rem)] flex-col justify-center py-8 pb-20`}
      >
        <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center">
          <div className="w-full rounded-2xl border border-gray-800/90 bg-gray-900/40 px-6 py-9 text-center sm:px-8 sm:py-10">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              Connect your wallet
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Connect MetaMask on Sepolia to view your holdings, estimated value, and
              activity in your portfolio.
            </p>
            <div className="mt-7">
              <GradientOutlineFrame className="w-full" padClass={VAULT_OUTLINE_PAD_CLASS}>
                <WalletConnect
                  connectButtonClassName={`${gradientOutlineInnerButtonClass} !rounded-[11px] py-3.5 text-sm`}
                  connectButtonStyle={{ backgroundColor: "#000000" }}
                />
              </GradientOutlineFrame>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
