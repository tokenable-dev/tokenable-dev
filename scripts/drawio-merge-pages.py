#!/usr/bin/env python3
"""Merge multiple <diagram> pages into one with vertical stacking (y offsets)."""
from __future__ import annotations

import re
import sys

GAP = 90


def extract_diagrams(raw: str) -> list[tuple[str, str, str]]:
    out = []
    for m in re.finditer(
        r'(<diagram\s+id="(pg\d+)"[^>]*>)(.*?)(</diagram>)', raw, re.DOTALL
    ):
        out.append((m.group(1), m.group(3), m.group(2)))
    return out


def get_page_height(diagram_inner: str) -> int:
    m = re.search(r'pageHeight="(\d+)"', diagram_inner)
    return int(m.group(1)) if m else 800


def get_page_width(diagram_inner: str) -> int:
    m = re.search(r'pageWidth="(\d+)"', diagram_inner)
    return int(m.group(1)) if m else 1600


def split_mxcells(root_inner: str) -> list[str]:
    inner = root_inner.strip()
    return re.findall(r"<mxCell\b.*?</mxCell>", inner, re.DOTALL)


def offset_ys_in_string(s: str, dy: int) -> str:
    if dy == 0:
        return s

    def bump(m: re.Match[str]) -> str:
        return f'y="{int(m.group(1)) + dy}"'

    return re.sub(r'y="(\d+)"', bump, s)


def body_without_root_layer(root_inner: str) -> str:
    """Remove only root layer cells id 0 and id 1 (self-closing). Do not use
    cells[2:] on regex-split mxCells — id 0/1 are often self-closing and omitted
    from split_mxcells(), so cells[2:] would wrongly drop the first two *content* cells.
    """
    s = root_inner.strip()
    s = re.sub(r'<mxCell id="0"\s*/>\s*', "", s, count=1)
    s = re.sub(r'<mxCell id="1" parent="0"\s*/>\s*', "", s, count=1)
    return s


