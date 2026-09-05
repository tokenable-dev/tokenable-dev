"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMarketplaceAdminPsaVault } from "@/hooks/marketplace-admin/useMarketplaceAdminPsaVault";
import { formatPsaAnalyzeError } from "@/lib/psa/psaApiErrors";
import type { PsaAnalyzeResult } from "@/lib/core/api/psa";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_DETAILS_SUMMARY,
  ADMIN_INPUT,
  ADMIN_INPUT_MONO,
  ADMIN_LABEL,
  ADMIN_LINK,
  ADMIN_PANEL,
  ADMIN_SEGMENT,
  ADMIN_SEGMENT_BTN,
  ADMIN_SEGMENT_BTN_ACTIVE,
  ADMIN_TABLE,
  ADMIN_TABLE_HEAD,
  ADMIN_TABLE_TD,
  ADMIN_TABLE_TH,
  ADMIN_TABLE_WRAP,
  ADMIN_TEXT_MUTED,
} from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

type VaultTab = "cert" | "slab";

const TABS: { id: VaultTab; label: string }[] = [
  { id: "cert", label: "Cert lookup (mint)" },
  { id: "slab", label: "Slab OCR (mint)" },
];

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium sm:text-sm ${
        ok
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200"
      }`}
    >
      {label}
    </span>
  );
}

function JsonDetails({ data, label = "Raw JSON" }: { data: unknown; label?: string }) {
  if (data == null) return null;
  return (
    <details className="mt-4">
      <summary className={ADMIN_DETAILS_SUMMARY}>{label}</summary>
      <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

function LookupError({ err }: { err: unknown }) {
  if (!err) return null;
  return (
    <p className="mt-3 text-sm text-red-600" role="alert">
      {err instanceof Error ? err.message : "Lookup failed"}
    </p>
  );
}

function LookupForm({
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
  busy,
  buttonLabel = "Look up",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  buttonLabel?: string;
}) {
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="min-w-0 flex-1">
        <label className={ADMIN_LABEL}>{label}</label>
        <input
          className={ADMIN_INPUT_MONO}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={busy}
        />
      </div>
      <button type="submit" className={ADMIN_BTN_PRIMARY} disabled={busy || !value.trim()}>
        {busy ? "Loading…" : buttonLabel}
      </button>
    </form>
  );
}


function CertSummary({ raw }: { raw: unknown }) {
  const psaCert = useMemo(() => {
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as Record<string, unknown>;
    const cert = obj.PSACert;
    return cert && typeof cert === "object" ? (cert as Record<string, unknown>) : null;
  }, [raw]);

  if (!psaCert) return null;

  const rows: [string, string][] = [
    ["Cert #", String(psaCert.CertNumber ?? "—")],
    ["Subject", String(psaCert.Subject ?? "—")],
    ["Grade", String(psaCert.GradeDescription ?? psaCert.CardGrade ?? "—")],
    ["Year", String(psaCert.Year ?? "—")],
    ["Brand / set", String(psaCert.Brand ?? "—")],
    ["Variety", String(psaCert.Variety ?? "—")],
    ["Spec ID", String(psaCert.SpecID ?? "—")],
    ["Population", String(psaCert.TotalPopulation ?? "—")],
  ];

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-zinc-200">
      <table className="w-full text-left text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-zinc-100 last:border-0">
              <th className="w-36 bg-zinc-50 px-3 py-2 font-medium text-zinc-600">{k}</th>
              <td className="px-3 py-2 text-zinc-900">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}




function AnalyzeResultPanel({ result }: { result: PsaAnalyzeResult }) {
  return (
    <div className={`${ADMIN_PANEL} mt-4 p-4 sm:p-5`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">PSA</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div>
              <dt className="text-zinc-600">Cert</dt>
              <dd className="font-mono font-medium text-zinc-900">
                {result.psa.certNumber ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600">Grade</dt>
              <dd className="font-medium text-zinc-900">
                {result.psa.gradeLabel ?? result.psa.gradeDescription ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600">Card</dt>
              <dd className="text-zinc-900">
                {[result.psa.year, result.psa.setHint, result.psa.cardNameHint]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </dd>
            </div>
          </dl>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cardhedger</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div>
              <dt className="text-zinc-600">Match</dt>
              <dd className="font-medium text-zinc-900">
                {result.cardhedgerMint?.matchConfidence ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600">Card ID</dt>
              <dd className="font-mono text-zinc-900">
                {result.cardhedgerMint?.cardId ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600">Price USD</dt>
              <dd className="font-medium text-zinc-900">
                {result.cardhedgerMint?.priceUsd != null
                  ? `$${result.cardhedgerMint.priceUsd}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      {result.psaCertImages?.front || result.psaCertImages?.back ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {result.psaCertImages.front ? (
            <figure className="overflow-hidden rounded-md border border-zinc-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.psaCertImages.front}
                alt="PSA front"
                className="h-48 w-full bg-zinc-50 object-contain"
              />
            </figure>
          ) : null}
          {result.psaCertImages?.back ? (
            <figure className="overflow-hidden rounded-md border border-zinc-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.psaCertImages.back}
                alt="PSA back"
                className="h-48 w-full bg-zinc-50 object-contain"
              />
            </figure>
          ) : null}
        </div>
      ) : null}
      <JsonDetails data={result} />
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className={ADMIN_ARTICLE}>
      <h2 className="text-base font-semibold text-zinc-900 sm:text-lg">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-zinc-600">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function MarketplaceAdminVaultPage() {
  const [tab, setTab] = useState<VaultTab>("cert");
  const [certNumber, setCertNumber] = useState("");
  const [slabFront, setSlabFront] = useState<File | null>(null);
  const [slabBack, setSlabBack] = useState<File | null>(null);
  const [certHint, setCertHint] = useState("");

  const { analyzeByCertMutation, analyzeSlabMutation } =
    useMarketplaceAdminPsaVault();

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Vault / PSA"
        subtitle="Mint-only PSA tools — analyze-by-cert and slab OCR. Raw Public API proxies (shipping/pop/images) are disabled to protect the ~500/day quota."
      />

      <div className={`${ADMIN_SEGMENT} mb-5`}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={tab === item.id ? ADMIN_SEGMENT_BTN_ACTIVE : ADMIN_SEGMENT_BTN}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "cert" ? (
        <Section
          title="Mint pipeline (analyze-by-cert)"
          hint="Same as /vault cert-only mint — PSA GetByCertNumber + Cardhedger. Only mint-path PSA call allowed."
        >
          <LookupForm
            label="Cert number or psacard.com/cert URL"
            placeholder="83179580 or https://www.psacard.com/cert/…"
            value={certNumber}
            onChange={setCertNumber}
            busy={analyzeByCertMutation.isPending}
            buttonLabel="Analyze"
            onSubmit={() => {
              if (!certNumber.trim()) return;
              void analyzeByCertMutation.mutateAsync(certNumber.trim());
            }}
          />
          <LookupError
            err={
              analyzeByCertMutation.error
                ? new Error(formatPsaAnalyzeError(analyzeByCertMutation.error))
                : null
            }
          />
          {analyzeByCertMutation.data ? (
            <AnalyzeResultPanel result={analyzeByCertMutation.data} />
          ) : null}
        </Section>
      ) : null}

      {tab === "slab" ? (
        <Section
          title="Slab OCR (POST /psa/analyze)"
          hint="Upload slab photos — OCR + PSA verify + Cardhedger, same as user vault mint step 1."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={ADMIN_LABEL}>Slab front (required)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={ADMIN_INPUT}
                onChange={(e) => setSlabFront(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className={ADMIN_LABEL}>Slab back (optional)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={ADMIN_INPUT}
                onChange={(e) => setSlabBack(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className={ADMIN_LABEL}>Cert hint (optional)</label>
            <input
              className={ADMIN_INPUT_MONO}
              value={certHint}
              onChange={(e) => setCertHint(e.target.value)}
              placeholder="If OCR misses cert — number or psacard.com/cert URL"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={ADMIN_BTN_PRIMARY}
              disabled={!slabFront || analyzeSlabMutation.isPending}
              onClick={() => {
                if (!slabFront) return;
                void analyzeSlabMutation.mutateAsync({
                  slabFront,
                  slabBack,
                  certHint: certHint.trim() || undefined,
                });
              }}
            >
              {analyzeSlabMutation.isPending ? "Analyzing…" : "Analyze slab"}
            </button>
            <button
              type="button"
              className={ADMIN_BTN_SECONDARY}
              onClick={() => {
                setSlabFront(null);
                setSlabBack(null);
                setCertHint("");
                analyzeSlabMutation.reset();
              }}
            >
              Clear
            </button>
          </div>
          <LookupError
            err={
              analyzeSlabMutation.error
                ? new Error(formatPsaAnalyzeError(analyzeSlabMutation.error))
                : null
            }
          />
          {analyzeSlabMutation.data ? (
            <AnalyzeResultPanel result={analyzeSlabMutation.data} />
          ) : null}
        </Section>
      ) : null}
    </>
  );
}
