#!/usr/bin/env python3
"""Report mxCell id collisions across <diagram> pages in a .drawio file.

Some Draw.io / VS Code integrations merge page models; duplicate ids across
pages can cause runtime errors (e.g. d.setId is not a function). Run:

  python3 scripts/drawio-check-duplicate-ids.py docs/diagrams/foo.drawio
"""
from __future__ import annotations

import re
import sys
from collections import defaultdict


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: drawio-check-duplicate-ids.py <file.drawio>", file=sys.stderr)
        return 2
    path = sys.argv[1]
    raw = open(path, encoding="utf-8").read()
    blocks = re.findall(r"<diagram[^>]+name=\"([^\"]+)\"[^>]*>(.*?)</diagram>", raw, re.DOTALL)
    if not blocks:
        blocks = re.findall(r"<diagram[^>]+>(.*?)</diagram>", raw, re.DOTALL)
        names = [f"diagram[{i}]" for i in range(len(blocks))]
    else:
        names = [b[0] for b in blocks]
        blocks = [b[1] for b in blocks]

    by_id: dict[str, list[tuple[int, str]]] = defaultdict(list)
    skip = {"0", "1"}
    for bi, block in enumerate(blocks):
        for m in re.finditer(r'<mxCell[^>]+id="([^"]+)"', block):
            iid = m.group(1)
            if iid in skip:
                continue
            by_id[iid].append((bi, names[bi] if bi < len(names) else str(bi)))

    dups = {k: v for k, v in by_id.items() if len(v) > 1}
    if not dups:
        print("OK: no duplicate mxCell ids across pages (excluding id 0 and 1).")
        return 0

    print(f"FAIL: {len(dups)} duplicate id(s) across pages:\n")
    for iid in sorted(dups.keys()):
        pages = sorted({p[1] for p in dups[iid]})
        print(f"  {iid!r}  →  {pages}")

    # First duplicate in file order (helps when merge is linear)
    seen: dict[str, int] = {}
    for m in re.finditer(r'<mxCell[^>]+id="([^"]+)"', raw):
        iid = m.group(1)
        if iid in skip:
            continue
        if iid in seen:
            print(f"\nFirst linear duplicate: {iid!r} (positions {seen[iid]} then {m.start()})")
            break
        seen[iid] = m.start()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
