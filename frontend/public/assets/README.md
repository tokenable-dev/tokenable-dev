# Brand Assets

SVG, 아이콘, 이미지 등 브랜드 에셋을 관리하는 폴더입니다.

## 디렉터리 구조

```
assets/
├── logo/       # 로고 (풀 버전, 가로형)
├── icons/      # 아이콘 (favicon, 앱 아이콘, 정사각형)
└── images/     # 기타 이미지 (배경, 일러스트 등)
```

## 새 SVG 추가 방법

1. 해당 폴더에 파일 추가 (예: `logo/new-brand.svg`)
2. `constants/assets.ts`에 경로 등록:

```ts
export const ASSETS = {
  logo: {
    tokenable: `${ASSETS_BASE}/logo/tokenable.png`,
    newBrand: `${ASSETS_BASE}/logo/new-brand.svg`,  // 추가
  },
  // ...
};
```

3. 컴포넌트에서 `ASSETS.logo.newBrand` 또는 `<Image src={ASSETS.logo.newBrand} />` 사용

## 네이밍 규칙

- **로고**: `{브랜드명}.svg` (가로형 풀 로고)
- **아이콘**: `{브랜드명}-icon.svg` (정사각형, favicon용)
- **이미지**: `{용도}-{설명}.svg` 또는 `.png`
