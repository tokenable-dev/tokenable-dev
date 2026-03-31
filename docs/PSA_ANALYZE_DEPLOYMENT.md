# PSA `/api/psa/analyze` — 로컬 OK / 배포 500 시 점검

배포 환경에서만 `POST /api/psa/analyze` 가 **500 Internal Server Error** 를 내는 경우, 아래를 순서대로 확인합니다.

## 1. 백엔드 로그의 실제 예외

`PsaController` 는 분석 실패 시 **에러 메시지와 스택**을 로그에 남깁니다. EC2(또는 컨테이너)에서:

```bash
docker compose logs -f backend --tail=200
# 또는
journalctl -u your-backend -n 100
```

로그에 `PSA analyze failed:` 뒤에 나오는 문자열이 원인입니다.

## 2. 흔한 원인

### A. Docker 이미지가 Alpine + `sharp` / `tesseract.js` 조합

- **sharp** 는 플랫폼별 네이티브 바이너리를 씁니다.  
  `node:alpine`(musl) 환경에서 빌드/실행이 어긋나면 런타임에 `sharp` 로드 실패 등으로 예외가 납니다.
- **tesseract.js** 는 워커·WASM을 띄웁니다. 메모리 제한이나 파일 시스템 제약이 있으면 실패할 수 있습니다.

**대응:** 레포의 `backend/Dockerfile` 은 **Debian bookworm-slim** 기준으로 맞추는 것을 권장합니다. 이미지를 다시 빌드·배포해 보세요.

### B. 메모리 부족 (작은 EC2 / t2.micro 등)

- 슬랩 이미지 OCR + 이미지 전처리는 **수백 MB** 를 잠깐 쓸 수 있습니다.
- OOM 으로 프로세스가 죽으면 프록시/게이트웨이에 따라 502/500 으로 보일 수 있습니다.

**대응:** 인스턴스 메모리 상향, 또는 `docker-compose` 에 `mem_limit` 완화 후 재시도.

### C. 아웃바운드 네트워크

- 분석 중 **PSA 공개 API**, **JustTCG**, **PSA 이미지 URL HEAD** 요청이 나갑니다.  
  (코드상 JustTCG 실패는 대부분 잡히지만, 그 외 단계에서 네트워크 예외가 나면 500 으로 이어질 수 있습니다.)
- VPC 보안 그룹 / NACL에서 **HTTPS 아웃바운드**가 막혀 있지 않은지 확인하세요.

### D. 환경 변수

- **`TCG_API_KEY`** 가 없으면 앱이 **기동 단계에서** 실패합니다. (기동만 되면 이 키는 있음)
- **`PSA_PUBLIC_API_TOKEN`** 이 없어도 분석 자체는 동작해야 합니다(토큰 없이 비활성화).  
  토큰이 있으면 PSA API 호출이 추가되며, 실패는 응답 객체로 돌아오도록 되어 있습니다.

### E. 리버스 프록시 본문 크기

- 업로드가 막히면 보통 **413** 이지만, 설정에 따라 이상한 응답이 날 수 있습니다.
- Nginx 예: `client_max_body_size 20m;` (Multer 한도는 15MB)

## 3. 컨테이너 안에서 빠른 확인

```bash
docker exec -it <backend-container> node -e "require('sharp'); console.log('sharp ok')"
docker exec -it <backend-container> node -e "require('tesseract.js'); console.log('tesseract ok')"
```

`sharp` / `tesseract.js` 로드 단계에서 에러가 나면, 위와 같은 네이티브/런타임 문제 가능성이 큽니다.
