"use client";

import { useLayoutEffect, useState, type CSSProperties } from "react";
import type { ListModalAnchorRect } from "@/lib/seaport/listing/listRwaModalTypes";

const VIEWPORT_PAD = 16;
/** Space between modal bottom edge and button top (negative = modal sits lower). */
const ANCHOR_GAP = -148;
const PANEL_WIDTH_PX = 352; // 22rem

/** Pin modal bottom edge just above the anchor button (no height clamp / inner scroll). */
export function useListRwaModalAnchorPosition(
  anchorRect: ListModalAnchorRect | null | undefined,
  deps: unknown[] = [],
): CSSProperties | undefined {
  const anchored = anchorRect != null;
  const [panelStyle, setPanelStyle] = useState<CSSProperties | undefined>(undefined);

  useLayoutEffect(() => {
    if (!anchored || !anchorRect) {
      setPanelStyle(undefined);
      return;
    }

    const compute = () => {
      const panelWidth = Math.min(PANEL_WIDTH_PX, window.innerWidth - VIEWPORT_PAD * 2);
      const halfW = panelWidth / 2;

      let centerX = anchorRect.left + anchorRect.width / 2;
      centerX = Math.max(
        VIEWPORT_PAD + halfW,
        Math.min(centerX, window.innerWidth - VIEWPORT_PAD - halfW),
      );

      setPanelStyle({
        position: "fixed",
        bottom: window.innerHeight - anchorRect.top + ANCHOR_GAP,
        left: centerX,
        transform: "translateX(-50%)",
        width: panelWidth,
        margin: 0,
      });
    };

    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [anchored, anchorRect, ...deps]);

  return anchored ? panelStyle : undefined;
}
