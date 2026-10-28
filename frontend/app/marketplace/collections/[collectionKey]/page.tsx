"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("CollectionDetail");
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
          primaryAction={{ label: t("pagePortfolio"), href: "/portfolio", variant: "primary" }}
          secondaryAction={
            listingTokenId
              ? {
                  label: t("pageList"),
                  href: `/portfolio?list=${listingTokenId}`,
                  variant: "neutral",
                }
              : { label: t("pageMarkets"), href: "/markets", variant: "neutral" }
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
            label: t("pageRetry"),
            onClick: () => detail.router.refresh(),
            variant: "primary",
          }}
          secondaryAction={null}
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
