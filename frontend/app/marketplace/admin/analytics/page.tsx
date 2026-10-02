import { redirect } from "next/navigation";

/** GA4 link lives on Overview — keep old bookmark working. */
export default function MarketplaceAdminAnalyticsRedirect() {
  redirect("/marketplace/admin");
}
