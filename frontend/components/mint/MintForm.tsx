"use client";

import { useState, useCallback } from "react";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { uploadNft } from "@/lib/api";
import { SKY_NFT_ADDRESS, SKY_NFT_MINT_ABI } from "@/constants/contracts";
import { besu } from "@/config/wagmi";
import { useAppStore, selectRefresh } from "@/store";
import type { GradingCompany, GradedCardFormState, GradedCardMetadata } from "@/types/gradedCard";
import { GradedCardSection } from "./GradedCardSection";
import { ImageInput } from "./ImageInput";

type Step = "idle" | "uploading" | "minting" | "success" | "error";

const INITIAL_STATE: GradedCardFormState = {
  name: "",
  description: "",
  image: null,
  gradingCompany: "",
  card: {
    name: "",
    player: "",
    year: "",
    set: "",
    number: "",
  },
  grade: {
    certNumber: "",
    score: "",
    subgrades: {},
  },
  verification: {
    certUrl: "",
    slabFront: null,
    slabBack: null,
  },
};

export function MintForm() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: besu.id });
  const refresh = useAppStore(selectRefresh);

  const [form, setForm] = useState<GradedCardFormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<{ tokenURI: string; txHash: string } | null>(null);

  const { writeContractAsync } = useWriteContract();
  const { data: receipt, isLoading: waitingForReceipt } =
    useWaitForTransactionReceipt({
      hash: result?.txHash as `0x${string}` | undefined,
      chainId: besu.id,
    });

  const updateForm = useCallback(<K extends keyof GradedCardFormState>(
    key: K,
    value: GradedCardFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateCard = useCallback((card: GradedCardFormState["card"]) => {
    setForm((prev) => ({ ...prev, card }));
  }, []);

  const updateVerification = useCallback(
    (verification: GradedCardFormState["verification"]) => {
      setForm((prev) => ({ ...prev, verification }));
    },
    []
  );

  const handleCompanyChange = useCallback((company: GradingCompany) => {
    setForm((prev) => ({
      ...prev,
      gradingCompany: company,
      grade: { ...prev.grade, subgrades: {} },
    }));
  }, []);

  const updateGradePartial = useCallback(
    (grade: Partial<GradedCardFormState["grade"]>) => {
      setForm((prev) => ({ ...prev, grade: { ...prev.grade, ...grade } }));
    },
    []
  );

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "NFT name is required";
    const hasImage =
      form.image instanceof File ||
      (typeof form.image === "string" && form.image.trim());
    if (!hasImage) next.image = "Image file or URL is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildMetadata(): GradedCardMetadata {
    const metadata: GradedCardMetadata = {
      name: form.name,
      image: "", // Will be set after IPFS upload
    };
    if (form.description.trim()) metadata.description = form.description;

    if (form.gradingCompany) {
      metadata.gradingCompany = form.gradingCompany;
    }

    const hasCard =
      form.card.name ||
      form.card.player ||
      form.card.year ||
      form.card.set ||
      form.card.number;
    if (hasCard) {
      metadata.card = {};
      if (form.card.name) metadata.card.name = form.card.name;
      if (form.card.player) metadata.card.player = form.card.player;
      if (form.card.year) {
        const y = parseInt(form.card.year, 10);
        if (!Number.isNaN(y)) metadata.card.year = y;
      }
      if (form.card.set) metadata.card.set = form.card.set;
      if (form.card.number) metadata.card.number = form.card.number;
    }

    const hasGrade =
      form.grade.certNumber ||
      form.grade.score ||
      Object.keys(form.grade.subgrades).length > 0;
    if (hasGrade) {
      metadata.grade = {};
      if (form.grade.certNumber) metadata.grade.certNumber = form.grade.certNumber;
      if (form.grade.score) {
        const s = parseFloat(form.grade.score);
        if (!Number.isNaN(s)) metadata.grade.score = s;
      }
      if (Object.keys(form.grade.subgrades).length > 0) {
        metadata.grade.subgrades = { ...form.grade.subgrades };
      }
    }

    const hasVerification =
      form.verification.certUrl ||
      form.verification.slabFront ||
      form.verification.slabBack;
    if (hasVerification) {
      metadata.verification = {};
      if (form.verification.certUrl)
        metadata.verification.certUrl = form.verification.certUrl;
      if (form.verification.slabFront)
        metadata.verification.slabFront = ""; // Will be set after IPFS upload
      if (form.verification.slabBack)
        metadata.verification.slabBack = ""; // Will be set after IPFS upload
    }

    return metadata;
  }

  function resetForm() {
    setStep("idle");
    setErrorMsg("");
    setResult(null);
    setForm(INITIAL_STATE);
    setErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !address || !isConnected) return;

    setErrorMsg("");
    setStep("uploading");

    try {
      const data = new FormData();
      data.append("name", form.name);
      data.append("description", form.description.trim() || "No description");
      if (form.image instanceof File) {
        data.append("image", form.image);
      } else if (typeof form.image === "string" && form.image.trim()) {
        data.append("imageUrl", form.image);
      }

      const uploadResult = await uploadNft(data);
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

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({
          hash: txHash as `0x${string}`,
        });
      }
      refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setErrorMsg(message);
      setStep("error");
    }
  }

  const isProcessing = step === "uploading" || step === "minting";

  if (step === "success" && result) {
    return (
      <div className="bg-gray-900/50 border border-emerald-800/50 rounded-xl p-6">
        <div className="text-center mb-5">
          <h3 className="text-xl font-bold text-white">NFT Minted Successfully!</h3>
        </div>
        <div className="space-y-3">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Token URI</p>
            <p className="text-xs font-mono text-emerald-400 break-all">
              {result.tokenURI}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
            <p className="text-xs font-mono text-blue-400 break-all">
              {result.txHash}
            </p>
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

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 transition-all duration-200">
      <h2 className="text-lg font-bold text-white mb-5">Mint Graded Card NFT</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Base NFT fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5" htmlFor="name">
              NFT Name <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              placeholder="e.g. 2023 Ohtani PSA 10"
              className="w-full bg-gray-800 border border-gray-700 focus:border-amber-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors"
              required
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5" htmlFor="description">
              Description{" "}
              <span className="text-gray-500 text-xs font-normal">(optional)</span>
            </label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
              rows={2}
              placeholder="Describe your graded card..."
              className="w-full bg-gray-800 border border-gray-700 focus:border-amber-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors resize-none"
            />
          </div>

          <ImageInput
            label="Card Image"
            value={form.image}
            onChange={(v) => updateForm("image", v)}
            required
          />
          {errors.image && (
            <p className="text-xs text-red-400">{errors.image}</p>
          )}
        </div>

        <GradedCardSection
          gradingCompany={form.gradingCompany}
          onCompanyChange={handleCompanyChange}
          card={form.card}
          onCardChange={updateCard}
          grade={form.grade}
          onGradeChange={updateGradePartial}
          verification={form.verification}
          onVerificationChange={updateVerification}
        />

        {isProcessing && (
          <div className="flex items-center gap-2 py-2">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
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

        <button
          type="submit"
          disabled={isProcessing}
          className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-amber-500/20"
        >
          {isProcessing ? "Processing..." : "Mint"}
        </button>
      </form>
    </div>
  );
}
