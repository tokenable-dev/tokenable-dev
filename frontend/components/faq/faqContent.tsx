"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

export const FAQ_SUPPORT_EMAIL = "mailto:dev@tokenable.io";

const FAQ_GROUPS = [
  {
    id: "payments",
    items: ["wallet", "addFunds", "hold", "card", "currency", "cashOut"],
  },
  {
    id: "buying",
    items: ["buyHow", "buyFees", "gas", "confidence", "select"],
  },
  { id: "custody", items: ["where", "prove", "insured"] },
  {
    id: "vaults",
    items: ["vaultWhat", "vaultDiff", "vaultChoose", "grades", "partnerDuty", "verify"],
  },
  { id: "selling", items: ["sellHow", "sellFees", "sellWhen"] },
  { id: "redemption", items: ["ship", "redeemCost", "redeemTime"] },
] as const;

export type FaqGroupView = {
  id: string;
  heading: string;
  items: { id: string; q: string; a: ReactNode }[];
};

export function useFaqGroups(): FaqGroupView[] {
  const t = useTranslations("Faq");
  return FAQ_GROUPS.map((group) => ({
    id: group.id,
    heading: t(group.id),
    items: group.items.map((item) => ({
      id: item,
      q: t(`q.${item}`),
      a: t.rich(`a.${item}`, {
        b: (chunks) => <strong>{chunks}</strong>,
      }),
    })),
  }));
}
