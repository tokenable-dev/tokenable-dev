"use client";

import { useEffect, useRef } from "react";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { useAuthUiStore } from "@/store/authUiStore";

/** Opens Privy's native login modal when auth UI store requests sign-in. */
export function PrivySignInLauncher() {
  const signInOpen = useAuthUiStore((s) => s.signInOpen);
  const closeSignIn = useAuthUiStore((s) => s.closeSignIn);
  const { login } = useLogin();
  const { authenticated } = usePrivy();
  const launchInFlight = useRef(false);

  useEffect(() => {
    if (!signInOpen || launchInFlight.current) return;

    launchInFlight.current = true;
    closeSignIn();
    if (!authenticated) {
      login();
    }
    launchInFlight.current = false;
  }, [signInOpen, login, closeSignIn, authenticated]);

  return null;
}
