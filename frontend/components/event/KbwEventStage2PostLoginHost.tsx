"use client";

import { useKbwEventStage2PostLogin } from "@/hooks/event/useKbwEventStage2PostLogin";

/** Stage-2 post-login runs app-wide — mobile MetaMask often returns off `/event`. */
export function KbwEventStage2PostLoginHost() {
  useKbwEventStage2PostLogin();
  return null;
}
