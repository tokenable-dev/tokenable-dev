"use client";

import type { ReactNode } from "react";
import {
  GradientOutlineFrame,
  VAULT_OUTLINE_PAD_CLASS,
} from "@/components/ui/GradientOutlineFrame";

/** Active Photo / Cert # tab — plain black fill inside gradient rim (matches inactive tab height). */
const vaultTabActiveInnerClass =
  "block w-full rounded-[7px] border-0 bg-black px-3 py-2.5 text-xs font-semibold leading-none text-mint transition-colors sm:text-sm";
import type { GradingCompany, PsaFieldLocks } from "@/types/gradedCard";
import { ImageInput } from "./ImageInput";

const inputClass =
  "w-full bg-gray-800/80 border border-gray-700/60 focus:border-mint rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-colors";

function lockedHint(locked: boolean): string | undefined {
  return locked ? "Set by PSA analysis and cannot be edited" : undefined;
}

/** Vault mint: slab OCR path vs cert-only PSA API lookup */
export type PsaInputMode = "slab" | "cert";

interface GradedCardSectionProps {
  /** Mint supports PSA only; prop kept for typing */
  gradingCompany: GradingCompany | "";
  card: { name: string; player: string; year: string; set: string; number: string };
  onCardChange: (card: GradedCardSectionProps["card"]) => void;
  grade: { certNumber: string; score: string; subgrades: Record<string, string | number | boolean> };
  onGradeChange: (grade: Partial<GradedCardSectionProps["grade"]>) => void;
  verification: {
    certUrl: string;
    slabFront: File | string | null;
    slabBack: File | string | null;
  };
  onVerificationChange: (v: GradedCardSectionProps["verification"]) => void;
  /** Fields filled by PSA analysis — read-only when locked */
  psaFieldLocks?: PsaFieldLocks;
  psaInputMode?: PsaInputMode;
  onPsaInputModeChange?: (mode: PsaInputMode) => void;
  onCertLookup?: () => void;
  /** Cert mode: clear PSA result so user can edit cert # before pressing Look up (no API). */
  onCertLookupReset?: () => void;
  certLookupBusy?: boolean;
  /** Cert mode: a PSA lookup already succeeded (soften Look up vs Mint). */
  certLookupHasResult?: boolean;
  /** Render between slab/cert hero and the collapsible card & PSA fields (e.g. mint preview + Mint CTA) */
  slotAfterHero?: ReactNode;
  /** When false, hides the Card & PSA details accordion (form state still updates from PSA). */
  showCardPsaDetailsPanel?: boolean;
}

function PsaSlabUploadHero({
  verification,
  onVerificationChange,
  psaFieldLocks,
}: {
  verification: GradedCardSectionProps["verification"];
  onVerificationChange: GradedCardSectionProps["onVerificationChange"];
  psaFieldLocks?: PsaFieldLocks;
}) {
  const L = psaFieldLocks;
  return (
    <section aria-labelledby="psa-slab-hero-title" className="space-y-3">
      <h3 id="psa-slab-hero-title" className="sr-only">
        Slab photo upload
      </h3>

      <div className="rounded-2xl bg-gray-900/35 p-3 ring-1 ring-white/[0.06] sm:p-4">
        <ImageInput
          showLabel={false}
          value={verification.slabFront}
          onChange={(f) =>
            onVerificationChange({
              ...verification,
              slabFront: f,
              slabBack: null,
            })
          }
          mode="file"
          required
        />
      </div>

      <details className="rounded-lg px-1 py-0.5 text-xs text-gray-500">
        <summary className="cursor-pointer list-none font-medium text-gray-500 transition-colors hover:text-gray-400 [&::-webkit-details-marker]:hidden">
          <span className="underline decoration-white/15 underline-offset-2">
            Optional: PSA cert URL
          </span>
        </summary>
        <input
          type="url"
          value={verification.certUrl}
          onChange={(e) =>
            onVerificationChange({ ...verification, certUrl: e.target.value })
          }
          placeholder="https://www.psacard.com/cert/…"
          disabled={Boolean(L?.certUrl)}
          title={lockedHint(Boolean(L?.certUrl))}
          className={`${inputClass} mt-2 disabled:cursor-not-allowed disabled:opacity-60`}
        />
      </details>
    </section>
  );
}

