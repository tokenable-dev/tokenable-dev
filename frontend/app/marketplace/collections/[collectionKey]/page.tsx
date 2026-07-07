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

function CollectionDetailPageContent() {
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
          primaryAction={
            listingTokenId
              ? {
                  label: "List this card",
                  href: `/marketplace/${listingTokenId}?list=1`,
                  variant: "primary",
                }
              : undefined
          }
          secondaryAction={
            listingTokenId
              ? { label: "Go to Portfolio", href: "/portfolio", variant: "neutral" }
              : undefined
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
