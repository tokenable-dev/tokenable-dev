"use client";

export function RwaDetailInvalidTokenState({ onBack }: { onBack: () => void }) {
  return (
    <div className="py-24 text-center">
      <p className="mb-2 text-xl font-semibold text-white">Invalid token</p>
      <button
        type="button"
        onClick={onBack}
        className="rounded-xl bg-gray-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
      >
        ← Back
      </button>
    </div>
  );
}
