"use client";

import type { GradingCompany } from "@/types/gradedCard";
import { GRADING_COMPANIES } from "@/types/gradedCard";
import { ImageInput } from "./ImageInput";

const inputClass =
  "w-full bg-gray-800 border border-gray-700 focus:border-mint rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors";

interface GradedCardSectionProps {
  gradingCompany: GradingCompany | "";
  onCompanyChange: (company: GradingCompany) => void;
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
}

export function GradedCardSection({
  gradingCompany,
  onCompanyChange,
  card,
  onCardChange,
  grade,
  onGradeChange,
  verification,
  onVerificationChange,
}: GradedCardSectionProps) {
  const hasCompany = !!gradingCompany;

  return (
    <div className="border-t border-gray-800 pt-6 transition-opacity duration-200">
      <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
        <span className="w-1 h-5 bg-mint/70 rounded-full" />
        Graded Card Information
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Add grading details to enrich your asset. All fields are optional.
      </p>

      <div className="space-y-5">
        {/* Grading Company Selector */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">
            Grading Company{" "}
            <span className="text-gray-500 text-xs font-normal">(optional)</span>
          </label>
          <select
            value={gradingCompany}
            onChange={(e) => onCompanyChange(e.target.value as GradingCompany)}
            className="w-full bg-gray-800 border border-gray-700 focus:border-mint rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-all duration-200 appearance-none cursor-pointer"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: "right 0.5rem center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "1.5em 1.5em",
              paddingRight: "2.5rem",
            }}
          >
            <option value="">Select grading company...</option>
            {GRADING_COMPANIES.map(({ value: v, label }) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
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
                    className={inputClass}
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
                    className={inputClass}
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
                    className={inputClass}
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
                    className={inputClass}
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
                    className={inputClass}
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
                    className={inputClass}
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
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Verification */}
            <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50">
              <h4 className="text-xs font-semibold text-mint/90 uppercase tracking-wider mb-3">
                Verification
              </h4>
              {gradingCompany === "PSA" && (
                <p className="text-xs text-gray-400 mb-3 -mt-1 leading-relaxed">
                  슬랩 이미지를 선택하면 아래에서 자동으로 데이터 추출이 시작됩니다.
                </p>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Certification URL{" "}
                  <span className="text-gray-600">(optional)</span>
                </label>
                <input
                  type="url"
                  value={verification.certUrl}
                  onChange={(e) =>
                    onVerificationChange({ ...verification, certUrl: e.target.value })
                  }
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <ImageInput
                  label={
                    gradingCompany === "PSA"
                      ? "Slab Front (자동 분석 트리거)"
                      : "Slab Front Image (optional)"
                  }
                  value={verification.slabFront}
                  onChange={(f) => onVerificationChange({ ...verification, slabFront: f })}
                  mode="file"
                />
                <ImageInput
                  label={
                    gradingCompany === "PSA"
                      ? "Slab Back (선택 · 추가 시 재분석)"
                      : "Slab Back Image (optional)"
                  }
                  value={verification.slabBack}
                  onChange={(f) => onVerificationChange({ ...verification, slabBack: f })}
                  mode="file"
                />
              </div>
            </div>

            {/* Company-specific fields */}
            <CompanySpecificBlock
              company={gradingCompany as GradingCompany}
              subgrades={grade.subgrades}
              onChange={(subgrades) => onGradeChange({ subgrades })}
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
}: {
  company: GradingCompany;
  subgrades: Record<string, string | number | boolean>;
  onChange: (s: Record<string, string | number | boolean>) => void;
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
          />
          <InputField
            label="PSA Population"
            value={String(get("psaPopulation"))}
            onChange={(v) => set("psaPopulation", v)}
            optional
          />
          <InputField
            label="PSA Pop Higher"
            value={String(get("psaPopHigher"))}
            onChange={(v) => set("psaPopHigher", v)}
            optional
          />
          <div className="sm:col-span-2">
            <InputField
              label="Label Type"
              value={String(get("labelType"))}
              onChange={(v) => set("labelType", v)}
              optional
            />
          </div>
          <div className="sm:col-span-2">
            <InputField
              label="Category (PSA)"
              value={String(get("psaCategory"))}
              onChange={(v) => set("psaCategory", v)}
              optional
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
}: {
  label: string;
  value: string | number;
  onChange: (v: string | number) => void;
  type?: "text" | "number" | "url";
  optional?: boolean;
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
        onChange={(e) => {
          if (type === "number") {
            const v = e.target.valueAsNumber;
            onChange(Number.isNaN(v) ? "" : v);
          } else {
            onChange(e.target.value);
          }
        }}
        className={inputClass}
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
