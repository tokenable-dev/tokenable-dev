# Seaport Demo — Sepolia

OpenSea Seaport 프로토콜을 이용한 ERC-721 NFT 거래 데모.  
Sepolia 테스트넷에서 실행되며, 추후 **Arbitrum** 이전 시 동일 코드 재사용 가능.

## 핵심 개념

```
현재 방식 (SkyMarketplace)        Seaport 방식
────────────────────────────────────────────────────────
listItem()  → 온체인 트랜잭션      서명(sign)  → 가스 없음
buyItem()   → 온체인 트랜잭션      fulfill()   → 온체인 트랜잭션
주문 저장   → 블록체인              주문 저장   → 백엔드 DB
```

---

## 빠른 시작

### 1. 의존성 설치

```bash
cd seaport-demo
pnpm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열고 아래 항목 작성:

| 항목 | 설명 |
|---|---|
| `ALCHEMY_RPC_URL` | [Alchemy](https://dashboard.alchemy.com) → Ethereum Sepolia 앱 생성 |
| `PRIVATE_KEY` | MetaMask → Account Details → Export Private Key (Seller) |
| `BUYER_PRIVATE_KEY` | 별도 Buyer 지갑 (없으면 생략 — Seller로 테스트) |

### 3. Sepolia ETH 받기

| 소스 | 링크 |
|---|---|
| Alchemy Faucet | https://sepoliafaucet.com |
| Chainlink Faucet | https://faucets.chain.link/sepolia |
| Infura Faucet | https://www.infura.io/faucet/sepolia |

**필요 수량**: Seller 0.005 ETH 이상, Buyer 0.005 ETH 이상

---

## Step 1: TestNFT 배포 & Mint

```bash
npm run deploy-nft
```

출력 예시:
```
Deployer: 0xABC...
Balance : 0.05 ETH

Deploying TestNFT...
✅ TestNFT deployed to: 0x1234...abcd

Minting token #0...
✅ Minted token #0 to 0xABC...

─── Add these to your .env ───
NFT_CONTRACT_ADDRESS=0x1234...abcd
TOKEN_ID=0
```

출력된 값을 `.env`에 복사.

---

## Step 2: 데모 실행

### 방법 A: 한 번에 실행 (create + fulfill)

```bash
pnpm demo
```

### 방법 B: 단계별 실행 (실제 서비스 흐름)

```bash
# Seller가 주문 생성 → order.json 저장
pnpm create

# Buyer가 주문 체결 → 블록체인 트랜잭션
pnpm fulfill
```

---

## 출력 예시

```
🌐 Network: sepolia (chainId: 11155111)
👤 Seller : 0xABC...
   Balance: 0.045 ETH
👤 Buyer  : 0xDEF...
   Balance: 0.032 ETH

💎 NFT   : 0x1234...abcd #0
💰 Price : 0.001 ETH

─── Step 1: Create Sell Order ───────────────────────────────
(NFT approve + EIP-712 서명 — 최초 approve 시에만 가스 소모)
✅ Order created (off-chain):
{
  "parameters": { ... },
  "signature": "0xabcd..."
}

─── Step 2: Fulfill Order (Buy) ─────────────────────────────
(온체인 트랜잭션 — ETH 지불 + NFT 수령)
✅ Transaction sent: 0x9999...
   Waiting for confirmation...
✅ Confirmed at block: 7654321
   Gas used: 165432

🎉 NFT #0 transferred to 0xDEF...
```

---

## 파일 구조

```
seaport-demo/
├── contracts/
│   └── TestNFT.sol          # 테스트용 ERC-721 (누구나 mint)
├── scripts/
│   └── deploy.js            # TestNFT 배포 + mint
├── index.js                 # 메인 데모 (create + fulfill)
├── 1-create-order.js        # 주문 생성만 → order.json
├── 2-fulfill-order.js       # order.json 읽어 구매 처리
├── seaport.js               # Seaport 헬퍼 함수
├── hardhat.config.js
├── .env.example
└── README.md
```

---

## Arbitrum 이전 시 변경사항

```
변경 없음:
  - seaport.js 코드 전체
  - index.js 코드 전체
  - TestNFT.sol → TokenableRWA.sol (프로덕션) 재배포

변경 필요:
  - ALCHEMY_RPC_URL → Arbitrum One RPC
  - NFT_CONTRACT_ADDRESS → Arbitrum 재배포 주소
  - SELL_PRICE_ETH → 실제 USDC 로직 (consideration에 ERC-20 추가)
```

Seaport 1.5 컨트랙트(`0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC`)는  
Sepolia와 Arbitrum에 **동일 주소**로 배포되어 있어 재배포 불필요.

---

## 트러블슈팅

| 에러 | 원인 | 해결 |
|---|---|---|
| `insufficient funds` | ETH 부족 | 위 faucet에서 받기 |
| `not owner` | TOKEN_ID가 PRIVATE_KEY 지갑 소유 아님 | deploy.js 재실행 |
| `order expired` | endTime 초과 | order.json 삭제 후 재생성 |
| `cannot estimate gas` | NFT approve 안 됨 | seaport.js의 executeAllActions가 자동 처리 |