def offset_body_parent1(body: str, dy: int) -> str:
    """Add dy to y= in mxGeometry for cells whose parent is root layer (1)."""
    cells = split_mxcells(body) if body.strip() else []
    new_cells = []
    for c in cells:
        if re.search(r'parent="1"', c):
            c = offset_ys_in_string(c, dy)
        new_cells.append(c)
    return "\n        ".join(new_cells) + ("\n" if new_cells else "")


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "docs/diagrams/tokenable-all-diagrams.drawio"
    raw = open(path, encoding="utf-8").read()

    diagrams = extract_diagrams(raw)
    if len(diagrams) < 20:
        print(
            "ERROR: 이 스크립트는 병합 전 통합 파일(약 22개의 <diagram> 페이지)에서만 실행하세요. "
            f"현재 파일은 <diagram>이 {len(diagrams)}개입니다. "
            "Cursor에서 해당 .drawio 파일 우클릭 → 로컬 히스토리/타임라인에서 병합 이전 버전을 복원한 뒤 다시 실행하세요.",
            file=sys.stderr,
        )
        return 1
    id_map: dict[str, tuple[str, str]] = {}
    for _open_tag, inner, did in diagrams:
        gm = re.search(r"(<mxGraphModel[^>]*>)", inner)
        graph_open = gm.group(1) if gm else ""
        id_map[did] = (inner, graph_open)

    out: list[str] = [
        '<mxfile host="app.diagrams.net" modified="2026-03-30T12:00:00.000Z" '
        'agent="Mozilla/5.0 (compatible; draw.io)" version="24.7.7" type="device" compressed="false">\n'
    ]

    # INDEX
    idx_inner = id_map["pg00"][0]
    idx_root = re.search(r"<root>(.*)</root>", idx_inner, re.DOTALL)
    idx_content = idx_root.group(1) if idx_root else ""
    idx_content = idx_content.replace(
        'id="pg00_ixt" value="Tokenable — diagrams 통합 파일 (모든 페이지)"',
        'id="pg00_ixt" value="Tokenable — diagrams (7탭)"',
    )
    idx_content = idx_content.replace(
        'id="pg00_ixb" value="이 파일 = 기존 5개 drawio 병합. 하단 탭에서 섹션별로 이동.&#xa;&#xa;A — 아키텍처 (DeFi형 전체) : A1~A4&#xa;B — CeFi·하이브리드 제안 : B1~B3&#xa;C — 로컬 DB ERD : C1&#xa;D — Seaport 프로토콜 범위 : D1~D4&#xa;E — E2E 코드 기준 상세 : E0~E8&#xa;&#xa;문서: docs/LOCAL_DATABASE.md, SEAPORT_PROTOCOL_OVERVIEW.md, SEAPORT_API.md"',
        'id="pg00_ixb" value="이 파일 = 7탭으로 정리됨.&#xa;&#xa;01 — A: 전체구조 · 민팅 · 마켓·Seaport·풀 · 인증/백엔드&#xa;02 — B: CeFi·하이브리드 (개요 · 사용자여정 · 비교)&#xa;03 — C: PostgreSQL ERD (로컬 DB)&#xa;04 — D: Seaport (레이어 · 주문3종 · 풀연결 · 미사용구분)&#xa;05 — E: E2E 범례 ~ 리스팅 (E0~E4)&#xa;06 — E: E2E 구매 ~ Exchange (E5~E8)&#xa;&#xa;문서: docs/LOCAL_DATABASE.md, SEAPORT_PROTOCOL_OVERVIEW.md, SEAPORT_API.md"',
    )
    ph0 = get_page_height(idx_inner)
    pw0 = get_page_width(idx_inner)
    out.append(
        f'  <diagram id="pg00" name="00-INDEX-목차">\n'
        f'    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" '
        f'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
        f'pageWidth="{pw0}" pageHeight="{ph0}" math="0" shadow="0">\n'
        f"      <root>{idx_content}</root>\n"
        f"    </mxGraphModel>\n"
        f"  </diagram>\n"
    )

    groups = [
        ("pg01", "01-A-아키텍처-A1~A4", ["pg01", "pg02", "pg03", "pg04"]),
        ("pg02", "02-B-CeFi-하이브리드-B1~B3", ["pg05", "pg06", "pg07"]),
        ("pg03", "03-C-PostgreSQL-ERD", ["pg08"]),
        ("pg04", "04-D-Seaport-D1~D4", ["pg09", "pg10", "pg11", "pg12"]),
        ("pg05", "05-E-E2E-범례~리스팅-E0~E4", ["pg13", "pg14", "pg15", "pg16", "pg17"]),
        ("pg06", "06-E-E2E-구매~Exchange-E5~E8", ["pg18", "pg19", "pg20", "pg21"]),
    ]

    for new_id, name, srcs in groups:
        cumulative = 0
        max_w = 1600
        blocks: list[str] = []
        for i, did in enumerate(srcs):
            full_inner, graph_open = id_map[did]
            max_w = max(max_w, get_page_width(graph_open))
            ph = get_page_height(graph_open)
            rm = re.search(r"<root>(.*)</root>", full_inner, re.DOTALL)
            if not rm:
                continue
            body = body_without_root_layer(rm.group(1))
            body = offset_body_parent1(body, cumulative)
            blocks.append(body.rstrip())
            cumulative += ph + (GAP if i < len(srcs) - 1 else 0)
        total_h = max(cumulative + 40, 400)
        merged_root = (
            '\n        <mxCell id="0" />\n'
            '        <mxCell id="1" parent="0" />\n'
            + "\n        ".join(blocks)
            + "\n      "
        )
        out.append(
            f'  <diagram id="{new_id}" name="{name}">\n'
            f'    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" '
            f'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
            f'pageWidth="{max_w}" pageHeight="{total_h}" math="0" shadow="0">\n'
            f"      <root>{merged_root}</root>\n"
            f"    </mxGraphModel>\n"
            f"  </diagram>\n"
        )

    out.append("</mxfile>\n")
    open(path, "w", encoding="utf-8").writelines(out)
    n = len(groups) + 1
    print(f"Wrote {n} diagrams to {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
