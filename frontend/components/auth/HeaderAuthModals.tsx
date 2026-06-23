"use client";

import { SignInModal } from "./SignInModal";
import { ConnectWalletModal } from "./ConnectWalletModal";
import { WalletMismatchModal } from "./WalletMismatchModal";
import { KycRequiredModal } from "./KycRequiredModal";
import { EmailVerifyToast } from "./EmailVerifyToast";

/** Mount once near the app shell (e.g. AppHeader). */
export function HeaderAuthModals() {
  return (
    <>
      <SignInModal />
      <ConnectWalletModal />
      <WalletMismatchModal />
      <KycRequiredModal />
      <EmailVerifyToast />
    </>
  );
}
