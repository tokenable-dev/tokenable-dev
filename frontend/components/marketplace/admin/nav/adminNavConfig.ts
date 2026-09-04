export type AdminNavItem = {
  href: string;
  label: string;
  icon: AdminNavIconName;
  /** Match pathname exactly (e.g. Overview). */
  exact?: boolean;
  /** Match pathname prefix (nested routes). */
  prefix?: string;
  description?: string;
};

export type AdminNavIconName =
  | "layout-grid"
  | "database"
  | "users"
  | "layers"
  | "image"
  | "package"
  | "arrow-up-right"
  | "banknote"
  | "handshake"
  | "upload"
  | "store"
  | "refresh-cw"
  | "briefcase"
  | "key"
  | "arrow-left-right"
  | "mail"
  | "list-checks"
  | "files"
  | "vault";

export type AdminNavSection = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

/** Grouped sidebar — routes unchanged; icons match `admin/` prototype chrome. */
export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    items: [
      {
        href: "/marketplace/admin",
        label: "Overview",
        icon: "layout-grid",
        exact: true,
        description: "Platform KPIs, funnel, GA4 link",
      },
      {
        href: "/marketplace/admin/data-inventory",
        label: "데이터 인벤토리",
        icon: "database",
        prefix: "/marketplace/admin/data-inventory",
        description: "PostgreSQL 적재 현황 — 테이블별 의미와 행 수",
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
        icon: "users",
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
        icon: "layers",
        prefix: "/marketplace/admin/collections",
        description: "Buckets, covers, AI insight",
      },
      {
        href: "/marketplace/admin/cards",
        label: "All cards",
        icon: "image",
        prefix: "/marketplace/admin/cards",
        description: "RWA registry and metadata",
      },
      {
        href: "/marketplace/admin/custody-nfts",
        label: "Custody NFTs",
        icon: "package",
        prefix: "/marketplace/admin/custody-nfts",
        description: "Deliver vaulted cards to users",
      },
      {
        href: "/marketplace/admin/redeems",
        label: "Redeems",
        icon: "arrow-up-right",
        prefix: "/marketplace/admin/redeems",
        description: "Payment, custody intake, shipping and refunds",
      },
      {
        href: "/marketplace/admin/self-vault-payouts",
        label: "Self-vault payouts",
        icon: "banknote",
        prefix: "/marketplace/admin/self-vault-payouts",
        description: "Confirm and record seller USDC after self-vault sales",
      },
      {
        href: "/marketplace/admin/partners",
        label: "Partners",
        icon: "handshake",
        prefix: "/marketplace/admin/partners",
        description: "Company wallets for consignment mint and list",
      },
      {
        href: "/marketplace/admin/bulk-mint",
        label: "Partner bulk mint",
        icon: "upload",
        prefix: "/marketplace/admin/bulk-mint",
        description: "Excel cert+price → mint to company wallet and list",
      },
    ],
  },
  {
    id: "markets",
    label: "Markets and pricing",
    items: [
      {
        href: "/marketplace/admin/markets",
        label: "Markets preview",
        icon: "store",
        prefix: "/marketplace/admin/markets",
        description: "Home landing, Top 100, Cardhedger movers",
      },
      {
        href: "/marketplace/admin/price-webhooks",
        label: "Price sync",
        icon: "refresh-cw",
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
        icon: "briefcase",
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
        icon: "key",
        prefix: "/marketplace/admin/contract-roles",
        description: "MINTER / BURNER on TokenableRWA",
      },
      {
        href: "/marketplace/admin/p2p",
        label: "P2P escrow",
        icon: "arrow-left-right",
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
        icon: "mail",
        prefix: "/marketplace/admin/vault/psa-mail",
        description: "Items Received inbox — auto + manual arrival confirm",
      },
      {
        href: "/marketplace/admin/vault/mint-queue",
        label: "Mint queue",
        icon: "list-checks",
        prefix: "/marketplace/admin/vault/mint-queue",
        description: "At PSA → mint and deliver NFT to depositor (Live)",
      },
      {
        href: "/marketplace/admin/vault/submissions",
        label: "Submissions",
        icon: "files",
        prefix: "/marketplace/admin/vault/submissions",
        description: "Sell-flow packages — transit, PSA review, approve/reject",
      },
      {
        href: "/marketplace/admin/vault",
        label: "Vault / PSA",
        icon: "vault",
        exact: true,
        description: "PSA API tooling and shipping",
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
