#!/usr/bin/env python3
"""
Compress vertical gaps in draw.io by shifting root-level geometry (parent=1)
and mxPoint waypoints. Per-diagram cumulative thresholds: for y >= t, subtract s (stacked).
"""
import sys
import xml.etree.ElementTree as ET

# diagram_id -> list of (y_threshold, subtract) applied in descending threshold order
RULES = {
    "pg01": [(3500, 550), (2320, 720), (1180, 600)],
    "pg02": [(2290, 500), (1180, 420)],
    "pg03": [],  # ERD: no change
    "pg04": [(2580, 600), (1280, 750)],
    # E2E: pull tail blocks (리스팅 등) up — extra tier for y>=5000 closes 03↔04 gap
    "pg05": [(5000, 850), (4670, 1050), (3180, 1050), (1500, 950)],
    "pg06": [(3640, 1600), (1520, 1200)],
}


def shift_y(y: float, rules: list) -> float:
    if not rules:
        return y
    total = 0
    for thresh, sub in sorted(rules, reverse=True):
        if y >= thresh:
            total += sub
    return y - total


def process_diagram(diag: ET.Element, diagram_id: str):
    rules = RULES.get(diagram_id, [])
    if not rules:
        return 0.0

    model = diag.find("mxGraphModel")
    if model is None:
        return 0.0

    max_y = 0.0

    def upd_geom_y(elem):
        nonlocal max_y
        geo = elem.find("mxGeometry")
        if geo is None:
            return
        y_attr = geo.get("y")
        if y_attr is not None:
            try:
                y = float(y_attr)
                ny = shift_y(y, rules)
                geo.set("y", str(int(ny) if ny == int(ny) else ny))
                h = float(geo.get("height", 0) or 0)
                max_y = max(max_y, ny + h)
            except ValueError:
                pass
        for pt in geo.findall(".//mxPoint"):
            py = pt.get("y")
            if py is not None:
                try:
                    y = float(py)
                    pt.set("y", str(int(shift_y(y, rules))))
                except ValueError:
                    pass

    root = model.find("root")
    if root is None:
        return max_y

    for cell in root.findall("mxCell"):
        if cell.get("parent") != "1":
            continue
        upd_geom_y(cell)

    # Tight page height: content + margin
    ph = model.get("pageHeight")
    if ph is not None:
        try:
            new_h = max(800, int(max_y + 120))
            model.set("pageHeight", str(new_h))
        except ValueError:
            pass

    return max_y


def main():
    path = sys.argv[1]
    tree = ET.parse(path)
    root = tree.getroot()
    for diag in root.findall("diagram"):
        did = diag.get("id", "")
        process_diagram(diag, did)
    tree.write(path, encoding="utf-8", xml_declaration=True)
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
