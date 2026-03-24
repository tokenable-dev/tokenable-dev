# develop 브랜치 → 개발 서버 배포

개발 단계 기준 프론트 URL: **http://54.116.29.201/** (nginx가 `/` → Next, `/api` → Nest)

## 1. GitHub Repository secrets

다음이 설정되어 있어야 `develop` 푸시 시 CI가 통과합니다.

| Secret | 예시 값 |
|--------|---------|
| `NEXT_PUBLIC_API_URL` | `http://54.116.29.201/api` |
| `NEXT_PUBLIC_ALCHEMY_RPC_URL` | `https://eth-sepolia.g.alchemy.com/v2/<키>` |
| `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS` | Sepolia 배포 NFT 컨트랙트 |
| `NEXT_PUBLIC_USDC_CONTRACT_ADDRESS` | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| `NEXT_PUBLIC_MARKETPLACE_ADDRESS` | (미사용 시 빈 값 가능) |
| `NEXT_PUBLIC_PINATA_GATEWAY` | `xxx.mypinata.cloud` |
| `ECR_REGISTRY`, `AWS_*`, `DEV_EC2_*` | 기존과 동일 |

**Google OAuth**는 콘솔에 JavaScript 출처·리디렉션 URI를 위 호스트와 맞출 것. IP만 거부되면 `http://54-116-29-201.nip.io` 로 통일하는 방식을 사용할 수 있음.

## 2. EC2 백엔드 환경 파일

서버에 `backend/.env.production` 내용을 저장해 두고, 워크플로가 복사하도록 함:

- 파일 경로 예: `/home/ubuntu/.env.production.backend`
- 내용은 `backend/.env.production.example` 참고 (`FRONTEND_URL`, `CORS_ORIGIN`, `GOOGLE_CALLBACK_URL` 이 **54.116.29.201** 기준).

DB 마이그레이션은 최초 1회 `backend/sql/migrations/` SQL 실행.

## 3. 로컬에서 브랜치 병합 후 푸시 (자동 배포)

```bash
cd /path/to/tokenable-dev
git checkout develop
git pull origin develop
git merge seaportSDK   # 병합할 브랜치명
# 충돌 해결 후
git push origin develop
```

`develop`에 푸시되면 GitHub Actions가 이미지 빌드·ECR 푸시·EC2 `docker-compose pull && up` 까지 수행합니다.

## 4. EC2에서 수동으로만 다시 띄우고 싶을 때

```bash
ssh ubuntu@<DEV_EC2_HOST>
cd /home/ubuntu/app
git pull origin develop
cp /home/ubuntu/.env.production.backend ./backend/.env.production
export ECR_REGISTRY=<ECR_REGISTRY>
export IMAGE_TAG=develop
docker compose pull
docker compose up -d --force-recreate --remove-orphans
```

## 5. 프론트 빌드만 로컬에서 검증

```bash
cd frontend
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://54.116.29.201/api \
  --build-arg NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0x... \
  --build-arg NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 \
  --build-arg NEXT_PUBLIC_MARKETPLACE_ADDRESS= \
  --build-arg NEXT_PUBLIC_PINATA_GATEWAY=your.mypinata.cloud \
  --build-arg NEXT_PUBLIC_ALCHEMY_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY \
  -t tokenable-frontend:test .
```