function PsaCertLookupHero({
  grade,
  onGradeChange,
  verification,
  onVerificationChange,
  onCertLookup,
  onCertLookupReset,
  certLookupBusy,
  certLookupHasResult,
  psaFieldLocks,
}: {
  grade: GradedCardSectionProps["grade"];
  onGradeChange: GradedCardSectionProps["onGradeChange"];
  verification: GradedCardSectionProps["verification"];
  onVerificationChange: GradedCardSectionProps["onVerificationChange"];
  onCertLookup: () => void;
  onCertLookupReset?: () => void;
  certLookupBusy: boolean;
  certLookupHasResult?: boolean;
  psaFieldLocks?: PsaFieldLocks;
}) {
  const L = psaFieldLocks;
  const hasHint =
    Boolean(grade.certNumber.trim()) || Boolean(verification.certUrl.trim());
  const subduedLookup = Boolean(certLookupHasResult) && !certLookupBusy;
  return (
    <section aria-labelledby="psa-cert-hero-title">
      <label
        id="psa-cert-hero-title"
        className="mb-2 block text-sm font-semibold text-white"
      >
        Cert lookup
      </label>
      <div className="space-y-4 rounded-xl bg-gray-900/35 p-4 ring-1 ring-white/[0.06]">
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-400">
            Cert # <span className="text-red-400">*</span>
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={grade.certNumber}
            onChange={(e) => onGradeChange({ certNumber: e.target.value })}
            placeholder="7–10 digit PSA cert number"
            disabled={Boolean(L?.certNumber)}
            title={lockedHint(Boolean(L?.certNumber))}
            className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-gray-500">Cert URL (optional)</label>
          <input
            type="url"
            value={verification.certUrl}
            onChange={(e) =>
              onVerificationChange({ ...verification, certUrl: e.target.value })
            }
            placeholder="https://www.psacard.com/cert/…"
            disabled={Boolean(L?.certUrl)}
            title={lockedHint(Boolean(L?.certUrl))}
            className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
          />
        </div>
        {subduedLookup ? (
          <button
            type="button"
            onClick={() => onCertLookupReset?.()}
            disabled={certLookupBusy}
            title="Clear PSA result so you can change the cert # or URL, then press Look up."
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 px-3 text-xs font-medium text-zinc-500 transition hover:border-white/[0.12] hover:bg-white/[0.07] hover:text-zinc-300 disabled:opacity-40"
          >
            Clear & edit cert
          </button>
        ) : (
          <GradientOutlineFrame className="w-full" padClass={VAULT_OUTLINE_PAD_CLASS}>
            <button
              type="button"
              onClick={() => onCertLookup()}
              disabled={certLookupBusy || !hasHint}
              className="w-full rounded-[11px] border-0 !bg-black py-3 text-sm font-bold text-mint transition disabled:cursor-not-allowed disabled:!bg-black disabled:text-mint/35"
              style={{ backgroundColor: "#000000" }}
            >
              {certLookupBusy ? "Looking up…" : "Look up"}
            </button>
          </GradientOutlineFrame>
        )}
      </div>
    </section>
  );
}

