"use client";

import type { GradingCompany, PsaFieldLocks } from "@/types/gradedCard";
import { ImageInput } from "./ImageInput";

const inputClass =
  "w-full bg-gray-800 border border-gray-700 focus:border-mint rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors";

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

/** PSA: slab upload first; understated styling */
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
    <section
      className="rounded-xl border-2 border-gray-600/70 bg-gray-900/40 p-4 shadow-sm shadow-black/20 sm:p-5"
      aria-labelledby="psa-slab-hero-title"
    >
      <div className="mb-4">
        <span className="inline-flex items-center rounded-md border border-gray-600/80 bg-gray-800/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
          Required · Step 1
        </span>
        <h4
          id="psa-slab-hero-title"
          className="mt-2.5 text-base font-semibold tracking-tight text-white sm:text-lg"
        >
          Upload slab front photo
        </h4>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-gray-400 sm:text-sm">
          Minting runs from this slab image. OCR, PSA lookup, and JustTCG run after upload.
          You do not need a separate card photo.
        </p>
      </div>

      <div className="max-w-xl space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-400">Slab front (required)</p>
          <div className="rounded-lg border border-gray-600/90 bg-gray-950/40 p-3">
            <ImageInput
              label="Choose file or click to upload"
              value={verification.slabFront}
              onChange={(f) => onVerificationChange({ ...verification, slabFront: f })}
              mode="file"
              required
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">
            Certification URL{" "}
            <span className="text-gray-600">(optional — used before OCR if set)</span>
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
    <div className="border-t border-gray-800 pt-6 transition-opacity duration-200">
      <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
        <span className="w-1 h-5 bg-mint/70 rounded-full" />
        Graded Card Information
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        {L?.gradingCompany
          ? "Fields confirmed by PSA analysis cannot be edited. Change the slab to re-analyze."
          : "Start with the slab upload above. Card and grade fields fill in after analysis."}
      </p>

      <div className="space-y-5">
        <PsaSlabUploadHero
          verification={verification}
          onVerificationChange={onVerificationChange}
          psaFieldLocks={L}
        />

        <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-700/90 bg-gray-900/50 px-3 py-2.5">
          <span className="text-sm text-gray-400">Grading company</span>
          <span
            className="text-sm font-medium text-white"
            title={L?.gradingCompany ? lockedHint(true) : undefined}
          >
            PSA
          </span>
        </div>

        {hasCompany && (
          <div className="space-y-5 transition-opacity duration-300">
            {/* Card Information */}
            <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50">
              <h4 className="text-xs font-semibold text-mint/90 uppercase tracking-wider mb-3">
                Card Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">
                    Card Name <span className="text-gray-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={card.name}
                    onChange={(e) => onCardChange({ ...card, name: e.target.value })}
                    placeholder="e.g. 2023 Topps Chrome Refractor"
                    disabled={Boolean(L?.cardName)}
                    title={lockedHint(Boolean(L?.cardName))}
                    className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Player / Character Name{" "}
                    <span className="text-gray-600">(optional)</span>
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
                  <label className="block text-xs text-gray-500 mb-1">
                    Year <span className="text-gray-600">(optional)</span>
                  </label>
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
                  <label className="block text-xs text-gray-500 mb-1">
                    Set / Series <span className="text-gray-600">(optional)</span>
                  </label>
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
                  <label className="block text-xs text-gray-500 mb-1">
                    Card Number <span className="text-gray-600">(optional)</span>
                  </label>
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
            </div>

            {/* Grading Information */}
            <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50">
              <h4 className="text-xs font-semibold text-mint/90 uppercase tracking-wider mb-3">
                Grading Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Certification Number{" "}
                    <span className="text-gray-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={grade.certNumber}
                    onChange={(e) => onGradeChange({ certNumber: e.target.value })}
                    placeholder="e.g. 12345678"
                    disabled={Boolean(L?.certNumber)}
                    title={lockedHint(Boolean(L?.certNumber))}
                    className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Grade <span className="text-gray-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={grade.score}
                    onChange={(e) => onGradeChange({ score: e.target.value })}
                    placeholder="e.g. 10"
                    disabled={Boolean(L?.score)}
                    title={lockedHint(Boolean(L?.score))}
                    className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
                  />
                </div>
              </div>
            </div>

            {/* Company-specific fields */}
            <CompanySpecificBlock
              company="PSA"
              subgrades={grade.subgrades}
              onChange={(subgrades) => onGradeChange({ subgrades })}
              psaFieldLocks={L}
            />
          </div>
        )}
      </div>
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
    <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50">
      <h4 className="text-xs font-semibold text-mint/90 uppercase tracking-wider mb-3">
        {company} Specific
      </h4>

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
      <label className="block text-xs text-gray-500 mb-1">
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
