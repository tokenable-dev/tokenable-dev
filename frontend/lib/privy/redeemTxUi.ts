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
