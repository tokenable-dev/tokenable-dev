"use client";

import { useTranslations } from "next-intl";
import { TkButton } from "@/components/ds";

export type OrderBookEmptyVariant = "no_asks" | "no_bids" | "no_market";

/** Collection detail listings tab — Card.html `.ob-emp2` / `#ob-empty-market`. */
export function OrderBookEmptyPanel({
  variant,
  onPlaceBid,
  onListYours,
}: {
  variant: OrderBookEmptyVariant;
  onPlaceBid?: () => void;
  onListYours?: () => void;
}) {
  const t = useTranslations("OrderBook");
  const tNav = useTranslations("Nav");
  const tTrade = useTranslations("Trade");
  if (variant === "no_asks") {
    return (
      <div className="cd-ob-empty cd-ob-empty--asks cd-ob-empty--emp2">
        <div className="cd-ob-empty__mdiv">
          <span aria-hidden />
          <span className="cd-ob-empty__mtitle">{t("noAsks")}</span>
          <span aria-hidden />
        </div>
        {onListYours ? (
          <TkButton
            type="button"
            variant="neutral"
            size="md"
            className="cd-ob-empty__mbtn"
            onClick={onListYours}
          >
            {tNav("sell")}
          </TkButton>
        ) : null}
      </div>
    );
  }

  if (variant === "no_bids") {
    return (
      <div className="cd-ob-empty cd-ob-empty--bids cd-ob-empty--emp2">
        <div className="cd-ob-empty__mdiv">
          <span aria-hidden />
          <span className="cd-ob-empty__mtitle">{t("noBids")}</span>
          <span aria-hidden />
        </div>
        {onPlaceBid ? (
          <TkButton
            type="button"
            variant="neutral"
            size="md"
            className="cd-ob-empty__mbtn"
            onClick={onPlaceBid}
          >
            {tTrade("bid")}
          </TkButton>
        ) : null}
      </div>
    );
  }

  return (
    <div className="cd-ob-empty cd-ob-empty--market">
      {onListYours ? (
        <TkButton
          type="button"
          variant="primary"
          size="md"
          className="cd-ob-empty__mbtn cd-ob-empty__mbtn--primary"
          onClick={onListYours}
        >
          {tNav("sell")}
        </TkButton>
      ) : null}
      <div className="cd-ob-empty__mdiv">
        <span aria-hidden />
        <span className="cd-ob-empty__mtitle">{t("noMarkets")}</span>
        <span aria-hidden />
      </div>
      {onPlaceBid ? (
        <TkButton
          type="button"
          variant="neutral"
          size="md"
          className="cd-ob-empty__mbtn"
          onClick={onPlaceBid}
        >
          {tTrade("bid")}
        </TkButton>
      ) : null}
    </div>
  );
}
