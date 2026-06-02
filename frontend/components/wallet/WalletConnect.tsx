"use client";

import { useState, type CSSProperties } from "react";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { formatUnits } from "viem";
import { sepolia } from "@/config/wagmi";
import { ensureSepoliaNetwork } from "@/lib/network";
import {
  connectMetaMaskWallet,
  findMetaMaskConnector,
} from "@/lib/wallet/connectMetaMaskWallet";
import { WalletAddressCompact } from "@/components/wallet/WalletAddressCompact";

export interface WalletConnectProps {
  /** Overrides default Tailwind classes for the disconnected “Connect MetaMask” button */
  connectButtonClassName?: string;
  /** Ensures black fill during Connecting… (pairs with gradient-outline vault/portfolio CTAs). */
  connectButtonStyle?: CSSProperties;
}

export function WalletConnect({
  connectButtonClassName,
  connectButtonStyle,
}: WalletConnectProps = {}) {
  const { address, isConnected, chain, connector } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address, chainId: sepolia.id });
  const [isSwitching, setIsSwitching] = useState(false);

  const isWrongNetwork = isConnected && chain?.id !== sepolia.id;

  async function handleSwitchToSepolia() {
    if (!connector) return;
    setIsSwitching(true);
    try {
      const provider = await connector.getProvider() as {
        request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      } | null;
      if (provider?.request) {
        await ensureSepoliaNetwork(
          provider as Parameters<typeof ensureSepoliaNetwork>[0]
        );
      }
    } finally {
      setIsSwitching(false);
    }
  }

  if (isConnected && address) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-3">
          {isWrongNetwork && (
            <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-full">
              Wrong Network
            </span>
          )}
          <div className="text-right">
            <p className="text-sm">
              <WalletAddressCompact address={address} />
            </p>
            {balance && (
              <p className="text-xs text-gray-500">
                {parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4)}{" "}
                {balance.symbol}
              </p>
            )}
          </div>
          <div
            className={`w-2 h-2 rounded-full ${isWrongNetwork ? "bg-red-400" : "bg-mint"}`}
          />
        </div>
        <div className="flex items-center gap-2">
          {isWrongNetwork && (
            <button
              onClick={() => void handleSwitchToSepolia()}
              disabled={isSwitching}
              className="text-xs px-2 py-1 bg-mint-dim/90 hover:brightness-110 disabled:opacity-50 text-mint-ink rounded transition-colors"
            >
              {isSwitching ? "Switching..." : "Switch to Sepolia"}
            </button>
          )}
          <button
            onClick={() => disconnect()}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  const metaMaskConnector = findMetaMaskConnector(connectors);

  return (
    <button
      type="button"
      onClick={() => connectMetaMaskWallet(connect, connectors)}
      disabled={isPending || !metaMaskConnector}
      className={
        connectButtonClassName ??
        "px-4 py-2 bg-gradient-to-r from-mint to-mint-dim hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 text-mint-ink text-sm font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-mint/25"
      }
      style={
        connectButtonClassName
          ? { backgroundColor: "#000000", ...connectButtonStyle }
          : connectButtonStyle
      }
    >
      {isPending ? "Connecting..." : "Connect MetaMask"}
    </button>
  );
}
