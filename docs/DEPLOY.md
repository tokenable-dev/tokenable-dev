# 배포 가이드 (develop → EC2)

`develop` 브랜치 푸시 시 GitHub Actions가 ECR에 이미지를 올리고, EC2에서 `docker-compose`로 당겨 쓰는 흐름입니다. **이 문서만 순서대로** 따라 하면 됩니다.

---

## 사전 준비 (한 번만 확인)

### GitHub Repository secrets (Actions)

배포·프론트 빌드에 필요합니다. 이름은 대소문자까지 동일해야 합니다.

| Name | 설명 |
|------|------|
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | ECR 푸시 |
| `ECR_REGISTRY` | 예: `717728193407.dkr.ecr.ap-northeast-2.amazonaws.com` |
| `DEV_EC2_HOST`, `DEV_EC2_SSH_KEY` | develop 배포 시 EC2 SSH |
| `NEXT_PUBLIC_API_URL` | 예: `http://<공인IP>/api` |
| `NEXT_PUBLIC_RWA_CONTRACT_ADDRESS` | Sepolia TokenableRWA (필수) |
| `NEXT_PUBLIC_USDC_CONTRACT_ADDRESS` | Sepolia USDC |
| `NEXT_PUBLIC_ALCHEMY_RPC_URL`, `NEXT_PUBLIC_PINATA_GATEWAY` | 프론트 번들용 |

`NEXT_PUBLIC_*`는 **Repository secrets**에 두는 것이 기본입니다. Variables에만 두면 워크플로가 못 읽을 수 있어, 레포의 `deploy.yml`은 Secrets 우선·Variables 폴백을 쓰도록 되어 있습니다.

### EC2

- 앱 경로: **`/home/ubuntu/app`** (레포 클론)
- 백엔드 환경: **`/home/ubuntu/.env.production.backend`** (`docker-compose.ec2.yml`에서 `env_file`로 주입)

---

## 1. 로컬 — 커밋 후 푸시

```bash
cd /path/to/tokenable-dev
git checkout develop
git pull origin develop
# 변경 반영 후
git add -A
git commit -m "your message"
git push origin develop
```

---

## 2. GitHub Actions

리포지토리 **Actions** 탭에서 **Deploy** 워크플로가 **성공**할 때까지 기다립니다 (Build & Push + Deploy to Dev Server).

---

## 3. EC2 — 이미지 pull & 컨테이너 기동

SSH 접속 후:

```bash
cd /home/ubuntu/app

export ECR_REGISTRY=717728193407.dkr.ecr.ap-northeast-2.amazonaws.com
export IMAGE_TAG=develop

git fetch origin
git checkout develop
git pull origin develop

aws ecr get-login-password --region ap-northeast-2 \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

docker-compose -f docker-compose.yml -f docker-compose.ec2.yml pull
docker-compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --force-recreate --remove-orphans
```

> 서버에 `docker compose`(V2)만 있으면 위 명령의 `docker-compose`를 모두 `docker compose`로 바꿉니다.

---

## 4. 백엔드만 다시 올릴 때 (필요 시)

`.env.production.backend`만 수정했을 때 등:

```bash
cd /home/ubuntu/app
export ECR_REGISTRY=717728193407.dkr.ecr.ap-northeast-2.amazonaws.com
export IMAGE_TAG=develop
docker-compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --force-recreate backend
```

---

## 5. Postgres — 빈 DB일 때 (테이블 없음)

`\dt`에 아무 관계도 없으면, 레포의 부트스트랩 SQL을 **한 번** 적용합니다.

```bash
docker exec tokenable-postgres psql -U tokenable -d tokenable -c '\dt'
```

비어 있으면:

```bash
docker exec -i tokenable-postgres psql -U tokenable -d tokenable < /home/ubuntu/app/backend/sql/bootstrap-empty-prod-db.sql
docker exec tokenable-postgres psql -U tokenable -d tokenable -c '\dt'
```

`users`, `orders`, `marketplace_collections`가 보이면 됩니다.

그다음 **`/home/ubuntu/.env.production.backend`에서 `TYPEORM_SYNC`는 제거하거나 `false`**로 두고, 위 **4번**으로 백엔드를 재기동하세요. (운영에서는 스키마 자동 동기화를 켜 둔 채로 두지 않는 것이 안전합니다.)

---

## 6. 동작 확인

- 브라우저: `http://<공인IP>` (시크릿 창 또는 강력 새로고침)
- Network: `/api/marketplace/orders`, `/api/marketplace/collections` → **200**
- 세션: `/api/auth/session` → **200** + 비로그인 시 `{ "user": null }` (해당 브랜치 배포 시)

---

## 7. 자주 쓰는 점검

```bash
docker-compose -f docker-compose.yml -f docker-compose.ec2.yml ps
docker logs tokenable-backend 2>&1 | tail -80
docker exec tokenable-backend env | grep -E 'TYPEORM|POSTGRES|NODE_ENV'
```

---

## 8. 프론트 번들에 주소가 안 박히는 경우

`NEXT_PUBLIC_RWA_CONTRACT_ADDRESS` 등은 **Docker 빌드 시** 번들에 들어갑니다. Secrets/Variables에 값이 있고 Actions가 성공한 뒤, EC2에서 **프론트 이미지를 pull·재기동**해야 브라우저에 반영됩니다.

---

## 관련 파일

| Path | 내용 |
|------|------|
| `.github/workflows/deploy.yml` | ECR 빌드·푸시, EC2 배포 단계 |
| `docker-compose.yml` / `docker-compose.ec2.yml` | 서비스·이미지 태그·백엔드 `env_file` |
| `frontend/Dockerfile` | `NEXT_PUBLIC_*` build-arg |
| `backend/sql/bootstrap-empty-prod-db.sql` | 빈 DB 초기 스키마 |
| `docs/DEVELOPMENT.md` | 로컬 개발·기타 상세 |
