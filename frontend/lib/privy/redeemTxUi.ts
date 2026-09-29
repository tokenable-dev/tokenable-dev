import type { SendTransactionModalUIOptions } from "@privy-io/react-auth";
import { formatUnits } from "viem";

export function redeemUsdcFeePrivyUi(amountMicros: bigint): SendTransactionModalUIOptions {
  const usdc = formatUnits(amountMicros, 6);
  return {
    description: `Redeem fee: ${usdc} USDC to Tokenable (plus network gas in ETH).`,
    buttonText: "Pay redeem fee",
    transactionInfo: {
      title: "Details",
      action: `Send ${usdc} USDC`,
      contractInfo: { name: "USDC" },
    },
    successHeader: "Payment complete",
    successDescription: `You paid ${usdc} USDC for this redeem. Open Details for the ETH network fee.`,
  };
}

/** First-time USDC → Seaport approve before Buy now (embedded wallet). */
export function buyUsdcSeaportApprovalPrivyUi(): SendTransactionModalUIOptions {
  return {
    description:
      "One-time USDC approval so you can buy listings on Tokenable (network gas in ETH). Your next step is the purchase.",
    buttonText: "Approve USDC",
    transactionInfo: {
      title: "Details",
      action: "Approve USDC for Seaport",
      contractInfo: { name: "USDC" },
    },
    successHeader: "Approval complete",
    successDescription:
      "Next, confirm the purchase in your wallet. This approval is saved for future buys on this network.",
  };
}

/** Seller accepts a bid — Seaport matchAdvancedOrders (embedded wallet). */
export function sellSeaportMatchPrivyUi(): SendTransactionModalUIOptions {
  return {
    description:
      "Complete the sale to the buyer on Tokenable (network gas in ETH). This is not a token approval.",
    buttonText: "Confirm sale",
    transactionInfo: {
      title: "Details",
      action: "Complete sale on Seaport",
      contractInfo: { name: "Seaport" },
    },
    successHeader: "Sale submitted",
    successDescription:
      "When the network confirms, the card leaves your portfolio and USDC is settled per the bid.",
  };
}

/** Seaport fulfillOrder during Buy now (embedded wallet). */
export function buyFulfillAskPrivyUi(priceUsdc: string): SendTransactionModalUIOptions {
  return {
    description: `Pay $${priceUsdc} USDC for this card (plus network gas in ETH).`,
    buttonText: "Confirm purchase",
    transactionInfo: {
      title: "Details",
      action: `Buy for $${priceUsdc} USDC`,
      contractInfo: { name: "Seaport" },
    },
    successHeader: "Purchase complete",
    successDescription: "This card should appear in your portfolio shortly.",
  };
}

/** First-time USDC → Seaport approve during place bid (embedded wallet). */
export function bidUsdcSeaportApprovalPrivyUi(): SendTransactionModalUIOptions {
  return {
    description:
      "One-time approval so Tokenable can use your USDC when a bid is accepted (network gas in ETH).",
    buttonText: "Approve USDC",
    transactionInfo: {
      title: "Details",
      action: "Approve USDC for Seaport",
      contractInfo: { name: "USDC" },
    },
    successHeader: "Approval complete",
    successDescription:
      "Your bid will be submitted next. This approval is saved for future bids on this network.",
  };
}

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

export function redeemCustodyTransferPrivyUi(
  tokenId: number,
  current: number,
  total: number,
): SendTransactionModalUIOptions {
  const step =
    total > 1 ? ` (${current} of ${total})` : "";
  return {
    description: `Move RWA #${tokenId} into Tokenable custody${step}. No USDC — only network gas in ETH.`,
    buttonText: "Transfer to custody",
    transactionInfo: {
      title: "Details",
      action: `Transfer RWA #${tokenId}`,
      contractInfo: { name: "Tokenable RWA" },
    },
    successHeader: "Transfer complete",
    successDescription: `RWA #${tokenId} sent to custody${step}. Confirm any remaining wallet prompts to finish.`,
  };
}
