import { bumpWholeDollarByOnePercent } from "@/lib/marketplace/wholeDollarPercent";

describe("bumpWholeDollarByOnePercent", () => {
  it("steps by $1 at $100 and below", () => {
    expect(bumpWholeDollarByOnePercent(1, 1)).toBe(2);
    expect(bumpWholeDollarByOnePercent(40, 1)).toBe(41);
    expect(bumpWholeDollarByOnePercent(40, -1)).toBe(39);
    expect(bumpWholeDollarByOnePercent(100, 1)).toBe(101);
    expect(bumpWholeDollarByOnePercent(100, -1)).toBe(99);
  });

  it("applies 1% above $100", () => {
    expect(bumpWholeDollarByOnePercent(200, 1)).toBe(202);
    expect(bumpWholeDollarByOnePercent(200, -1)).toBe(198);
    expect(bumpWholeDollarByOnePercent(773, 1)).toBe(781);
  });
});
