import { redirect } from "next/navigation";

export default async function MarketplaceAdminTopMoversRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  qs.set("tab", "cardhedger-movers");
  const category = sp.category;
  if (typeof category === "string" && category.trim()) {
    qs.set("category", category.trim());
  }
  redirect(`/marketplace/admin/markets?${qs.toString()}`);
}
