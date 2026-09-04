export type DataInventoryDomainId =
  | 'catalog'
  | 'markets'
  | 'portfolio'
  | 'trading'
  | 'people'
  | 'vault'
  | 'other';

export type DataStoreCatalogEntry = {
  id: string;
  table: string;
  domain: DataInventoryDomainId;
  label: string;
  description: string;
  howAccumulated: string;
  adminPagePath: string | null;
};

export const DATA_INVENTORY_DOMAINS: {
  id: DataInventoryDomainId;
  label: string;
  summary: string;
}[] = [
  {
    id: 'catalog',
    label: '카탈로그·민트',
    summary:
      '컬렉션, RWA 토큰, 파트너 벌크 민트 — 볼트에 들어온 카드·민트 작업당 1행.',
  },
  {
    id: 'markets',
    label: '시세·Cardhedger',
    summary:
      '컬렉션 시세 스냅샷, Top 100, 야간 델타 임포트 — 워커가 갱신. 히스토리 테이블은 덮어쓰지 않음.',
  },
  {
    id: 'portfolio',
    label: '포트폴리오·워치리스트',
    summary:
      '일별 지갑 평가액(KST 09:00 크론), 보유 원가, 저장한 컬렉션.',
  },
  {
    id: 'trading',
    label: '거래',
    summary: 'Seaport 오프체인 주문과 P2P 에스크로 정산 기록.',
  },
  {
    id: 'people',
    label: '계정·감사',
    summary: 'Privy 계정, 연결 지갑, KYC 상태 전환(append-only).',
  },
  {
    id: 'vault',
    label: '볼트 라이프사이클',
    summary:
      '실물 카드 레지스트리와 입금→민트→리딤 사이클(PSA 인증번호 기준).',
  },
  {
    id: 'other',
    label: '기타 테이블',
    summary:
      '카탈로그에 아직 설명이 없는 public 스키마 테이블 — 스키마에 있으면 여기에도 표시됩니다.',
  },
];

