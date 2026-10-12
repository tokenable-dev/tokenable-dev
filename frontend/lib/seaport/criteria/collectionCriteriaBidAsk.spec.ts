import type { Order } from "@/lib/core";
import {
  pickCrossingAskForBid,
  resolveCrossingAskForBid,
} from "./collectionCriteriaBidAsk";

function ask(tokenId: number, priceUsdc: string): Order {
  return {
    orderHash: `ask-${tokenId}`,
    tokenId: String(tokenId),
    side: "ask",
    status: "active",
    considerationAmount: String(Number(priceUsdc) * 1_000_000),
    offerer: "0x0000000000000000000000000000000000000001",
  } as Order;
}

describe("resolveCrossingAskForBid", () => {
  it("uses knownActiveAsks without calling the network", async () => {
    const asks = [ask(1, "100")];
    const crossing = await resolveCrossingAskForBid({
      collectionKey: "ck-test",
      bidder: "0x0000000000000000000000000000000000000002",
      bidUnits: BigInt(100_000_000),
      knownActiveAsks: asks,
    });
    expect(crossing?.tokenId).toBe("1");
    expect(pickCrossingAskForBid(asks, "0x2", BigInt(50_000_000))).toBeNull();
  });
});
