"use client";

import {
  formatSellCardDisplay,
  type SellCardDisplaySource,
} from "@/lib/sell/sellFlowDraft";
import { cn } from "@/lib/ds/cn";

/** Card title — SSOT line 1 + line 2; optional cert on its own line (Add your cards). */
export function SellCardNameBlock({
  card,
  certOnLine2 = false,
  showCertLine = false,
  line1ClassName,
  line2ClassName,
  certLineClassName,
  title,
}: {
  card: SellCardDisplaySource;
  /** Append Cert # to line 2 (vault hub). */
  certOnLine2?: boolean;
  /** Cert # on a third line below subtitle (sell flow card list). */
  showCertLine?: boolean;
  line1ClassName?: string;
  line2ClassName?: string;
  certLineClassName?: string;
  title?: string;
}) {
  const { line1, line2 } = formatSellCardDisplay(card, { certOnLine2 });
  const cert = card.cert?.trim();

  return (
    <div className="sell-card-name">
      <div
        className={cn("sell-card-name__line1", line1ClassName)}
        title={title ?? line1}
      >
        {line1}
      </div>
      {line2 ? (
        <div className={cn("sell-card-name__line2 tkl-mono", line2ClassName)}>
          {line2}
        </div>
      ) : null}
      {showCertLine && cert ? (
        <div className={cn("sell-card-name__cert tkl-mono", certLineClassName)}>
          <strong>Cert#</strong> {cert}
        </div>
      ) : null}
    </div>
  );
}
