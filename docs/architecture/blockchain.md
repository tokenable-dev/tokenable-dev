# Blockchain Architecture

## Overview

Tokenable uses **Ethereum** (Sepolia testnet 11155111 + mainnet 1) for:

- **TokenableRWA** — ERC-721 NFT contract representing physical PSA-graded cards
- **Seaport 1.5** — off-chain order book with on-chain USDC settlement (Vault channel)
- **TokenablePaymentEscrow** — USDC hold until P2P buyer confirm / timeout / arbiter refund
- **USDC (Circle)** — settlement currency for all marketplace trades

The backend is the sole on-chain writer for mint/burn (and escrow arbiter refund). Users sign Seaport trades and P2P escrow deposit/confirm via Privy or MetaMask.

P2P details: [p2p-payment-escrow.md](./p2p-payment-escrow.md). Deploy escrow: `cd contracts && pnpm deploy:escrow:sepolia`.

---

## TokenableRWA Contract

**Type:** UUPS upgradeable ERC-721 + ERC-2981 + AccessControl + Pausable  
**Solidity:** 0.8.20 | **OpenZeppelin:** 4.9.6 upgradeable  
**Source:** `contracts/contracts/TokenableRWA.sol`

### Roles

| Role | Keccak ID | Purpose | Current holder |
|------|-----------|---------|----------------|
| `DEFAULT_ADMIN_ROLE` | `0x00...00` | Upgrades, royalty, contractURI, role grants | Deployer EOA |
| `MINTER_ROLE` | `keccak256("MINTER_ROLE")` | `mint`, `mintBatch` | Backend hot wallet |
| `BURNER_ROLE` | `keccak256("BURNER_ROLE")` | `adminBurn` | Backend hot wallet |
| `PAUSER_ROLE` | `keccak256("PAUSER_ROLE")` | `pause`, `unpause` | Backend hot wallet |

V1: all roles granted to the same backend EOA at `initialize()`. Can be split later via `grantRole()` without a contract upgrade.

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `initialize(admin, minter, royaltyReceiver, royaltyBps)` | once | Sets up roles; token IDs start at **1** (`_nextTokenId = 1`) |
| `mint(to, tokenURI, vaultRef)` | MINTER, not paused | Reverts `VaultRefAlreadyActive` if cert already backed; emits `Minted` |
| `mintBatch(to[], uris[], vaultRefs[])` | MINTER, not paused | Max **50** per batch. Backend bulk mint jobs chunk larger requests (up to 500) into multiple `mintBatch` txs |
| `adminBurn(tokenId, expectedOwner)` | BURNER | Clears `activeTokenIdOf(vaultRef)`; allows `address(0)` to skip ownership check; **not paused** (burns work while paused) |
| `pause` / `unpause` | PAUSER | Blocks mint/transfer; burns still allowed |
| `setDefaultRoyalty(receiver, bps)` | ADMIN | ERC-2981 royalty |
| `setContractURI(uri)` | ADMIN | EIP-7572 collection metadata |
| `vaultRef(tokenId)` | view | Returns permanent vaultRef (survives burn) |
| `activeTokenIdOf(vaultRef)` | view | Returns tokenId or 0 if no active token |
| `isVaultRefActive(vaultRef)` | view | Boolean wrapper |
| `totalMinted()` | view | Monotonic counter (includes burned) = `_nextTokenId - 1` |
| `contractURI()` | view | Collection-level metadata URL |
| ERC-721 standard | — | `ownerOf`, `tokenURI`, `safeTransferFrom`, etc. |
| ERC-2981 standard | — | `royaltyInfo(tokenId, salePrice)` |

### Events

| Event | Fields | When |
|-------|--------|------|
| `Minted(to, tokenId, vaultRef indexed, tokenURI)` | — | After successful `mint()` |
| `Burned(tokenId, burnedBy, vaultRef)` | — | After successful `adminBurn()` |
| `ContractURIUpdated(newURI)` | — | After `setContractURI()` |
| `RoyaltyUpdated(receiver, feeBps)` | — | After `setDefaultRoyalty()` |
| ERC-721 `Transfer` | from, to, tokenId | Standard |

### Custom errors

