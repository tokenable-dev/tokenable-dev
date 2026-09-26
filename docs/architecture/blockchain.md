# Blockchain Architecture

**Last updated:** 2026-09-22

Canonical doc for on-chain components used by the platform: what we own, what we integrate, where it is deployed, and how backend/frontend talk to it.

## Overview

Tokenable uses **EVM chains** configured in `ChainConfigService` (`SUPPORTED_CHAIN_IDS`: Sepolia `11155111`, Ethereum mainnet `1`, Polygon `137`) for:

- **RWA NFT** — unmodified OpenZeppelin `ERC721PresetMinterPauserAutoId` (we deploy; **no proxy / no upgrades**)
- **Seaport 1.5** — OpenSea settlement protocol; off-chain order book in Postgres, on-chain USDC fill (**third-party**)
- **USDC (Circle)** — settlement currency for all marketplace trades (**third-party**)

The backend is the sole on-chain writer for mint/burn/custody transfer. Users sign Seaport trades via Privy or MetaMask.

Changing NFT behavior means **redeploy + swap** `CHAIN_{id}_RWA_ADDRESS` / `NEXT_PUBLIC_CHAIN_{id}_RWA` and start inventory on the new address.

---

## Contract inventory (ownership)

| Component | Owner | Role on platform | Docs / source |
|-----------|-------|------------------|---------------|
| **ERC721PresetMinterPauserAutoId** | Tokenable deploy of OpenZeppelin 4.9.6 | Mint / owner-burn / pause NFT | This file · OZ preset (`contracts/contracts/oz-erc721-preset.sol`) |
| **Seaport 1.5** | OpenSea (canonical deploy) | Ask / bid / fulfill / match; USDC consideration | This file · [Seaport](https://github.com/ProjectOpenSea/seaport) · ADR: [seaport-accept-offer.md](./seaport-accept-offer.md) |
| **USDC** | Circle | Trade settlement (6 decimals) | Circle docs · per-chain addresses below |
| **ConduitController** | OpenSea | Present in frontend constants; current orders use `conduitKey = 0` (direct Seaport approvals) | `frontend/constants/contracts.ts` |

We do **not** write custom NFT Solidity. We do **not** fork Seaport/USDC.

### Audit / assurance status

| Component | Status |
|-----------|--------|
| **Seaport 1.5** | External, widely used OpenSea protocol with public audits/reviews (rely on OpenSea’s published assurance — we do not re-audit Seaport) |
| **USDC** | Circle-issued stablecoin; standard ERC-20 on each chain |
| **RWA NFT** | Unmodified OpenZeppelin Contracts **v4.9.6** `ERC721PresetMinterPauserAutoId`. Tests: `contracts/test/OzErc721Preset.test.ts`. App/key/ops risk is off-chain. |

---

## Deployed RWA contracts

These are **plain contract addresses** (not UUPS proxies). **Source of truth:** per-host `CHAIN_{id}_RWA_ADDRESS` / `NEXT_PUBLIC_CHAIN_{id}_RWA` (see `deploy/README.md`).

| Chain | ID | Local dev | EC2 deploy |
|-------|-----|-----------|------------|
| Ethereum Sepolia | 11155111 | `0x70FDfd126b902173720412b2B8AD844E728F49af` | `0xF7242F62153ac2F42CbF331724F38B93829381c3` |
| Ethereum mainnet | 1 | `0x1ee4a6a6cbc4E15f73125233bc9447208c2dB8C1` | `0xa8a7568E0A5f0dC2F5143ad09D12a032b3c145ad` |
| Polygon mainnet | 137 | `0x0DE88f46A0790E3B08fA2eB96BE2819480E0e478` | `0x4d1FA7a19C5b6a5fd4aB0E9521eb5Ef252993d35` |

After a redeploy, update env on that host and this table in the same change.

---

## RWA NFT (OpenZeppelin preset)

**Type:** Non-upgradeable ERC-721 + Enumerable + Burnable + Pausable + AccessControlEnumerable  
**On-chain name:** `ERC721PresetMinterPauserAutoId` (OpenZeppelin Contracts 4.9.6)  
**Constructor:** `("Tokenable", "TRWA", baseTokenURI)`  
**Compile shim:** `contracts/contracts/oz-erc721-preset.sol` (import only — no Tokenable Solidity)

### Roles

| Role | Purpose | Typical holder |
|------|---------|----------------|
| `DEFAULT_ADMIN_ROLE` | Grant/revoke minter and pauser | Deployer (EOA that runs `deploy-tokenable-rwa.ts`) |
| `MINTER_ROLE` | `mint(address to)` | Backend hot wallet |
| `PAUSER_ROLE` | `pause` / `unpause` | Same minter unless split |

No `BURNER_ROLE`. `burn(tokenId)` is ERC721Burnable (current owner or approved). Deploy mints then burns token 0 so live inventory starts at 1.

### Functions we use

`mint(to)`, `burn(tokenId)`, `pause`/`unpause`, `totalSupply`, `tokenByIndex`, `tokenURI` (= `baseURI + id`), standard ERC-721. No `vaultRef`, `mintBatch`, `adminBurn`, ERC-2981, or `contractURI`. Cert uniqueness and metadata live in Postgres / Pinata.

### Design invariants

1. One active NFT per physical card — **Postgres** (vault cycle + `rwa_tokens` unique index)
2. Token IDs never reused — OZ Counters
3. Live inventory starts at 1 — deploy burns token 0
4. Token holders *can* self-burn on-chain (OZ); Tokenable UI never calls burn
5. No proxy — behavior change = new deploy + env swap

---

## Backend Chain Writer

**File:** `backend/src/blockchain/rwa-chain-writer.service.ts`

The single backend service that signs and submits transactions. Uses two keys:

| Key env var | Purpose |
|-------------|---------|
| `RWA_OWNER_PRIVATE_KEY` | Signs `mint(to)` (`MINTER_ROLE`) |
| `RWA_CUSTODY_WALLET_ADDRESS` | Where redeemers send NFTs (and mint deliver-from). Independent of fee wallet |
| `RWA_CUSTODY_PRIVATE_KEY` | Signs custody `safeTransferFrom` (deliver to user / return on refund). Defaults to owner key if unset |
| `PLATFORM_FEE_RECIPIENT` | Receives redeem USDC fees (+ self-vault sale proceeds) |
| `PLATFORM_FEE_PRIVATE_KEY` | Signs USDC outflows (self-vault seller payouts, redeem USDC refunds) |

Sepolia redeem v1 may set `RWA_CUSTODY_*` to the same values as `PLATFORM_FEE_*` **in env only** — do not couple them in code.

### Methods

| Method | Chain action |
|--------|-------------|
| `mintTo(to, tokenURI, vaultRef, chainId?, hooks?)` | OZ `mint(to)`. URI/vaultRef stay off-chain. Parses `Transfer` from 0 |
| `mintBatchTo(items[], chainId?)` | Sequential `mint(to)` (no on-chain batch) |
| `adminBurn(tokenId, chainId?, expectedOwner?)` | OZ `burn(tokenId)` as current owner (custody preferred) |
| `safeTransferFromCustody(tokenId, to, chainId?)` | Calls `safeTransferFrom(custody, to, tokenId)` with custody wallet |
| `getCustodyWalletAddress(chainId?)` | Resolves custody wallet address |

### Pre-flight checks

`adminBurn` reads `ownerOf` first. The burn signer must be that owner (usually custody). `expectedOwner` is checked in the backend.

`safeTransferFromCustody` verifies:
- Token exists on-chain
- Token is owned by the custody wallet
- Custody signer address matches `RWA_CUSTODY_WALLET_ADDRESS`

### Write serialization (nonce safety)

All transaction-sending methods run through an in-process lock keyed by `(chainId, signer address)` (`withSignerLock`). Concurrent writes from the same EOA race the account nonce ("nonce already used" / "replacement underpriced"); the lock chains them so each tx is submitted and mined before the next one signs. Writes for different chains or different signer keys still run in parallel. A failed write does not block the chain — the next queued write proceeds.

---

## Chain Config Service

**File:** `backend/src/blockchain/chain-config.service.ts`

Resolves per-chain configuration from env vars. Used throughout the backend for RPC providers and contract addresses.

| Method | Returns |
|--------|---------|
| `getDefaultChainId()` | `DEFAULT_CHAIN_ID` env if it is in `SUPPORTED_CHAIN_IDS`, else `11155111` |
| `resolveChainId(headerValue?)` | From `x-tokenable-chain-id` header or default |
| `getRpcUrl(chainId)` | `CHAIN_{id}_RPC_URL` |
| `getRwaAddress(chainId)` | `CHAIN_{id}_RWA_ADDRESS` |
| `getUsdcAddress(chainId)` | `CHAIN_{id}_USDC_ADDRESS` |
| `createJsonRpcProvider(chainId?)` | Pre-configured ethers JsonRpcProvider |

---

## Blockchain Service (read-only)

**File:** `backend/src/blockchain/blockchain.service.ts`

Read-only contract calls via a pre-built `Contract` instance (injected via `TOKENABLE_RWA_CONTRACT` token).

| Method | Description |
|--------|-------------|
| `getRwaInfo()` | name, symbol, totalMinted (= `totalSupply`, live count) |
| `listLiveTokenIds()` | ERC721Enumerable `tokenByIndex` |
| `getMintedTokenIdFromTx(hash)` | Parse mint `Transfer` from `address(0)` |
| `getRwaTokenOwner(tokenId)` | `ownerOf(tokenId)` — throws NotFoundException if not minted |
| `getRwaTokenURI(tokenId)` | `tokenURI(tokenId)` |
| `getRwaTokensByOwner(address)` | Owner index / enumerable scan |
| `batchOwnerOf(tokenIds[])` | Parallel `ownerOf` calls |

---

## Seaport Integration

**Version:** Seaport 1.5 (OpenSea)  
**Address:** `0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC` (canonical on supported EVM chains)  
**Settlement:** USDC (6 decimals)  
**Order storage:** signed parameters + signature in Postgres `orders` (not an on-chain order book)

Seller UX for taking token offers: [seaport-accept-offer.md](./seaport-accept-offer.md). REST surface: [../api/marketplace.md](../api/marketplace.md).

### Trading flow

**Ask listing (seller):**
1. Frontend calls `setApprovalForAll(Seaport, true)` on TokenableRWA if needed
2. Read `Seaport.getCounter(offerer)` for nonce
3. Build Seaport order: offer = ERC-721, consideration = USDC
   - **standard:** seller + platform fee (default **5%** / `PLATFORM_FEE_BPS=500`)
   - **self_vault_hold:** seller USDC + platform fee (`SELF_VAULT_PLATFORM_FEE_BPS`, default 10%). Legacy single-line full-platform-take asks may still exist in the order book.
4. EIP-712 sign via Privy SDK or MetaMask
5. `POST /api/marketplace/orders` → stored in `orders` table (backend rejects self-vault asks that are not full-platform-take)

**Partner consignment ask (admin bulk mint+list):** same Seaport shape, but the backend signs with the entrusted company private key (`PartnerSeaportAskService`) after minting to that wallet. Listing UIs resolve `sellerDisplayName` from `marketplace_partners` by offerer address. The vault badge uses token `settlement_policy` / `vaultLabel` (`PSA Vault` vs `Tokenable Vault`), not seller identity — a partner may list PSA-vaulted cards. Admin / partner portal still show `{partner} Vault`.

**Self-vault delayed payout:** after fulfill, `self_vault_settlements` tracks confirm + admin `execute-payout` or auto payout (~5 min). Uses `PLATFORM_FEE_PRIVATE_KEY` USDC → seller. See BR-8c and [self-vault-hold-settlement.md](./self-vault-hold-settlement.md).

**Buy (buyer):**
1. USDC `approve(Seaport, maxUint256)` if allowance is below the ask price (one-time; later buys skip this)
2. `Seaport.fulfillOrder(order, fulfillerConduitKey)` — on-chain
3. After the tx mines, backend `PATCH /api/marketplace/orders/:hash/fulfill` **requires** `Seaport.getOrderStatus` to show the order filled — a reverted wallet tx must not flip listing status or `owner_wallet`

**Token offer (bid on a specific `tokenId`):**
1. Bid offers USDC; consideration is ERC-721 for that token (itemType 2)
2. Seller settles via Edit price / Accept offer (`matchAdvancedOrders` or related fulfill paths) — see ADR

**Criteria bid (collection-level):**
1. Merkle tree over collection token IDs
2. Bid offers USDC for any token in collection (itemType 4 = ERC721_WITH_CRITERIA)
3. Can instant-match against floor asks via `matchAdvancedOrders`

### Platform fee

Encoded in standard ask `consideration` arrays (not on bids):

```env
NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT=0x...
NEXT_PUBLIC_PLATFORM_FEE_BPS=500   # 5% — keep in sync with backend PLATFORM_FEE_BPS
```

Frontend fallback when the env var is unset (but recipient is set) is also **500**. Marketplace fees are Seaport consideration only (the OZ preset has no ERC-2981).

---

## IPFS (Pinata)

| Operation | Service | File |
|-----------|---------|------|
| Upload metadata + image | `PinataService` | `rwa/pinata/pinata.service.ts` |
| Resolve IPFS URI → HTTPS | `IpfsGatewayResolverService` | `blockchain/ipfs-gateway-resolver.service.ts` |

Metadata format follows OpenSea ERC-721 standard with additional `properties.graded` namespace for PSA data.

---

## Deployment scripts

| Command | Script | Purpose |
|---------|--------|---------|
| `pnpm deploy:rwa:sepolia` | `scripts/deploy-tokenable-rwa.ts` | Deploy unmodified OZ ERC721 preset (burns token 0) |
| `pnpm deploy:rwa:polygon` | same | Polygon |
| `pnpm deploy:rwa:mainnet` | same | Ethereum mainnet |
| `pnpm sync-abi` | `scripts/sync-abi.mjs` | Copy ABI → `backend/src/blockchain/abis/tokenable-rwa.abi.ts` |

There is **no upgrade path**. A new NFT means a new address. See [`docs/guides/mainnet-multisig-deploy.md`](../guides/mainnet-multisig-deploy.md) for the deploy flow and role layout.

After deploying a new contract, update:
- `contracts/.env` — Sepolia / Polygon / mainnet RWA address vars used by Hardhat
- `backend/.env` — `CHAIN_11155111_RWA_ADDRESS` (and `CHAIN_137_*` / `CHAIN_1_*` as needed)
- `frontend/.env` — `NEXT_PUBLIC_CHAIN_11155111_RWA` (and matching `NEXT_PUBLIC_CHAIN_137_*` / `_1_*`)
- `backend/sql/seed/dev-platform-chart-fills.sql` — `rwa_contract` variable
- `backend/src/swagger/fixtures.ts` — `rwaContract`

---

## Contract tests

**File:** `contracts/test/OzErc721Preset.test.ts`

Coverage: constructor roles, mint, consume-token-0 convention, owner burn, pause, grant MINTER_ROLE. No custom Tokenable Solidity to test.

Run: `cd contracts && pnpm test`

---

## Networks

| Chain | ID | Usage | USDC |
|-------|----|-------|------|
| Ethereum Sepolia | 11155111 | Default development / public test | Circle testnet USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| Ethereum mainnet | 1 | Production | Circle USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Polygon mainnet | 137 | Internal / QA (multi-chain) | Native USDC: `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |

Polygon Amoy (`80002`) is **not** in `SUPPORTED_CHAIN_IDS` and is not used by the current app config.
