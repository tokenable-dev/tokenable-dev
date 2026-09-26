"use client";

import { useEffect, useRef } from "react";
import { useFiatOnramp } from "@privy-io/react-auth";
import { formatPrivyFundingError } from "@/lib/privy/funding";
import type { FiatAggregatorFundParams } from "@/lib/privy/fiatAggregatorBridge";

export function FiatAggregatorRunner({
  params,
  onDone,
}: {
  params: FiatAggregatorFundParams;
  onDone: (ok: boolean, errorMessage: string | null) => void;
}) {
  const { fund } = useFiatOnramp();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void fund(params)
      .then(() => onDone(true, null))
      .catch((err: unknown) => onDone(false, formatPrivyFundingError(err)));
  }, [fund, onDone, params]);

  return null;
}