| Error | Trigger |
|-------|---------|
| `ZeroAddress` | `to == address(0)` in mint |
| `EmptyTokenURI` | Empty tokenURI in mint |
| `EmptyVaultRef` | Zero-bytes vaultRef in mint |
| `VaultRefAlreadyActive(vaultRef, existingTokenId)` | Cert still backed by live NFT |
| `OwnerMismatch` | `adminBurn` with non-zero `expectedOwner` that doesn't match on-chain owner |
| `ArrayLengthMismatch` | `mintBatch` arrays of different lengths |
| `BatchTooLarge` | Batch > 50 |

### Design invariants

1. **One active NFT per physical card** — enforced by `activeTokenIdByVaultRef` mapping
2. **Token IDs never reused** — `_nextTokenId` only increments
3. **Burns work while paused** — `_beforeTokenTransfer` skips pause check when `to == address(0)`
4. **No permissionless owner burn** — only `BURNER_ROLE` can burn; users initiate via `POST /rwa/redeem-batch`
5. **vaultRef is permanent** — stored per tokenId even after burn (audit trail)
6. **UUPS proxy** — implementation can be upgraded without changing the proxy address

---

## Backend Chain Writer

**File:** `backend/src/blockchain/rwa-chain-writer.service.ts`

The single backend service that signs and submits transactions. Uses two keys:

| Key env var | Purpose |
|-------------|---------|
| `RWA_OWNER_PRIVATE_KEY` | Signs `mint()` (MINTER_ROLE) and `adminBurn()` (BURNER_ROLE) |
| `RWA_CUSTODY_WALLET_ADDRESS` | Where redeemers send NFTs (and mint deliver-from). Independent of fee wallet |
| `RWA_CUSTODY_PRIVATE_KEY` | Signs custody `safeTransferFrom` (deliver to user / return on refund). Defaults to owner key if unset |
| `PLATFORM_FEE_RECIPIENT` | Receives redeem USDC fees (+ self-vault sale proceeds) |
| `PLATFORM_FEE_PRIVATE_KEY` | Signs USDC outflows (self-vault seller payouts, redeem USDC refunds) |

Sepolia redeem v1 may set `RWA_CUSTODY_*` to the same values as `PLATFORM_FEE_*` **in env only** — do not couple them in code.

### Methods

| Method | Chain action |
|--------|-------------|
| `mintTo(to, tokenURI, vaultRef, chainId?)` | Calls `mint(to, tokenURI, vaultRef)` with owner wallet |
| `mintBatchTo(items[], chainId?)` | Calls `mintBatch` (max **50** items); returns `tokenIds[]` + `txHash` |
| `adminBurn(tokenId, chainId?, expectedOwner?)` | Calls `adminBurn(tokenId, owner)` after BURNER_ROLE check |
| `safeTransferFromCustody(tokenId, to, chainId?)` | Calls `safeTransferFrom(custody, to, tokenId)` with custody wallet |
| `getCustodyWalletAddress(chainId?)` | Resolves custody wallet address |

### Pre-flight checks

`adminBurn` verifies that the backend wallet has `BURNER_ROLE` before attempting the transaction — returns a clear error message if not.

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
| `getDefaultChainId()` | `DEFAULT_CHAIN_ID` env (default: 80002) |
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
| `getRwaInfo()` | name, symbol, totalMinted |
| `getRwaTokenOwner(tokenId)` | `ownerOf(tokenId)` — throws NotFoundException if not minted |
| `getRwaTokenURI(tokenId)` | `tokenURI(tokenId)` |
| `getRwaTokensByOwner(address)` | Scans all minted tokens for matching owner |
| `batchOwnerOf(tokenIds[])` | Parallel `ownerOf` calls |

---

## Seaport Integration

**Version:** Seaport 1.5  
**Address:** `0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC` (all EVM chains)  
**Settlement:** USDC (6 decimals)

### Trading flow

**Ask listing (seller):**
1. Frontend calls `setApprovalForAll(Seaport, true)` on TokenableRWA if needed
2. Read `Seaport.getCounter(offerer)` for nonce
3. Build Seaport order: offer = ERC-721, consideration = USDC
   - **standard:** seller + platform fee (~5%)
   - **self_vault_hold:** single consideration = 100% USDC to `PLATFORM_FEE_RECIPIENT` (no $0 seller line)
