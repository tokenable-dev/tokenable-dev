/** Minimal ABI for TokenablePaymentEscrow buyer flows. */
export const PAYMENT_ESCROW_ABI = [
  {
    type: "function",
    name: "createAndDeposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "orderId", type: "bytes32" },
      { name: "seller", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "autoReleaseAt", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "confirmReceipt",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "bytes32" }],
    outputs: [],
  },
] as const;

export const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;
