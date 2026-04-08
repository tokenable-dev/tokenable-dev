"use client";

import type { GradingCompany, PsaFieldLocks } from "@/types/gradedCard";
import { ImageInput } from "./ImageInput";

const inputClass =
  "w-full bg-gray-800/80 border border-gray-700/60 focus:border-mint rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-colors";

function lockedHint(locked: boolean): string | undefined {
  return locked ? "Set by PSA analysis and cannot be edited" : undefined;
}

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
    <section aria-labelledby="psa-slab-hero-title">
      <label
        id="psa-slab-hero-title"
        className="block text-sm font-medium text-gray-300 mb-2"
      >
        Upload card photos (front &amp; back)
      </label>
      <div className="rounded-xl border border-dashed border-gray-600/70 bg-gray-800/30 p-4 space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-400">
            Slab front <span className="text-red-400">*</span>
          </p>
          <ImageInput
            label="Choose file or drag &amp; drop"
            value={verification.slabFront}
            onChange={(f) => onVerificationChange({ ...verification, slabFront: f })}
            mode="file"
            required
          />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-400">
            Slab back <span className="text-gray-600">(optional)</span>
          </p>
          <ImageInput
            label="Choose file or drag &amp; drop"
            value={verification.slabBack}
            onChange={(f) => onVerificationChange({ ...verification, slabBack: f })}
            mode="file"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">
            Certification URL{" "}
            <span className="text-gray-600">(optional — speeds up PSA lookup)</span>
          </label>
          <input
            type="url"
            value={verification.certUrl}
            onChange={(e) =>
              onVerificationChange({ ...verification, certUrl: e.target.value })
            }
            placeholder="https://..."
            disabled={Boolean(L?.certUrl)}
            title={lockedHint(Boolean(L?.certUrl))}
            className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
          />
        </div>
        <p className="text-[11px] leading-relaxed text-gray-500">
          After upload, OCR + PSA API + JustTCG run automatically and fill in card details.
        </p>
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
}: GradedCardSectionProps) {
  const hasCompany = !!gradingCompany;
  const L = psaFieldLocks;

  return (
    <div className="space-y-6 transition-opacity duration-200">
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

      {/* Cert Number */}
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

      {/* Upload card photos */}
      <PsaSlabUploadHero
        verification={verification}
        onVerificationChange={onVerificationChange}
        psaFieldLocks={L}
      />

      {/* PSA Specific Details — collapsible */}
      {hasCompany && (
        <CompanySpecificBlock
          company="PSA"
          subgrades={grade.subgrades}
          onChange={(subgrades) => onGradeChange({ subgrades })}
          psaFieldLocks={L}
        />
      )}
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
    <details className="group rounded-xl border border-gray-700/50 bg-gray-800/30 overflow-hidden">
      <summary className="flex items-center justify-between cursor-pointer px-4 py-3 text-sm font-medium text-gray-300 hover:text-white transition-colors select-none">
        <span>{company} Details</span>
        <svg className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </summary>
      <div className="px-4 pb-4 pt-1">

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
    </details>
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