4. EIP-712 sign via Privy SDK or MetaMask
5. `POST /api/marketplace/orders` → stored in `orders` table (backend rejects self-vault asks that are not full-platform-take)

**Partner consignment ask (admin bulk mint+list):** same Seaport shape, but the backend signs with the entrusted company private key (`PartnerSeaportAskService`) after minting to that wallet. Listing UIs resolve `sellerDisplayName` from `marketplace_partners` by offerer address. The vault badge uses token `settlement_policy` / `vaultLabel` (`PSA Vault` vs `Tokenable Vault`), not seller identity — a partner may list PSA-vaulted cards. Admin / partner portal still show `{partner} Vault`.

**Self-vault delayed payout:** after fulfill, `self_vault_settlements` tracks confirm + admin `execute-payout` or auto payout (~5 min). Uses `PLATFORM_FEE_PRIVATE_KEY` USDC → seller. See BR-8c.

**Buy (buyer):**
1. USDC `approve(Seaport, maxUint256)` if allowance is below the ask price (one-time; later buys skip this)
2. `Seaport.fulfillOrder(order, fulfillerConduitKey)` — on-chain
3. `PATCH /api/marketplace/orders/:hash/fulfill` — backend marks order fulfilled

**Criteria bid (collection-level):**
1. Merkle tree over collection token IDs
2. Bid offers USDC for any token in collection (itemType 4 = ERC721_WITH_CRITERIA)
3. Can instant-match against floor asks via `matchAdvancedOrders`

### Platform fee

Encoded in every ask's `consideration` array:

```env
NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT=0x...
NEXT_PUBLIC_PLATFORM_FEE_BPS=500   # 5%
```

ERC-2981 royalty is a separate mechanism (contract-level, not Seaport consideration).

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
| `pnpm deploy:rwa:sepolia` | `scripts/deploy-tokenable-rwa-uups.ts` | Deploy UUPS proxy to Sepolia |
| `pnpm deploy:rwa:polygon` | same | Deploy to Polygon mainnet (`POLYGON_RPC_URL`) |
| `pnpm deploy:rwa:mainnet` | same | Deploy to Ethereum mainnet |
| `pnpm upgrade:rwa:sepolia` | `scripts/upgrade-tokenable-rwa.ts` | Upgrade implementation (proxy unchanged); auto-grants BURNER_ROLE |
| `pnpm upgrade:rwa:polygon` | same | Upgrade on Polygon |
| `pnpm grant-burner:sepolia` | `scripts/grant-rwa-burner-role.ts` | Manually grant BURNER_ROLE |
| `pnpm grant-burner:polygon` | same | Grant BURNER_ROLE on Polygon |
| `pnpm sync-abi` | `scripts/sync-abi.mjs` | Copy ABI → `backend/src/blockchain/abis/tokenable-rwa.abi.ts` |

After deploying a new contract, update:
- `contracts/.env` — Sepolia / Polygon / mainnet RWA address vars used by Hardhat
- `backend/.env` — `CHAIN_11155111_RWA_ADDRESS` (and `CHAIN_137_*` / `CHAIN_1_*` as needed)
- `frontend/.env` — `NEXT_PUBLIC_CHAIN_11155111_RWA` (and matching `NEXT_PUBLIC_CHAIN_137_*` / `_1_*`)
- `backend/sql/seed/dev-platform-chart-fills.sql` — `rwa_contract` variable
- `backend/src/swagger/fixtures.ts` — `rwaContract`

---

## Contract tests

**File:** `contracts/test/TokenableRWA.test.ts`

Coverage includes: initialization, mint, vaultRef invariant, mintBatch, adminBurn, pause, ERC-2981 royalty, contractURI, UUPS upgrade, and full lifecycle (mint → transfer → burn → re-mint cycle).

Run: `cd contracts && pnpm test`

---

## Networks

| Chain | ID | Usage | USDC |
|-------|----|-------|------|
| Ethereum Sepolia | 11155111 | Development / testnet | Circle testnet USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| Polygon mainnet | 137 | Internal / QA (multi-chain) | Native USDC: `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |
| Ethereum mainnet | 1 | Production | Circle USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
