import type { SendTransactionModalUIOptions } from "@privy-io/react-auth";

/** First-time `setApprovalForAll(Seaport)` during list / set price (embedded wallet). */
export function listSeaportApprovalPrivyUi(): SendTransactionModalUIOptions {
  return {
    description:
      "One-time approval so Tokenable can list your cards on the marketplace (network gas in ETH).",
    buttonText: "Approve marketplace",
    transactionInfo: {
      title: "Details",
      action: "Approve Seaport for RWA",
      contractInfo: { name: "Tokenable RWA" },
    },
    successHeader: "Approval complete",
    successDescription:
      "Next, sign your listing in the wallet. This approval is saved for future listings.",
  };
}
