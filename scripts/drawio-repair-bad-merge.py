#!/usr/bin/env python3
"""Insert mxCells dropped by an older drawio-merge-pages.py bug (cells[2:] after regex
that skipped self-closing id=0/1). Run once on the broken merged file."""
from __future__ import annotations

import re
import sys

# Each entry: unique marker substring -> XML to insert immediately BEFORE marker
REPAIRS: list[tuple[str, str]] = [
    (
        '<mxCell id="pg02_m3" ',
        """        <mxCell id="pg02_mt" value="NFT 민팅 흐름 (가스: 사용자 · 수령: 사용자 지갑)" style="text;html=1;strokeColor=none;fillColor=none;fontSize=16;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="40" y="1310" width="480" height="30" as="geometry" />
        </mxCell>
        <mxCell id="pg02_m2" value="1. 지갑 연결&#xa;(wagmi) + Sepolia" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;" vertex="1" parent="1">
          <mxGeometry x="40" y="1370" width="140" height="70" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg03_a3BidBox" ',
        """        <mxCell id="pg03_a3Hdr" value="마켓플레이스 — 오프체인 주문 DB + 온체인 Seaport (가스: 트랜잭션 발신자)" style="text;html=1;strokeColor=none;fillColor=none;fontSize=16;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="40" y="2400" width="700" height="30" as="geometry" />
        </mxCell>
        <mxCell id="pg03_a3AskBox" value="매도 리스팅 (ask)&#xa;① NFT approve(Seaport) — 가스·판매자&#xa;② Seaport EIP-712 서명&#xa;③ POST /marketplace/orders (side=ask)&#xa;→ DB 활성 리스팅" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;" vertex="1" parent="1">
          <mxGeometry x="40" y="2450" width="280" height="110" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg04_a3" ',
        """        <mxCell id="pg04_at" value="인증 · 계정 (온체인과 별도 레이어)" style="text;html=1;fontSize=16;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="40" y="3560" width="400" height="30" as="geometry" />
        </mxCell>
        <mxCell id="pg04_a2" value="Google OAuth&#xa;→ JWT (httpOnly 쿠키)&#xa;GET /auth/me" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;" vertex="1" parent="1">
          <mxGeometry x="40" y="3650" width="200" height="80" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg05_laneUser" ',
        """        <mxCell id="pg05_t1" value="CeFi / 하이브리드 제안 — 내부 원장 중심 + 선택적 온체인 (베스트 프랙티스 스케치)" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=17;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="40" y="20" width="900" height="36" as="geometry" />
        </mxCell>
        <mxCell id="pg05_t2" value="핵심: 사용자는 '계정·잔액·주문'을 플랫폼이 신뢰할 수 있는 원장으로 처리하고, 블록체인은 정산·출금·감사용으로 선택적 사용." style="text;html=1;strokeColor=none;fillColor=#fff9e6;align=left;fontSize=11;fontStyle=2" vertex="1" parent="1">
          <mxGeometry x="40" y="52" width="920" height="28" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg06_f3" ',
        """        <mxCell id="pg06_f1" value="가입·로그인&#xa;(이메일·OAuth 등)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;" vertex="1" parent="1">
          <mxGeometry x="40" y="1290" width="140" height="60" as="geometry" />
        </mxCell>
        <mxCell id="pg06_f2" value="KYC / 한도&#xa;(정책에 따라)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;" vertex="1" parent="1">
          <mxGeometry x="40" y="1370" width="140" height="60" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg07_zcol2" ',
        """        <mxCell id="pg07_ztitle" value="B3 — CeFi vs DeFi 비교 (요약)" style="text;html=1;fontSize=16;fontStyle=1;align=left" vertex="1" parent="1">
          <mxGeometry x="40" y="2360" width="520" height="28" as="geometry" />
        </mxCell>
        <mxCell id="pg07_zcol1" value="항목" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#f5f5f5;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="40" y="2450" width="140" height="36" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg08_t_users" ',
        """        <mxCell id="pg08_erdTitle" value="PostgreSQL — 로컬 스키마 (ERD 요약)" style="text;html=1;fontSize=16;fontStyle=1;align=left" vertex="1" parent="1">
          <mxGeometry x="40" y="20" width="520" height="28" as="geometry" />
        </mxCell>
        <mxCell id="pg08_sub" value="도메인: users, marketplace_collections, orders, bucket_bids — 상세는 docs/LOCAL_DATABASE.md" style="text;html=1;fontSize=11;fontStyle=2;align=left;fillColor=#fff9e6;" vertex="1" parent="1">
          <mxGeometry x="40" y="52" width="900" height="40" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg09_b1" ',
        """        <mxCell id="pg09_t0" value="Tokenable — Seaport 사용 구조 (프로젝트 기준)" style="text;html=1;strokeColor=none;fillColor=none;align=left;fontSize=18;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="40" y="20" width="520" height="32" as="geometry" />
        </mxCell>
        <mxCell id="pg09_t0b" value="Seaport 1.5 = ERC-721 NFT ↔ USDC 스왑 주문만. 백엔드는 주문 저장·검증; 체결 트랜잭션은 사용자 지갑. 상세 문서: docs/SEAPORT_PROTOCOL_OVERVIEW.md" style="text;html=1;strokeColor=none;fillColor=#fff9e6;align=left;fontSize=11;fontStyle=2" vertex="1" parent="1">
          <mxGeometry x="40" y="52" width="920" height="36" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg10_c2" ',
        """        <mxCell id="pg10_pt" value="Seaport 주문 3가지 (모두 DB orders, side·연결만 다름)" style="text;html=1;fontSize=16;fontStyle=1;align=left" vertex="1" parent="1">
          <mxGeometry x="40" y="1380" width="600" height="28" as="geometry" />
        </mxCell>
        <mxCell id="pg10_c1" value="매도 리스팅&#xa;side = ask&#xa;────────────&#xa;offer: NFT (ERC-721)&#xa;consideration: USDC → 판매자&#xa;서명: 판매자 (offerer)&#xa;체결: 구매자가 fulfillOrder" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontStyle=0;align=left;spacingLeft=10;verticalAlign=top;" vertex="1" parent="1">
          <mxGeometry x="40" y="1460" width="280" height="160" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg11_q1" ',
        """        <mxCell id="pg11_qt" value="풀(컬렉션) 입찰 → Seaport 로 이어지는 지점만 도식화" style="text;html=1;fontSize=16;fontStyle=1;align=left" vertex="1" parent="1">
          <mxGeometry x="40" y="2580" width="560" height="28" as="geometry" />
        </mxCell>
        <mxCell id="pg11_q0" value="(범례) 풀 등록은 Seaport 트랜잭션이 아님 — EIP-712 CollectionBid 후 DB" style="text;html=1;fontSize=11;fontStyle=2;align=left;fillColor=#fff9e6;" vertex="1" parent="1">
          <mxGeometry x="40" y="2610" width="720" height="24" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg12_r2" ',
        """        <mxCell id="pg12_rt" value="D4 — Seaport 범위 밖 (이 프로젝트에서 별도 흐름)" style="text;html=1;fontSize=16;fontStyle=1;align=left" vertex="1" parent="1">
          <mxGeometry x="40" y="3640" width="560" height="28" as="geometry" />
        </mxCell>
        <mxCell id="pg12_r1" value="민팅·IPFS·OAuth&#xa;(Seaport 미사용)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f8cecc;" vertex="1" parent="1">
          <mxGeometry x="40" y="3750" width="160" height="60" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg13_tabs" ',
        """        <mxCell id="pg13_e2eHdr" value="Tokenable — 코드 기준 E2E 프로세스 (접속 → 민팅 → 판매)" style="text;html=1;fontSize=20;fontStyle=1;align=left" vertex="1" parent="1">
          <mxGeometry x="40" y="20" width="800" height="36" as="geometry" />
        </mxCell>
        <mxCell id="pg13_sub" value="저장소 기준: frontend (Next.js+wagmi+viem), backend (NestJS), Sepolia, Pinata JWT, JustTCG x-api-key, PSA Public API token(선택)" style="text;html=1;fontSize=11;fillColor=#fff9e6;align=left" vertex="1" parent="1">
          <mxGeometry x="40" y="52" width="1100" height="28" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg14_be" ',
        """        <mxCell id="pg14_e2eHdr" value="01 — 민팅 탭: PSA 슬랩 분석 (OCR + PSA API + JustTCG)" style="text;html=1;fontSize=17;fontStyle=1;align=left" vertex="1" parent="1">
          <mxGeometry x="40" y="1500" width="700" height="32" as="geometry" />
        </mxCell>
        <mxCell id="pg14_fe" value="프론트 MintForm.tsx&#xa;· analyzePsaSlab() → POST /api/psa/analyze&#xa;  multipart: slabFront (필수), slabBack, certNumber(힌트)&#xa;· 응답: ocr, psa, psaApi, justtcg, psaCertImages" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;align=left;spacingLeft=8;fontSize=11" vertex="1" parent="1">
          <mxGeometry x="40" y="1560" width="340" height="100" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg15_be" ',
        """        <mxCell id="pg15_e2eHdr" value="02 — POST /nft/upload: Pinata(IPFS) + tokenURI" style="text;html=1;fontSize=17;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="40" y="3180" width="600" height="30" as="geometry" />
        </mxCell>
        <mxCell id="pg15_fe" value="프론트: uploadNft(formData)&#xa;· name, description, image|imageUrl, gradedMetadata(JSON)&#xa;· MintForm: gasWithCap 없음 (서버만)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;align=left;spacingLeft=8;fontSize=11" vertex="1" parent="1">
          <mxGeometry x="40" y="3240" width="380" height="80" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg16_b2" ',
        """        <mxCell id="pg16_e2eHdr" value="03 — 온체인 민팅 (사용자 가스)" style="text;html=1;fontSize=17;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="40" y="4670" width="400" height="28" as="geometry" />
        </mxCell>
        <mxCell id="pg16_b1" value="MintForm handleSubmit&#xa;· publicClient + writeContractAsync&#xa;· gasWithCap( TOKENABLE_RWA, mint ABI )&#xa;· writeContract: functionName mint&#xa;  args: [address, tokenURI]&#xa;  → NFT 수령 주소 = 연결 지갑&#xa;· useWaitForTransactionReceipt" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fad9d5;align=left;spacingLeft=8;fontSize=11;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="40" y="4730" width="400" height="140" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg17_s2" ',
        """        <mxCell id="pg17_e2eHdr" value="04 — My Assets → 판매 리스팅 (Seaport ask)" style="text;html=1;fontSize=17;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="40" y="5960" width="500" height="30" as="geometry" />
        </mxCell>
        <mxCell id="pg17_s1" value="① useReadContract Seaport getCounter(판매자 주소)&#xa;② writeContract TOKENABLE_RWA approve( SEAPORT, tokenId )&#xa;③ walletClient.signTypedData&#xa;   domain: Seaport 1.5, verifyingContract SEAPORT&#xa;   types: SEAPORT_ORDER_TYPES, primaryType OrderComponents&#xa;   message: offer=NFT, consideration=USDC→판매자&#xa;④ createOrder() POST /marketplace/orders side=ask&#xa;⑤ 백엔드 createOrder → DB orders + collection_key 등" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;align=left;spacingLeft=8;fontSize=10;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="40" y="6020" width="520" height="160" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg18_b2" ',
        """        <mxCell id="pg18_e2eHdr" value="05 — 마켓에서 매도 리스팅 구매 (ask 이행)" style="text;html=1;fontSize=17;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="40" y="20" width="500" height="30" as="geometry" />
        </mxCell>
        <mxCell id="pg18_b1" value="marketplace/[tokenId]/page handleBuy&#xa;① USDC approve( SEAPORT, priceInUnits ) — writeContractAsync&#xa;② waitForTransactionReceipt&#xa;③ Seaport fulfillOrder( orderTuple, fulfillerConduitKey )&#xa;   order = parameters+signature from GET /orders/:hash&#xa;④ waitForTransactionReceipt — status reverted 검사&#xa;⑤ fulfillOrderApi(orderHash) PATCH .../fulfill&#xa;⑥ invalidateQueries 마켓·MyNFTs" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;align=left;spacingLeft=8;fontSize=10;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="40" y="55" width="560" height="150" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg19_e6poolB" ',
        """        <mxCell id="pg19_e2eHdr" value="06 — 풀 입찰 (CollectionBid) → Seaport bid → 체결" style="text;html=1;fontSize=17;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="40" y="1520" width="560" height="30" as="geometry" />
        </mxCell>
        <mxCell id="pg19_e6poolA" value="A) 풀 등록 (Seaport 아님)&#xa;· walletClient.signTypedData TokenableCollectionBid&#xa;  COLLECTION_BID_DOMAIN / TYPES (collectionBidTypedData.ts)&#xa;· createPoolBid POST /bucket-bids → bucket_bids DB" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;align=left;spacingLeft=8;fontSize=10" vertex="1" parent="1">
          <mxGeometry x="40" y="1555" width="480" height="90" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg20_note" ',
        """        <mxCell id="pg20_e2eHdr" value="07 — 함수 · HTTP · 외부 API 체크리스트 (구현 기준)" style="text;html=1;fontSize=17;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="40" y="3640" width="600" height="30" as="geometry" />
        </mxCell>
        <mxCell id="pg20_tbl" value="외부 API&#xa;· JustTCG: https://api.justtcg.com/v1 (games, sets, cards) — PriceService&#xa;· PSA Public API: https://api.psacard.com/publicapi — PsaPublicApiService (토큰 시)&#xa;· Pinata: SDK upload.public.file / 메타 JSON&#xa;&#xa;온체인 (wagmi write/read)&#xa;· Tokenable_RWA: mint, approve&#xa;· USDC: approve, balanceOf&#xa;· Seaport: getCounter, fulfillOrder&#xa;· 지갑: signTypedData (Seaport + CollectionBid)&#xa;&#xa;백엔드 HTTP (일부)&#xa;· POST /psa/analyze&#xa;· POST /nft/upload&#xa;· POST /marketplace/orders&#xa;· GET /marketplace/orders, /orders/:hash&#xa;· PATCH .../cancel, .../fulfill&#xa;· POST /bucket-bids, .../prepare-fulfill, .../validate-seller&#xa;· GET /blockchain/nft/*&#xa;· GET /price/cards (프론트 직접도 가능)&#xa;&#xa;OCR&#xa;· Tesseract.js (서버 psa.service.ts)" style="rounded=0;whiteSpace=wrap;html=1;align=left;spacingLeft=10;fillColor=#fafafa;fontFamily=Lucida Console;fontSize=10;" vertex="1" parent="1">
          <mxGeometry x="40" y="3680" width="720" height="420" as="geometry" />
        </mxCell>
""",
    ),
    (
        '<mxCell id="pg21_e8Detail" ',
        """        <mxCell id="pg21_e2eHdr" value="08 — Exchange 탭: 리스팅·컬렉션 조회 (읽기 API)" style="text;html=1;fontSize=17;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="40" y="5090" width="560" height="30" as="geometry" />
        </mxCell>
        <mxCell id="pg21_e8MktBox" value="Marketplace.tsx&#xa;· useQuery getActiveOrders → GET /api/marketplace/orders&#xa;· getMarketplaceCollections → GET /api/marketplace/collections&#xa;· side!=bid 필터 = ask 리스팅 카드&#xa;· 컬렉션 카드: activeListingCount&gt;0&#xa;· USDC 잔액: 스토어/지갑 (표시용)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;align=left;spacingLeft=8;fontSize=10" vertex="1" parent="1">
          <mxGeometry x="40" y="5230" width="480" height="120" as="geometry" />
        </mxCell>
""",
    ),
]


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "docs/diagrams/tokenable-all-diagrams.drawio"
    raw = open(path, encoding="utf-8").read()
    for marker, block in REPAIRS:
        if marker not in raw:
            print(f"SKIP (marker not found): {marker[:50]}...", file=sys.stderr)
            continue
        m = re.search(r'<mxCell[^>]+id="([^"]+)"', block)
        if m and f'id="{m.group(1)}"' in raw:
            continue
        raw = raw.replace(marker, block + marker, 1)
    open(path, "w", encoding="utf-8").write(raw)
    print(f"Patched {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
