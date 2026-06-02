"use client";

import { SHOW_VAULT_COLLAPSIBLE_SECTIONS } from "@/lib/vault/mintFormConstants";
import type { GradedCardFormState, PsaFieldLocks } from "@/types/gradedCard";

export function MintFormAssetListingSection({
  form,
  errors,
  psaFieldLocks,
  onNameChange,
  onDescriptionChange,
}: {
  form: GradedCardFormState;
  errors: Record<string, string>;
  psaFieldLocks: PsaFieldLocks;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}) {
  if (!SHOW_VAULT_COLLAPSIBLE_SECTIONS) {
    return errors.name ? <p className="text-xs text-red-400">{errors.name}</p> : null;
  }

  return (
    <details className="group rounded-xl border border-gray-700/50 bg-gray-800/20 overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800/35 [&::-webkit-details-marker]:hidden">
        <span>Asset listing</span>
        <svg
          className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="space-y-4 border-t border-gray-700/40 px-4 pb-4 pt-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="name">
            Asset Name <span className="text-red-400">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. 2023 Ohtani PSA 10"
            disabled={psaFieldLocks.assetName}
            title={
              psaFieldLocks.assetName
                ? "Name was set by PSA analysis and cannot be edited"
                : undefined
            }
            className="w-full bg-gray-800/80 border border-gray-700/60 focus:border-mint rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            required
          />
          {psaFieldLocks.assetName && (
            <p className="mt-1 text-[11px] text-gray-500">Set by PSA analysis</p>
          )}
          {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="description">
            Description <span className="text-gray-500 text-xs font-normal">(optional)</span>
          </label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={2}
            placeholder="Describe your graded card..."
            className="w-full bg-gray-800/80 border border-gray-700/60 focus:border-mint rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-colors resize-none"
          />
        </div>
      </div>
    </details>
  );
}
