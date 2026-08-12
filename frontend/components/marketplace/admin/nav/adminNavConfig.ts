export type AdminNavItem = {
  href: string;
  label: string;
  /** Match pathname exactly (e.g. Overview). */
  exact?: boolean;
  /** Match pathname prefix (nested routes). */
  prefix?: string;
  description?: string;
};

export type AdminNavSection = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

/** Grouped sidebar — flat 11-item list replaced with 6 sections. */
export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    items: [
      {
        href: "/marketplace/admin",
        label: "Overview",
        exact: true,
        description: "Platform KPIs, funnel, GA4 link",
      },
      {
        href: "/marketplace/admin/data-inventory",
        label: "Data inventory",
        prefix: "/marketplace/admin/data-inventory",
        description: "PostgreSQL stores — what we accumulate and how",
      },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      {
        href: "/marketplace/admin/users",
        label: "Users",
        prefix: "/marketplace/admin/users",
        description: "Accounts, wallets, watchlist support",
      },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    items: [
      {
        href: "/marketplace/admin/collections",
        label: "Collections",
        prefix: "/marketplace/admin/collections",
        description: "Buckets, covers, AI insight",
      },
      {
        href: "/marketplace/admin/cards",
        label: "All cards",
        prefix: "/marketplace/admin/cards",
        description: "RWA registry & metadata",
      },
      {
        href: "/marketplace/admin/custody-nfts",
        label: "Custody NFTs",
        prefix: "/marketplace/admin/custody-nfts",
        description: "Deliver vaulted cards to users",
      },
      {
        href: "/marketplace/admin/redeems",
        label: "Redeems",
        prefix: "/marketplace/admin/redeems",
        description: "Payment, custody intake, shipping & refunds",
      },
      {
        href: "/marketplace/admin/self-vault-payouts",
        label: "Self-vault payouts",
        prefix: "/marketplace/admin/self-vault-payouts",
        description: "Confirm & record seller USDC after self-vault sales",
      },
      {
        href: "/marketplace/admin/partners",
        label: "Partners",
        prefix: "/marketplace/admin/partners",
        description: "Company wallets for consignment mint & list",
      },
      {
        href: "/marketplace/admin/bulk-mint",
        label: "Partner bulk mint",
        prefix: "/marketplace/admin/bulk-mint",
        description: "Excel cert+price → mint to company wallet & list",
      },
    ],
  },
  {
    id: "markets",
    label: "Markets & pricing",
    items: [
      {
        href: "/marketplace/admin/markets",
        label: "Markets preview",
        prefix: "/marketplace/admin/markets",
        description: "Home landing, Top 100, Cardhedger movers",
      },
      {
        href: "/marketplace/admin/price-webhooks",
        label: "Price sync",
        prefix: "/marketplace/admin/price-webhooks",
        description: "Cardhedger delta import",
      },
    ],
  },
  {
    id: "portfolio",
    label: "Portfolio",
    items: [
      {
        href: "/marketplace/admin/portfolio",
        label: "Portfolio ops",
        prefix: "/marketplace/admin/portfolio",
        description: "Snapshots, cost basis, home value rules",
      },
    ],
  },
  {
    id: "chain",
    label: "On-chain",
    items: [
      {
        href: "/marketplace/admin/contract-roles",
        label: "Contract roles",
        prefix: "/marketplace/admin/contract-roles",
        description: "MINTER / BURNER on TokenableRWA",
      },
      {
        href: "/marketplace/admin/p2p",
        label: "P2P escrow",
        prefix: "/marketplace/admin/p2p",
        description: "Orders, arbiter refund",
      },
    ],
  },
  {
    id: "vault",
    label: "Vault",
    items: [
      {
        href: "/marketplace/admin/vault/psa-mail",
        label: "PSA mail",
        prefix: "/marketplace/admin/vault/psa-mail",
        description: "Items Received inbox — auto + manual arrival confirm",
      },
      {
        href: "/marketplace/admin/vault/mint-queue",
        label: "Mint queue",
        prefix: "/marketplace/admin/vault/mint-queue",
        description: "At PSA → mint & deliver NFT to depositor (Live)",
      },
      {
        href: "/marketplace/admin/vault/submissions",
        label: "Submissions",
        prefix: "/marketplace/admin/vault/submissions",
        description: "Sell-flow packages — transit, PSA review, approve/reject",
      },
      {
        href: "/marketplace/admin/vault",
        label: "Vault / PSA",
        exact: true,
        description: "PSA API tooling & shipping",
      },
    ],
  },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_SECTIONS.flatMap(
  (s) => s.items,
);

export function isAdminNavItemActive(
  pathname: string,
  item: AdminNavItem,
): boolean {
  if (item.exact) return pathname === item.href;
  if (item.prefix) return pathname.startsWith(item.prefix);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Legacy top-100 card detail + old tab URLs still highlight Markets preview. */
export function isAdminMarketsPreviewActive(pathname: string): boolean {
  if (pathname.startsWith("/marketplace/admin/markets")) return true;
  if (pathname.startsWith("/marketplace/admin/top100")) return true;
  if (pathname.startsWith("/marketplace/admin/top-movers")) return true;
  return false;
}
