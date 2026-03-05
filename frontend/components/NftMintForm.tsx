"use client";

import { useState, useRef } from "react";
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { uploadNft } from "@/lib/api";
import { SKY_NFT_ADDRESS, SKY_NFT_MINT_ABI } from "@/constants/contracts";
import { besu } from "@/config/wagmi";
import { useAppStore, selectRefresh } from "@/store";

type Step = "idle" | "uploading" | "uploaded" | "minting" | "success" | "error";

interface MintResult {
  tokenURI: string;
  txHash: string;
}

export function NftMintForm() {
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient({ chainId: besu.id });
  const refresh = useAppStore(selectRefresh);

  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<MintResult | null>(null);
  const [tokenURI, setTokenURI] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<"file" | "url">("file");

  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const { writeContractAsync } = useWriteContract();
  const { data: receipt, isLoading: waitingForReceipt } = useWaitForTransactionReceipt({
    hash: result?.txHash as `0x${string}` | undefined,
    chainId: besu.id,
  });

  const isWrongNetwork = isConnected && chain?.id !== besu.id;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  }

  function resetForm() {
    setStep("idle");
    setErrorMsg("");
    setResult(null);
    setTokenURI("");
    setImagePreview(null);
    formRef.current?.reset();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!address || !isConnected) return;

    setErrorMsg("");
    setStep("uploading");

    try {
      const form = e.currentTarget;
      const data = new FormData(form);

      // Step 1: Upload to IPFS via backend
      const uploadResult = await uploadNft(data);
      setTokenURI(uploadResult.tokenURI);
      setStep("uploaded");

      // Step 2: Mint via MetaMask
      setStep("minting");
      const txHash = await writeContractAsync({
        address: SKY_NFT_ADDRESS,
        abi: SKY_NFT_MINT_ABI,
        functionName: "mint",
        args: [address, uploadResult.tokenURI],
        chainId: besu.id,
      });

      setResult({ tokenURI: uploadResult.tokenURI, txHash });
      setStep("success");

      // Wait for confirmation then refresh all chain-dependent queries via store
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
      }
      refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setErrorMsg(message);
      setStep("error");
    }
  }

  if (!isConnected) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <p className="text-gray-400">Connect your wallet to mint NFTs</p>
      </div>
    );
  }

  if (isWrongNetwork) {
    return (
      <div className="bg-gray-900/50 border border-red-800/50 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-red-400 font-medium">Wrong Network</p>
        <p className="text-gray-500 text-sm mt-1">
          Please switch MetaMask to the Besu network (Chain ID: 2741)
        </p>
      </div>
    );
  }

  if (step === "success" && result) {
    return (
      <div className="bg-gray-900/50 border border-emerald-800/50 rounded-xl p-6">
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">🎉</div>
          <h3 className="text-xl font-bold text-white">NFT Minted Successfully!</h3>
        </div>
        <div className="space-y-3">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Token URI</p>
            <p className="text-xs font-mono text-emerald-400 break-all">{result.tokenURI}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
            <p className="text-xs font-mono text-blue-400 break-all">{result.txHash}</p>
          </div>
          {waitingForReceipt && (
            <p className="text-xs text-gray-500 text-center animate-pulse">
              Waiting for confirmation...
            </p>
          )}
          {receipt && (
            <p className="text-xs text-emerald-400 text-center">
              ✓ Confirmed in block #{receipt.blockNumber.toString()}
            </p>
          )}
        </div>
        <button
          onClick={resetForm}
          className="mt-5 w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Mint Another
        </button>
      </div>
    );
  }

  const isProcessing = step === "uploading" || step === "minting";

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
      <h2 className="text-lg font-bold text-white mb-5">Mint NFT</h2>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5" htmlFor="name">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="My Awesome NFT"
            className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            placeholder="Describe your NFT..."
            className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors resize-none"
          />
        </div>

        {/* Image */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">
            Image <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setImageMode("file")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                imageMode === "file"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setImageMode("url")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                imageMode === "url"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              Image URL
            </button>
          </div>

          {imageMode === "file" ? (
            <div>
              <input
                ref={fileRef}
                name="image"
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border border-dashed border-gray-700 hover:border-blue-500 rounded-lg py-6 text-center text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="preview"
                    className="max-h-32 mx-auto rounded-lg"
                  />
                ) : (
                  <span>Click to select PNG, JPG, GIF, WEBP</span>
                )}
              </button>
            </div>
          ) : (
            <input
              name="imageUrl"
              type="url"
              placeholder="https://example.com/image.png"
              className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors"
            />
          )}
        </div>

        {/* Status indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 py-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400">
              {step === "uploading"
                ? "Uploading to IPFS..."
                : "Waiting for MetaMask signature..."}
            </span>
          </div>
        )}

        {step === "error" && errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-xs text-red-400 break-all">{errorMsg}</p>
          </div>
        )}

        {step === "uploaded" && tokenURI && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">IPFS Upload Complete</p>
            <p className="text-xs font-mono text-blue-400 break-all">{tokenURI}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isProcessing}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-blue-500/20"
        >
          {isProcessing ? "Processing..." : "Upload & Mint NFT"}
        </button>
      </form>
    </div>
  );
}
