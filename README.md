# NFT Marketplace

A decentralized NFT marketplace that enables users to mint, list, and trade NFTs. Built as a monorepo with a modern Web3 stack.

---

## Project Description

This project is a full-stack NFT marketplace that allows users to:

- **Mint** NFTs by uploading images and metadata to IPFS
- **List** owned NFTs for sale with USDC pricing
- **Purchase** NFTs from the marketplace using USDC
- **View** NFT details, activity history, and magnified image previews

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
- **Pinata** — IPFS pinning for NFT assets
- **Swagger** — API documentation

### Smart Contracts

- **Solidity**
- **Hardhat** — Development and deployment
- **OpenZeppelin** — ERC-721, ERC-20, and security patterns

### Blockchain / Web3

- **EVM-compatible chain** (e.g., Hyperledger Besu)
- **MetaMask** — Wallet connection
- **IPFS** — Decentralized storage for NFT metadata and images

---

## Repository Structure

```
nft-marketplace/
├── frontend/     # User interface for interacting with the marketplace
├── backend/      # API server, business logic, and blockchain integration
└── contracts/    # Smart contracts for NFT minting, listing, and trading
```

| Folder       | Description                                                                 |
| ------------ | --------------------------------------------------------------------------- |
| **frontend** | Next.js application for wallet connection, NFT minting, browsing, and trading |
| **backend**  | NestJS API server handling IPFS uploads, blockchain reads, and marketplace data |
| **contracts** | Solidity contracts: SkyNFT (ERC-721), MockUSDC (ERC-20), SkyMarketplace |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- MetaMask (or compatible wallet)

### 1. Clone the repository

```bash
git clone <repository-url>
cd nft-marketplace
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

Copy the example env files and fill in your values:

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env.local

# Contracts
cp contracts/.env.example contracts/.env
```

Required variables include RPC URL, contract addresses, and Pinata credentials for IPFS.

### 4. Deploy smart contracts

```bash
cd contracts
pnpm run deploy:usdc      # Deploy MockUSDC
pnpm run deploy:nft       # Deploy SkyNFT
pnpm run deploy:marketplace  # Deploy SkyMarketplace
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

## Future Features

- [ ] **NFT minting** — Upload and mint NFTs with IPFS metadata
- [ ] **NFT listing** — List owned NFTs for sale with USDC pricing
- [ ] **NFT purchasing** — Buy listed NFTs with USDC
- [ ] **Wallet connection** — MetaMask and other EVM wallets
- [ ] **Marketplace fees** — Configurable platform fees on sales
- [ ] **Auction support** — Time-based auctions for NFTs

---

## License

Proprietary. All rights reserved.
