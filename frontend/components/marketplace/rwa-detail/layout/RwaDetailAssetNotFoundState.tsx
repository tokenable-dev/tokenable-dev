"use client";

export function RwaDetailAssetNotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <div className="py-24 text-center">
      <p className="mb-4 text-5xl">🔍</p>
      <p className="mb-2 text-xl font-semibold text-white">Asset not found</p>
      <p className="mb-6 text-sm text-gray-500">
        This token ID does not exist on the current contract.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="rounded-xl bg-gray-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
      >
        ← Back to Markets
      </button>
    </div>
  );
}
