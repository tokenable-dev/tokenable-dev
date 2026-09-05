"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  CollectionDetailLoadedView,
  CollectionDetailLoadingShell,
  CollectionDetailStateShell,
} from "@/components/marketplace/collection-detail";
import { AppPageState } from "@/components/ui/AppPageState";
import {
  useCollectionDetailPage,
  type CollectionDetailLoadedProps,
} from "@/hooks/collection-detail";
import { formatErrorDetails } from "@/lib/ui/page-state-catalog";
import { usePageViewedEvent } from "@/hooks/analytics/usePageViewedEvent";

function CollectionDetailPageContent() {
  usePageViewedEvent("collection_detail");
  const searchParams = useSearchParams();
  const detail = useCollectionDetailPage();
  const listingParam = searchParams.get("listing")?.trim() ?? "";
  const listingTokenId = /^\d+$/.test(listingParam) ? listingParam : "";

  if (detail.status === "invalid") {
    return (
      <CollectionDetailStateShell>
        <AppPageState kind="collection_invalid" />
      </CollectionDetailStateShell>
    );
  }

  if (detail.status === "loading") {
    return <CollectionDetailLoadingShell />;
  }

  if (detail.status === "not_created") {
    return (
      <CollectionDetailStateShell>
        <AppPageState
          kind="collection_not_created"
          primaryAction={{ label: "Go to Portfolio", href: "/portfolio", variant: "primary" }}
          secondaryAction={
            listingTokenId
              ? {
                  label: "List from Portfolio",
                  href: `/portfolio?list=${listingTokenId}`,
                  variant: "neutral",
                }
              : { label: "Browse Markets", href: "/markets", variant: "neutral" }
          }
        />
      </CollectionDetailStateShell>
    );
  }

  if (detail.status === "fetch_error") {
    const showDetails = process.env.NODE_ENV === "development";
    return (
      <CollectionDetailStateShell>
        <AppPageState
          kind="collection_load_failed"
          primaryAction={{
            label: "Try again",
            onClick: () => detail.router.refresh(),
            variant: "primary",
          }}
          details={showDetails ? formatErrorDetails(detail.error) : null}
        />
      </CollectionDetailStateShell>
    );
  }

  if (!detail.data || !detail.collectionOrderBookProps) {
    return null;
  }

  const loaded = detail as CollectionDetailLoadedProps;

  return <CollectionDetailLoadedView {...loaded} />;
}

export default function MarketplaceCollectionPage() {
  return (
    <Suspense fallback={<CollectionDetailLoadingShell />}>
      <CollectionDetailPageContent />
    </Suspense>
  );
}
