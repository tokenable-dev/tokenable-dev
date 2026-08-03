"use client";

import { TkField, TkInput, TkTextarea } from "@/components/ds";
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
        <TkField
          label="Asset Name *"
          htmlFor="name"
          hint={
            psaFieldLocks.assetName
              ? "Set by PSA analysis"
              : "Use the card name as printed on your PSA slab label — not the set name or grade."
          }
          error={errors.name || undefined}
        >
          <TkInput
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Pikachu With Grey Felt Hat"
            disabled={psaFieldLocks.assetName}
            title={
              psaFieldLocks.assetName
                ? "Name was set by PSA analysis and cannot be edited"
                : undefined
            }
            hasError={Boolean(errors.name)}
            required
          />
        </TkField>

        <TkField
          label="Description (optional)"
          htmlFor="description"
        >
          <TkTextarea
            id="description"
            value={form.description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={2}
            placeholder="Describe your graded card..."
          />
        </TkField>
      </div>
    </details>
  );
}
