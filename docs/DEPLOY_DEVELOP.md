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

시크릿은 **레포 밖**에 둔다 (권한 이슈로 `~/app/backend/`에 `cp` 하지 않음):

- 파일 경로: `/home/ubuntu/.env.production.backend`
- CI·EC2 모두 `docker-compose.yml` + **`docker-compose.ec2.yml`** 을 같이 쓴다 (백엔드 `env_file` 이 위 경로로 오버라이드됨)
- `FRONTEND_URL`, `CORS_ORIGIN`, `GOOGLE_CALLBACK_URL` 등은 **54.116.29.201** 기준으로 맞출 것.

DB 마이그레이션은 최초 1회 `backend/sql/migrations/` SQL 실행.

**로컬에서 Docker로 전체 띄울 때:** `docker-compose.yml`만으로는 백엔드 `env_file`이 없음.  
`backend/.env` 를 준비한 뒤  
`docker compose -f docker-compose.yml -f docker-compose.local.yml up` 사용.

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
export ECR_REGISTRY=<ECR_REGISTRY>
export IMAGE_TAG=develop
docker compose -f docker-compose.yml -f docker-compose.ec2.yml pull
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --force-recreate --remove-orphans
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
