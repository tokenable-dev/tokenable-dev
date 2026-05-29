import type { Abi } from "viem";

import { SEAPORT_MATCH_ADVANCED_ORDERS_ABI } from "./seaportMatchAdvancedAbi";

// ─── Contract Addresses ───────────────────────────────────────────────────────

/** Collection display name when metadata has no `name` */
export const TOKENABLE_RWA_DISPLAY_NAME = "Tokenable_RWA";

const ADDR = /^0x[a-fA-F0-9]{40}$/;

/**
 * Next.js 는 `process.env.NEXT_PUBLIC_*` 를 **정적**으로만 빌드 시 번들에 넣습니다.
 * `process.env[name]` 같은 동적 접근은 클라이언트에서 항상 비어 있어 런타임 에러가 납니다.
 */
function requireHexAddr(
  raw: string | undefined,
  label: string,
): `0x${string}` {
  const value = raw?.trim() ?? "";
  if (!value || !ADDR.test(value)) {
    throw new Error(
      `[contracts] Set ${label} in frontend/.env (or as a docker build-arg).`,
    );
  }
  return value as `0x${string}`;
}

export const TOKENABLE_RWA_ADDRESS = requireHexAddr(
  process.env.NEXT_PUBLIC_RWA_CONTRACT_ADDRESS,
  "NEXT_PUBLIC_RWA_CONTRACT_ADDRESS",
);

export const USDC_ADDRESS = requireHexAddr(
  process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS,
  "NEXT_PUBLIC_USDC_CONTRACT_ADDRESS",
);

/** Seaport v1.5 — deployed at the same address on all EVM chains */
export const SEAPORT_ADDRESS =
  "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC" as `0x${string}`;

// ─── Platform Fee ─────────────────────────────────────────────────────────────

/** Vault wallet that receives the platform fee on every trade. Empty ⇒ no fee. */
export const PLATFORM_FEE_RECIPIENT: `0x${string}` | null = (() => {
  const raw = process.env.NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT?.trim() ?? "";
  if (!raw || !ADDR.test(raw)) return null;
  return raw as `0x${string}`;
})();

/** Fee in basis points — 250 = 2.5 %. Falls back to 0 when recipient is unset. */
export const PLATFORM_FEE_BPS: number = (() => {
  if (!PLATFORM_FEE_RECIPIENT) return 0;
  const v = parseInt(process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS ?? "250", 10);
  return Number.isFinite(v) && v >= 0 && v <= 5000 ? v : 250;
})();

// ─── Tokenable_RWA ABIs ─────────────────────────────────────────────────────────

export const TOKENABLE_RWA_MINT_ABI = [
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "_tokenURI", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** 읽기 전용 — 상세 페이지 ownerOf, tokenURI (백엔드 404 시 클라이언트 폴백) */
export const TOKENABLE_RWA_READ_ABI = [
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

/** ERC-721 transfer (test burn-to-address flow). */
export const TOKENABLE_RWA_TRANSFER_ABI = [
  {
    name: "transferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

/** ERC-721 listing: OpenSea-style `setApprovalForAll(Seaport, true)` (not per-token `approve`). */
export const TOKENABLE_RWA_APPROVE_ABI = [
  {
    name: "setApprovalForAll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "isApprovedForAll",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "getApproved",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

// ─── USDC ABI ─────────────────────────────────────────────────────────────────

export const USDC_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ─── Seaport ABIs ─────────────────────────────────────────────────────────────

export const SEAPORT_ABI = [
  {
    name: "getCounter",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "offerer", type: "address" }],
    outputs: [{ name: "counter", type: "uint256" }],
  },
  {
    name: "fulfillOrder",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "order",
        type: "tuple",
        components: [
          {
            name: "parameters",
            type: "tuple",
            components: [
              { name: "offerer", type: "address" },
              { name: "zone", type: "address" },
              {
                name: "offer",
                type: "tuple[]",
                components: [
                  { name: "itemType", type: "uint8" },
                  { name: "token", type: "address" },
                  { name: "identifierOrCriteria", type: "uint256" },
                  { name: "startAmount", type: "uint256" },
                  { name: "endAmount", type: "uint256" },
                ],
              },
              {
                name: "consideration",
                type: "tuple[]",
                components: [
                  { name: "itemType", type: "uint8" },
                  { name: "token", type: "address" },
                  { name: "identifierOrCriteria", type: "uint256" },
                  { name: "startAmount", type: "uint256" },
                  { name: "endAmount", type: "uint256" },
                  { name: "recipient", type: "address" },
                ],
              },
              { name: "orderType", type: "uint8" },
              { name: "startTime", type: "uint256" },
              { name: "endTime", type: "uint256" },
              { name: "zoneHash", type: "bytes32" },
              { name: "salt", type: "uint256" },
              { name: "conduitKey", type: "bytes32" },
              { name: "totalOriginalConsiderationItems", type: "uint256" },
            ],
          },
          { name: "signature", type: "bytes" },
        ],
      },
      { name: "fulfillerConduitKey", type: "bytes32" },
    ],
    outputs: [{ name: "fulfilled", type: "bool" }],
  },
] as const;

/** `fulfillOrder` + `getCounter` + `matchAdvancedOrders` — use for advanced/criteria settlement. */
export const SEAPORT_ABI_WITH_MATCH_ADVANCED = [
  ...SEAPORT_ABI,
  ...SEAPORT_MATCH_ADVANCED_ORDERS_ABI,
] as Abi;

// ─── Seaport EIP-712 types for signTypedData ──────────────────────────────────

export const SEAPORT_ORDER_TYPES = {
  OrderComponents: [
    { name: "offerer", type: "address" },
    { name: "zone", type: "address" },
    { name: "offer", type: "OfferItem[]" },
    { name: "consideration", type: "ConsiderationItem[]" },
    { name: "orderType", type: "uint8" },
    { name: "startTime", type: "uint256" },
    { name: "endTime", type: "uint256" },
    { name: "zoneHash", type: "bytes32" },
    { name: "salt", type: "uint256" },
    { name: "conduitKey", type: "bytes32" },
    { name: "counter", type: "uint256" },
  ],
  OfferItem: [
    { name: "itemType", type: "uint8" },
    { name: "token", type: "address" },
    { name: "identifierOrCriteria", type: "uint256" },
    { name: "startAmount", type: "uint256" },
    { name: "endAmount", type: "uint256" },
  ],
  ConsiderationItem: [
    { name: "itemType", type: "uint8" },
    { name: "token", type: "address" },
    { name: "identifierOrCriteria", type: "uint256" },
    { name: "startAmount", type: "uint256" },
    { name: "endAmount", type: "uint256" },
    { name: "recipient", type: "address" },
  ],
} as const;

// ─── Event ABIs (getLogs) ─────────────────────────────────────────────────────

export const TOKENABLE_RWA_EVENTS_ABI = [
  {
    name: "Minted",
    type: "event",
    inputs: [
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "tokenURI", type: "string", indexed: false },
    ],
  },
  {
    name: "Transfer",
    type: "event",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;