/** Static catalog — row counts and timestamps are filled at runtime. */
export const DATA_STORE_CATALOG: DataStoreCatalogEntry[] = [
  {
    id: 'marketplace_collections',
    table: 'marketplace_collections',
    domain: 'catalog',
    label: '마켓플레이스 컬렉션',
    description:
      'PSA 인증번호(collection_key)당 1버킷. 표시명, 커버, components JSON(PSA·Cardhedger), 리뷰 상태.',
    howAccumulated:
      'RWA 민트 / 벌크 민트 prepare 시 생성. 어드민 리뷰·커버 업로드·시세 스냅샷 워커가 갱신.',
    adminPagePath: '/marketplace/admin/collections',
  },
  {
    id: 'rwa_tokens',
    table: 'rwa_tokens',
    domain: 'catalog',
    label: 'RWA 토큰 레지스트리',
    description:
      '온체인 tokenId ↔ PSA 인증번호 매핑. 어드민 번 시 burned_at 기록.',
    howAccumulated:
      '민트 성공마다 1행. 토큰 ID는 증가만 하며 재사용하지 않음.',
    adminPagePath: '/marketplace/admin/cards',
  },
  {
    id: 'bulk_mint_jobs',
    table: 'bulk_mint_jobs',
    domain: 'catalog',
    label: '파트너 벌크 민트 잡',
    description:
      '배치 민트 세션 — 파트너 지갑, prepare/commit 상태, 아이템 수.',
    howAccumulated:
      '파트너 벌크 민트에서 cert+가격 CSV 업로드 시 생성. prepare → commit 진행.',
    adminPagePath: '/marketplace/admin/bulk-mint',
  },
  {
    id: 'bulk_mint_job_items',
    table: 'bulk_mint_job_items',
    domain: 'catalog',
    label: '벌크 민트 라인 아이템',
    description: '벌크 잡 안 cert별 행 — 가격, prepare 오류, mint tx.',
    howAccumulated: '부모 잡과 함께 삽입, cert별 prepare·민트 시 갱신.',
    adminPagePath: '/marketplace/admin/bulk-mint',
  },
  {
    id: 'marketplace_partners',
    table: 'marketplace_partners',
    domain: 'catalog',
    label: '위탁 파트너',
    description: '회사 표시명 + 파트너 민트/리스팅용 핫월렛.',
    howAccumulated: 'Partners 페이지에서 어드민 CRUD.',
    adminPagePath: '/marketplace/admin/partners',
  },
  {
    id: 'collection_market_snapshots',
    table: 'collection_market_snapshots',
    domain: 'markets',
    label: '컬렉션 시세 스냅샷',
    description:
      'collection_key별 Cardhedger 시세 머티리얼라이즈 — 플로어, 스파크라인, preview JSON, 신선도.',
    howAccumulated:
      '델타 임포트 또는 컬렉션 조회 시 스냅샷 워커가 upsert. 컬렉션당 히스토리 행은 없음(제자리 갱신).',
    adminPagePath: '/marketplace/admin/collections',
  },
  {
    id: 'card_top100_daily_snapshots',
    table: 'card_top100_daily_snapshots',
    domain: 'markets',
    label: 'Top 100 일별 스냅샷',
    description:
      'Cardhedger Top 100 — KST 날짜 × 카테고리 × 등급당 1행. cards_json에 최대 100장.',
    howAccumulated:
      '일일 크론(KST). 매일 새 행, 이전 날짜는 히스토리 API용으로 유지.',
    adminPagePath: '/marketplace/admin/markets?tab=top100',
  },
  {
    id: 'cardhedger_price_delta_import_runs',
    table: 'cardhedger_price_delta_import_runs',
    domain: 'markets',
    label: '시세 델타 임포트 실행 로그',
    description:
      'Cardhedger price-updates 폴링마다 감사 로그 — 매칭 컬렉션, 체크포인트, 오류.',
    howAccumulated:
      '야간 크론 + Price sync의 수동 실행. append-only.',
    adminPagePath: '/marketplace/admin/price-webhooks',
  },
  {
    id: 'cardhedger_price_delta_checkpoints',
    table: 'cardhedger_price_delta_checkpoints',
    domain: 'markets',
    label: '시세 델타 체크포인트',
    description:
      '싱글톤(id=1) — 마지막 델타 `since` ISO 시각.',
    howAccumulated: '델타 임포트 성공 후 갱신.',
    adminPagePath: '/marketplace/admin/price-webhooks',
  },
  {
    id: 'cardhedger_price_subscriptions',
    table: 'cardhedger_price_subscriptions',
    domain: 'markets',
    label: 'Cardhedger 시세 구독',
    description:
      '웹훅 시세 푸시용으로 등록된 Cardhedger card ID(구독 기능 켜진 경우).',
    howAccumulated: '컬렉션 카탈로그에서 어드민 시세 구독 API로 동기화.',
    adminPagePath: '/marketplace/admin/price-webhooks',
  },
  {
    id: 'cardhedger_daily_price_export_runs',
    table: 'cardhedger_daily_price_export_runs',
    domain: 'markets',
    label: '일별 시세 CSV export 로그',
    description: 'Cardhedger 야간 CSV export(Enterprise) 감사 로그.',
    howAccumulated:
      'CARDHEDGER_DAILY_EXPORT_CSV_ENABLED 시 크론 — append-only.',
    adminPagePath: '/marketplace/admin/price-webhooks',
  },
  {
    id: 'portfolio_daily_snapshots',
    table: 'portfolio_daily_snapshots',
    domain: 'portfolio',
    label: '포트폴리오 일별 스냅샷',
    description:
      '지갑 시가평가 합계(KST 날짜) — Portfolio 히어로·24h P/L 차트.',
    howAccumulated:
      '매일 KST 09:00 크론이 온체인 홀더 스캔. 크론 누락 시 읽기 경로에서 오늘 백필 가능.',
    adminPagePath: '/marketplace/admin/portfolio',
  },
  {
    id: 'portfolio_holdings',
    table: 'portfolio_holdings',
    domain: 'portfolio',
    label: '포트폴리오 보유 설정',
    description:
      '지갑 × tokenId — 원가 USD, 출처(수동/볼트 전달/마켓 구매), 숨김 플래그.',
    howAccumulated:
      '볼트 전달·주문 체결 시 시드, 사용자 수동 수정 유지. 보유 토큰당 1행.',
    adminPagePath: '/marketplace/admin/portfolio',
  },
  {
    id: 'user_watchlist',
    table: 'user_watchlist',
    domain: 'portfolio',
    label: '유저 워치리스트',
    description: '로그인 유저가 저장한 collection_key 목록.',
    howAccumulated: '컬렉션 페이지에서 워치리스트 토글.',
    adminPagePath: '/marketplace/admin/users',
  },
  {
    id: 'orders',
    table: 'orders',
    domain: 'trading',
    label: 'Seaport 주문',
    description:
      '오프체인 ask/bid — active·fulfilled·cancelled·expired. GMV 분석용 체결 테이프.',
    howAccumulated:
      '리스팅/비드 시 생성, 체결·취소·만료 시 상태 갱신.',
    adminPagePath: '/marketplace/admin',
  },
  {
    id: 'p2p_orders',
    table: 'p2p_orders',
    domain: 'trading',
    label: 'P2P 에스크로 주문',
    description: 'P2P 리스팅 정산 — 구매자, 아비터 환불 경로.',
    howAccumulated: 'P2P 구매 시 생성, settle/refund 시 상태 전환.',
    adminPagePath: '/marketplace/admin/p2p',
  },
  {
    id: 'p2p_listings',
    table: 'p2p_listings',
    domain: 'trading',
    label: 'P2P 리스팅',
    description: 'P2P 에스크로용 판매자 리스팅(Seaport ask와 별개).',
    howAccumulated: '판매자 생성, 판매·취소 시 종료.',
    adminPagePath: '/marketplace/admin/p2p',
  },
  {
    id: 'users',
    table: 'users',
    domain: 'people',
    label: '유저 계정',
    description: 'Privy 연동 계정 — 이메일, KYC, 프로필.',
    howAccumulated: '첫 Privy 세션 동기화 시 생성.',
    adminPagePath: '/marketplace/admin/users',
  },
  {
    id: 'user_wallets',
    table: 'user_wallets',
    domain: 'people',
    label: '연결 지갑',
    description: '유저별 Privy에서 동기화한 지갑 주소.',
    howAccumulated: 'Privy 인증 세션마다 upsert.',
    adminPagePath: '/marketplace/admin/users',
  },
  {
    id: 'user_kyc_events',
    table: 'user_kyc_events',
    domain: 'people',
    label: 'KYC 감사 이벤트',
    description:
      'KYC 상태 전환 append-only(Sumsub 웹훅 + 어드민 오버라이드).',
    howAccumulated: '제자리 수정 없음 — 상태 변경마다 1행.',
    adminPagePath: '/marketplace/admin/users',
  },
  {
    id: 'vault_submissions',
    table: 'vault_submissions',
    domain: 'vault',
    label: '볼트 제출(셀 플로우)',
    description:
      '민트 전 패키지 추적 — draft → ship → PSA → completed. public_id SUB-…, 운송장.',
    howAccumulated:
      '셀 UI `/api/vault/submissions` 및 어드민 vault-submissions로 생성·갱신.',
    adminPagePath: '/marketplace/admin/vault/submissions',
  },
  {
    id: 'vault_submission_items',
    table: 'vault_submission_items',
    domain: 'vault',
    label: '볼트 제출 카드',
    description:
      '제출 패키지 안 cert별 행 — 등급/이미지, 카드 상태, 민트 후 vault_cycle_id.',
    howAccumulated: '드래프트 카드와 동기화, PSA 운영·민트 브리지가 상태 진행.',
    adminPagePath: '/marketplace/admin/vault/submissions',
  },
  {
    id: 'vault_assets',
    table: 'vault_assets',
    domain: 'vault',
    label: '볼트 자산',
    description:
      '실물 카드 레지스트리 — cert 번호, vaultRef 해시, 현재 라이프사이클 포인터.',
    howAccumulated: 'cert가 볼트 파이프라인에 들어오면 등록.',
    adminPagePath: '/marketplace/admin/vault',
  },
  {
    id: 'vault_cycles',
    table: 'vault_cycles',
    domain: 'vault',
    label: '볼트 사이클',
    description:
      '입금 → 검증 → 민트 → 리딤. 자산당 활성 사이클은 최대 1개.',
    howAccumulated: '입금 시 새 사이클, 리딤·취소 시 종료.',
    adminPagePath: '/marketplace/admin/vault',
  },
  {
    id: 'vault_redemptions',
    table: 'vault_redemptions',
    domain: 'vault',
    label: '볼트 리딤',
    description: '실물 카드 리딤 시 번 + 반송 기록.',
    howAccumulated: '리딤 요청·이행 시 생성.',
    adminPagePath: '/marketplace/admin/vault',
  },
];
