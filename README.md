# Tokenable RWA Marketplace

A decentralized marketplace for real-world asset (RWA) tokens on EVM chains. Users mint, list, and trade ERC-721–backed assets with USDC. Built as a monorepo with a modern Web3 stack.

---

## Project Description

This project is a full-stack RWA marketplace that allows users to:

- **Mint** RWAs by uploading images and metadata to IPFS
- **List** owned assets for sale with USDC pricing (Seaport off-chain orders)
- **Purchase** listings or place **collection-wide criteria bids** (USDC, Merkle-anchored token sets)
- **View** asset details, activity history, and magnified image previews

The application is designed for EVM-compatible chains and follows a non-custodial model where users retain control of their assets until a sale is completed.

---

## Tech Stack

### Frontend

- **React** / **Next.js** (App Router)
- **wagmi** + **viem** — Ethereum wallet connection and contract interaction
- **Tailwind CSS** — Styling
- **Zustand** — Global state management
- **TanStack Query** — Data fetching and caching

### Backend

- **Node.js** / **TypeScript**
- **NestJS** — API framework
- **ethers.js** — Blockchain interaction
- **Pinata** — IPFS pinning for RWA assets
- **Swagger** — API documentation

### Smart Contracts

- **Solidity**
- **Hardhat** — Development and deployment
- **OpenZeppelin** — ERC-721, ERC-20, and security patterns

### Blockchain / Web3

- **Ethereum Sepolia** (testnet)
- **MetaMask** — Wallet connection
- **IPFS** — Decentralized storage for RWA metadata and images

---

## Repository Structure

```
tokenable-dev/
├── frontend/     # User interface for interacting with the marketplace
├── backend/      # API server, business logic, and blockchain integration
└── contracts/    # Smart contracts for RWA minting, listing, and trading
```

| Folder       | Description                                                                 |
| ------------ | --------------------------------------------------------------------------- |
| **frontend** | Next.js application for wallet connection, RWA minting, browsing, and trading |
| **backend**  | NestJS API server handling IPFS uploads, blockchain reads, and marketplace data |
| **contracts** | Solidity: TokenableRWA (ERC-721), MockUSDC (ERC-20) — trading uses OpenSea Seaport (no custom marketplace contract) |

---

## Documentation

| Document | Contents |
|----------|----------|
| **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** | DB reset, TypeORM, API summary, Seaport, deploy, PSA troubleshooting, diagram index |
| **[docs/price-api.md](docs/price-api.md)** | JustTCG price API (long reference) |
| **[backend/sql/README.md](backend/sql/README.md)** | Why there are no SQL migrations |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- MetaMask (or compatible wallet)

### 1. Clone the repository

```bash
git clone <repository-url>
cd tokenable-dev
```

### 2. Install dependencies

```bash
# Frontend
cd frontend && pnpm install

# Backend
cd ../backend && pnpm install

# Contracts
cd ../contracts && pnpm install
```

### 3. Configure environment variables

Create env files yourself (not committed):

- `backend/.env` — RPC, Postgres, Pinata, JWT/Google 등 (`RWA_CONTRACT_ADDRESS` 권장; 레거시 `NFT_CONTRACT_ADDRESS` 호환)
- `frontend/.env.local` — `NEXT_PUBLIC_*` (로컬에서만; `NEXT_PUBLIC_RWA_CONTRACT_ADDRESS` 권장)
- `contracts/.env` — 배포용 private key / RPC 등

필수 항목은 RPC URL, 컨트랙트 주소, IPFS(Pinata) 자격 증명 등이다.

### 4. Deploy smart contracts

```bash
cd contracts
# Requires contracts/.env: DEPLOYER_PRIVATE_KEY, SEPOLIA_RPC_URL
pnpm run deploy:usdc      # MockUSDC → Sepolia
pnpm run deploy:rwa       # TokenableRWA → Sepolia (same as deploy:rwa-sepolia)
```

Update `backend/.env` and `frontend/.env.local` with the deployed contract addresses.

### 5. Run the application

```bash
# Terminal 1 — Backend (port 4000)
cd backend && pnpm start:dev

# Terminal 2 — Frontend (port 3000)
cd frontend && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your wallet.

### LAN access (same WiFi)

To access from another device (e.g. phone) on the same network:

1. Find your machine's IP (e.g. `192.168.45.101`) and open `http://<IP>:3000`.
2. **Backend CORS**: Add your IP to `backend/.env`:
   ```
   CORS_ORIGIN=http://localhost:3000,http://192.168.45.101:3000
   ```
3. Restart the backend. The frontend auto-detects the host and calls the API at `<IP>:4000`.

---

## Future ideas

- Marketplace fees, auctions, multi-chain, etc. (track separately from this README.)

---

## License

Proprietary. All rights reserved.