export function GradedCardSection({
  gradingCompany,
  card,
  onCardChange,
  grade,
  onGradeChange,
  verification,
  onVerificationChange,
  psaFieldLocks,
  psaInputMode = "slab",
  onPsaInputModeChange,
  onCertLookup,
  onCertLookupReset,
  certLookupBusy = false,
  certLookupHasResult = false,
  slotAfterHero,
  showCardPsaDetailsPanel = true,
}: GradedCardSectionProps) {
  const hasCompany = !!gradingCompany;
  const L = psaFieldLocks;
  const mode = psaInputMode;
  const setMode = onPsaInputModeChange;
  const certLookup = onCertLookup ?? (() => {});

  return (
    <div className="space-y-6 transition-opacity duration-200">
      {setMode && (
        <div
          className="flex items-center gap-1 rounded-xl bg-gray-900/60 p-1 ring-1 ring-white/[0.06]"
          role="tablist"
          aria-label="PSA data source"
        >
          {mode === "slab" ? (
            <GradientOutlineFrame
              className="min-w-0 flex-1 overflow-hidden"
              roundedClass="rounded-lg"
              padClass={VAULT_OUTLINE_PAD_CLASS}
            >
              <button
                type="button"
                role="tab"
                aria-selected
                onClick={() => setMode("slab")}
                className={vaultTabActiveInnerClass}
              >
                Photo
              </button>
            </GradientOutlineFrame>
          ) : (
            <button
              type="button"
              role="tab"
              aria-selected={false}
              onClick={() => setMode("slab")}
              className="min-w-0 flex-1 rounded-lg border border-transparent px-3 py-2.5 text-xs font-semibold text-gray-400 transition-colors hover:text-white sm:text-sm"
            >
              Photo
            </button>
          )}
          {mode === "cert" ? (
            <GradientOutlineFrame
              className="min-w-0 flex-1 overflow-hidden"
              roundedClass="rounded-lg"
              padClass={VAULT_OUTLINE_PAD_CLASS}
            >
              <button
                type="button"
                role="tab"
                aria-selected
                onClick={() => setMode("cert")}
                className={vaultTabActiveInnerClass}
              >
                Cert #
              </button>
            </GradientOutlineFrame>
          ) : (
            <button
              type="button"
              role="tab"
              aria-selected={false}
              onClick={() => setMode("cert")}
              className="min-w-0 flex-1 rounded-lg border border-transparent px-3 py-2.5 text-xs font-semibold text-gray-400 transition-colors hover:text-white sm:text-sm"
            >
              Cert #
            </button>
          )}
        </div>
      )}

      {mode === "slab" ? (
        <PsaSlabUploadHero
          verification={verification}
          onVerificationChange={onVerificationChange}
          psaFieldLocks={L}
        />
      ) : (
        <PsaCertLookupHero
          grade={grade}
          onGradeChange={onGradeChange}
          verification={verification}
          onVerificationChange={onVerificationChange}
          onCertLookup={certLookup}
          onCertLookupReset={onCertLookupReset}
          certLookupBusy={certLookupBusy}
          certLookupHasResult={certLookupHasResult}
          psaFieldLocks={L}
        />
      )}

      {slotAfterHero}

      {showCardPsaDetailsPanel ? (
      <details
        className="group rounded-xl border border-gray-700/50 bg-gray-800/20 overflow-hidden"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800/35 [&::-webkit-details-marker]:hidden">
          <span>Card &amp; PSA details</span>
          <svg
            className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </summary>
        <div className="space-y-6 border-t border-gray-700/40 px-4 pb-5 pt-4">
      {/* Card Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Card Name</label>
        <input
          type="text"
          value={card.name}
          onChange={(e) => onCardChange({ ...card, name: e.target.value })}
          placeholder="e.g. Pikachu Van Gogh"
          disabled={Boolean(L?.cardName)}
          title={lockedHint(Boolean(L?.cardName))}
          className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
        />
      </div>

      {/* Grading Company + Grade — side by side like the image */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Grading Company
          </label>
          <div
            className="flex items-center justify-between bg-gray-800/80 border border-gray-700/60 rounded-xl px-4 py-3 text-sm text-white cursor-default"
            title={L?.gradingCompany ? lockedHint(true) : undefined}
          >
            <span>PSA</span>
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Grade</label>
          <div className="relative">
            <select
              value={grade.score}
              onChange={(e) => onGradeChange({ score: e.target.value })}
              disabled={Boolean(L?.score)}
              title={lockedHint(Boolean(L?.score))}
              className={`${inputClass} appearance-none pr-10 disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <option value="">Select grade</option>
              <option value="10">10 - Gem Mint</option>
              <option value="9">9 - Mint</option>
              <option value="8.5">8.5 - NM-MT+</option>
              <option value="8">8 - NM-MT</option>
              <option value="7.5">7.5 - Near Mint+</option>
              <option value="7">7 - Near Mint</option>
              <option value="6.5">6.5 - EX-MT+</option>
              <option value="6">6 - EX-MT</option>
              <option value="5.5">5.5 - Excellent+</option>
              <option value="5">5 - Excellent</option>
              <option value="4.5">4.5 - VG-EX+</option>
              <option value="4">4 - VG-EX</option>
              <option value="3.5">3.5 - VG+</option>
              <option value="3">3 - VG</option>
              <option value="2.5">2.5 - Good+</option>
              <option value="2">2 - Good</option>
              <option value="1.5">1.5 - Fair</option>
              <option value="1">1 - Poor</option>
            </select>
            <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {/* Cert Number — hidden in cert-only mode (entered in hero) */}
      {mode === "slab" && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Cert Number</label>
          <input
            type="text"
            value={grade.certNumber}
            onChange={(e) => onGradeChange({ certNumber: e.target.value })}
            placeholder="PSA Certification Number"
            disabled={Boolean(L?.certNumber)}
            title={lockedHint(Boolean(L?.certNumber))}
            className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
          />
        </div>
      )}

      {/* Player, Year, Set, Card Number */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Player / Character
          </label>
          <input
            type="text"
            value={card.player}
            onChange={(e) => onCardChange({ ...card, player: e.target.value })}
            placeholder="e.g. Shohei Ohtani"
            disabled={Boolean(L?.player)}
            title={lockedHint(Boolean(L?.player))}
            className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Year</label>
          <input
            type="text"
            value={card.year}
            onChange={(e) => onCardChange({ ...card, year: e.target.value })}
            placeholder="e.g. 2023"
            disabled={Boolean(L?.year)}
            title={lockedHint(Boolean(L?.year))}
            className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Set / Series</label>
          <input
            type="text"
            value={card.set}
            onChange={(e) => onCardChange({ ...card, set: e.target.value })}
            placeholder="e.g. Topps Chrome"
            disabled={Boolean(L?.set)}
            title={lockedHint(Boolean(L?.set))}
            className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Card Number</label>
          <input
            type="text"
            value={card.number}
            onChange={(e) => onCardChange({ ...card, number: e.target.value })}
            placeholder="e.g. 1"
            disabled={Boolean(L?.number)}
            title={lockedHint(Boolean(L?.number))}
            className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
          />
        </div>
      </div>

      {/* PSA-specific extra fields (inside Card & PSA panel) */}
      {hasCompany && (
        <CompanySpecificBlock
          company="PSA"
          subgrades={grade.subgrades}
          onChange={(subgrades) => onGradeChange({ subgrades })}
          psaFieldLocks={L}
        />
      )}
        </div>
      </details>
      ) : null}
    </div>
  );
}

function CompanySpecificBlock({
  company,
  subgrades,
  onChange,
  psaFieldLocks,
}: {
  company: GradingCompany;
  subgrades: Record<string, string | number | boolean>;
  onChange: (s: Record<string, string | number | boolean>) => void;
  psaFieldLocks?: PsaFieldLocks;
}) {
  function set(key: string, value: string | number | boolean) {
    onChange({ ...subgrades, [key]: value });
  }
  function get(key: string, def: string | number | boolean = "") {
    return subgrades[key] ?? def;
  }

  return (
    <div className="rounded-lg border border-gray-700/35 bg-gray-900/25 p-3 sm:p-4">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {company} — population &amp; extras
      </p>

      {company === "PSA" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Qualifier</label>
            <select
              value={String(get("qualifier"))}
              onChange={(e) => set("qualifier", e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              <option value="OC">OC (Off-Center)</option>
              <option value="MC">MC (Miscut)</option>
              <option value="ST">ST (Stained)</option>
            </select>
          </div>
          <InputField
            label="Autograph Grade"
            value={String(get("autographGrade"))}
            onChange={(v) => set("autographGrade", v)}
            optional
            locked={Boolean(psaFieldLocks?.autographGrade)}
          />
          <InputField
            label="PSA Population"
            value={String(get("psaPopulation"))}
            onChange={(v) => set("psaPopulation", v)}
            optional
            locked={Boolean(psaFieldLocks?.psaPopulation)}
          />
          <InputField
            label="PSA Pop Higher"
            value={String(get("psaPopHigher"))}
            onChange={(v) => set("psaPopHigher", v)}
            optional
            locked={Boolean(psaFieldLocks?.psaPopHigher)}
          />
          <div className="sm:col-span-2">
            <InputField
              label="Label Type"
              value={String(get("labelType"))}
              onChange={(v) => set("labelType", v)}
              optional
              locked={Boolean(psaFieldLocks?.labelType)}
            />
          </div>
          <div className="sm:col-span-2">
            <InputField
              label="Category (PSA)"
              value={String(get("psaCategory"))}
              onChange={(v) => set("psaCategory", v)}
              optional
              locked={Boolean(psaFieldLocks?.psaCategory)}
            />
          </div>
        </div>
      )}

      {company === "BGS" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputField label="Centering Subgrade" value={String(get("centering", ""))} onChange={(v) => set("centering", v)} />
          <InputField label="Corners Subgrade" value={String(get("corners", ""))} onChange={(v) => set("corners", v)} />
          <InputField label="Edges Subgrade" value={String(get("edges", ""))} onChange={(v) => set("edges", v)} />
          <InputField label="Surface Subgrade" value={String(get("surface", ""))} onChange={(v) => set("surface", v)} />
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Label Type</label>
            <select
              value={String(get("labelType"))}
              onChange={(e) => set("labelType", e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              <option value="Black Label">Black Label</option>
              <option value="Pristine">Pristine</option>
              <option value="Gold">Gold</option>
            </select>
          </div>
        </div>
      )}

      {company === "CGC" && (
        <div className="space-y-3">
          <InputField label="Subgrades" value={String(get("subgrades"))} onChange={(v) => set("subgrades", v)} optional />
          <div className="flex flex-wrap gap-4">
            <CheckField label="Perfect 10 Flag" checked={Boolean(get("perfect10", false))} onChange={(v) => set("perfect10", v)} />
            <CheckField label="Signature Series Flag" checked={Boolean(get("signatureSeries", false))} onChange={(v) => set("signatureSeries", v)} />
            <CheckField label="Error Card Flag" checked={Boolean(get("errorCard", false))} onChange={(v) => set("errorCard", v)} />
          </div>
        </div>
      )}

      {company === "SGC" && (
        <InputField label="SGC Population" value={String(get("sgcPopulation"))} onChange={(v) => set("sgcPopulation", v)} optional />
      )}

      {company === "TAG" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputField label="TAG Report ID" value={String(get("tagReportId", ""))} onChange={(v) => set("tagReportId", v)} />
          <InputField label="Digital Report URL" value={String(get("digitalReportUrl", ""))} onChange={(v) => set("digitalReportUrl", v)} type="url" />
          <InputField label="Surface Defect Count" value={String(get("surfaceDefectCount", ""))} onChange={(v) => set("surfaceDefectCount", v)} type="number" />
          <InputField label="Edge Damage Score" value={String(get("edgeDamageScore", ""))} onChange={(v) => set("edgeDamageScore", v)} />
        </div>
      )}

      {company === "AGS" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputField label="AGS Scan ID" value={String(get("agsScanId", ""))} onChange={(v) => set("agsScanId", v)} />
          <InputField label="AI Score" value={String(get("aiScore", ""))} onChange={(v) => set("aiScore", v)} />
          <div className="sm:col-span-2">
            <InputField label="3D Scan Report URL" value={String(get("scanReportUrl", ""))} onChange={(v) => set("scanReportUrl", v)} type="url" />
          </div>
        </div>
      )}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  optional,
  locked,
}: {
  label: string;
  value: string | number;
  onChange: (v: string | number) => void;
  type?: "text" | "number" | "url";
  optional?: boolean;
  locked?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">
        {label}
        {optional && <span className="text-gray-600 ml-1">(optional)</span>}
      </label>
      <input
        type={type}
        value={value}
        disabled={locked}
        title={lockedHint(Boolean(locked))}
        onChange={(e) => {
          if (type === "number") {
            const v = e.target.valueAsNumber;
            onChange(Number.isNaN(v) ? "" : v);
          } else {
            onChange(e.target.value);
          }
        }}
        className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
      />
    </div>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-mint focus:ring-mint"
      />
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  );
}
