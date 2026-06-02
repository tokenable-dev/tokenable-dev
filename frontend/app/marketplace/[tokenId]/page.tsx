"use client";

import {
  RwaDetailAssetNotFoundState,
  RwaDetailInvalidTokenState,
  RwaDetailLoadedView,
  RwaDetailLoadingShell,
  RwaDetailPageShell,
} from "@/components/marketplace/rwa-detail";
import { useRwaDetailPage } from "@/hooks/rwa-detail";

export default function RwaDetailPage() {
  const detail = useRwaDetailPage();
  const showMain = detail.status === "ready";

  return (
    <RwaDetailPageShell showMain={showMain}>
      {detail.status === "loading" ? <RwaDetailLoadingShell /> : null}

      {detail.status === "invalid" ? (
        <RwaDetailInvalidTokenState onBack={() => detail.router.back()} />
      ) : null}

      {detail.status === "not_found" ? (
        <RwaDetailAssetNotFoundState onBack={() => detail.router.back()} />
      ) : null}

      {detail.status === "ready" ? <RwaDetailLoadedView {...detail} /> : null}
    </RwaDetailPageShell>
  );
}
