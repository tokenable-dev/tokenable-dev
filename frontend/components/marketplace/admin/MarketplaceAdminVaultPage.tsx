"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMarketplaceAdminPsaVault } from "@/hooks/marketplace-admin/useMarketplaceAdminPsaVault";
import { formatPsaAnalyzeError } from "@/lib/psa/psaApiErrors";
import {
  buildCarrierTrackingUrl,
  formatBoolFlag,
  orderProgressStepLabel,
  parseOrderProgressBody,
  type PsaOrderProgressLookupResponse,
} from "@/lib/psa/psaOrderProgressDisplay";
import type { PsaAnalyzeResult } from "@/lib/core/api/psa";
import type {
  PsaCertImagesLookupResponse,
  PsaCertPublicApiLookupResponse,
  PsaSpecPopulationLookupResponse,
} from "@/lib/core/api/marketplace-admin-psa";
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

type VaultTab =
  | "shipping"
  | "cert"
  | "assets"
  | "population"
  | "slab";

const TABS: { id: VaultTab; label: string }[] = [
  { id: "shipping", label: "Shipping & orders" },
  { id: "cert", label: "Cert lookup" },
  { id: "assets", label: "Images & labels" },
  { id: "population", label: "Population" },
  { id: "slab", label: "Slab OCR" },
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

function OrderProgressPanel({ result }: { result: PsaOrderProgressLookupResponse }) {
  const body = useMemo(() => parseOrderProgressBody(result.raw), [result.raw]);
  const trackingUrl = buildCarrierTrackingUrl(body?.shipCarrier, body?.shipTrackingNumber);

  if (result.status !== "success" || !body) {
    return (
      <div className={`${ADMIN_PANEL} mt-4 p-4 sm:p-5`}>
        <p className="text-sm text-amber-700">
          {result.message ?? "No order progress data returned."}
          {result.httpStatus ? ` (HTTP ${result.httpStatus})` : null}
        </p>
        <JsonDetails data={result} />
      </div>
    );
  }

  return (
    <div className={`${ADMIN_PANEL} mt-4 overflow-hidden`}>
      <div className="border-b border-zinc-200 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-zinc-900">
            Order {body.orderNumber ?? result.referenceNumber ?? "—"}
          </h3>
          {body.shipped ? (
            <StatusPill ok label="Shipped" />
          ) : body.gradesReady ? (
            <StatusPill ok label="Grades ready" />
          ) : (
            <StatusPill ok={false} label="In progress" />
          )}
        </div>
        {result.psaPath ? (
          <p className={`mt-1 text-xs ${ADMIN_TEXT_MUTED}`}>PSA path: {result.psaPath}</p>
        ) : null}
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Shipping</p>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-600">Carrier</dt>
              <dd className="font-medium text-zinc-900">{body.shipCarrier?.trim() || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-600">Tracking #</dt>
              <dd className="font-mono text-zinc-900">
                {body.shipTrackingNumber?.trim() ? (
                  trackingUrl ? (
                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={ADMIN_LINK}
                    >
                      {body.shipTrackingNumber}
                    </a>
                  ) : (
                    body.shipTrackingNumber
                  )
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-600">Shipped</dt>
              <dd className="font-medium text-zinc-900">{formatBoolFlag(body.shipped)}</dd>
            </div>
          </dl>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Status flags</p>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-600">Grades ready</dt>
              <dd className="font-medium text-zinc-900">{formatBoolFlag(body.gradesReady)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-600">Label review</dt>
              <dd className="font-medium text-zinc-900">
                {formatBoolFlag(body.readyForLabelReview)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-600">Accounting hold</dt>
              <dd className="font-medium text-zinc-900">{formatBoolFlag(body.accountingHold)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-600">Problem order</dt>
              <dd className="font-medium text-zinc-900">{formatBoolFlag(body.problemOrder)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {body.orderProgressSteps && body.orderProgressSteps.length > 0 ? (
        <div className="border-t border-zinc-200 px-4 py-4 sm:px-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Progress steps (PSA enum 0–8)
          </p>
          <ul className="mt-3 space-y-2">
            {body.orderProgressSteps.map((row, i) => (
              <li
                key={`${row.index ?? i}-${row.step ?? "x"}`}
                className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm"
              >
                <span className="text-zinc-800">
                  {orderProgressStepLabel(row.step)}
                  {row.index != null ? (
                    <span className="text-zinc-500"> · index {row.index}</span>
                  ) : null}
                </span>
                <StatusPill ok={Boolean(row.completed)} label={row.completed ? "Done" : "Pending"} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-zinc-200 px-4 py-3 sm:px-5">
        <JsonDetails data={result.raw} />
      </div>
    </div>
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

function CertLookupPanel({ result }: { result: PsaCertPublicApiLookupResponse }) {
  if (result.status !== "success") {
    return (
      <div className={`${ADMIN_PANEL} mt-4 p-4 sm:p-5`}>
        <p className="text-sm text-amber-700">
          {result.message ?? "Cert lookup failed."}
          {result.httpStatus ? ` (HTTP ${result.httpStatus})` : null}
        </p>
        <JsonDetails data={result} />
      </div>
    );
  }

  return (
    <div className={`${ADMIN_PANEL} mt-4 p-4 sm:p-5`}>
      <p className="text-sm text-zinc-700">
        Cert <span className="font-mono font-medium text-zinc-900">{result.certNumber}</span>
        {result.psaPath ? (
          <span className="text-zinc-500"> · {result.psaPath}</span>
        ) : null}
      </p>
      <CertSummary raw={result.raw} />
      <JsonDetails data={result.raw} />
    </div>
  );
}

function CertImagesPanel({ result }: { result: PsaCertImagesLookupResponse }) {
  const images = useMemo(() => {
    if (!Array.isArray(result.raw)) return [];
    return result.raw
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const obj = row as Record<string, unknown>;
        const url = typeof obj.ImageURL === "string" ? obj.ImageURL : null;
        const isFront = obj.IsFrontImage === true;
        return url ? { url, isFront } : null;
      })
      .filter((v): v is { url: string; isFront: boolean } => Boolean(v));
  }, [result.raw]);

  if (result.status !== "success") {
    return (
      <div className={`${ADMIN_PANEL} mt-4 p-4 sm:p-5`}>
        <p className="text-sm text-amber-700">
          {result.message ?? "Image lookup failed."}
          {result.httpStatus ? ` (HTTP ${result.httpStatus})` : null}
        </p>
        <JsonDetails data={result} />
      </div>
    );
  }

  return (
    <div className={`${ADMIN_PANEL} mt-4 p-4 sm:p-5`}>
      {images.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {images.map((img) => (
            <figure key={img.url} className="overflow-hidden rounded-md border border-zinc-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.isFront ? "PSA slab front" : "PSA slab back"}
                className="h-64 w-full bg-zinc-50 object-contain"
              />
              <figcaption className="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-600">
                {img.isFront ? "Front" : "Back"}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-600">No image URLs in response.</p>
      )}
      <JsonDetails data={result.raw} />
    </div>
  );
}

function PopulationPanel({ result }: { result: PsaSpecPopulationLookupResponse }) {
  const grades = useMemo(() => {
    if (!result.pop?.byGrade) return [];
    return Object.entries(result.pop.byGrade)
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  }, [result.pop?.byGrade]);

  if (result.status !== "success") {
    return (
      <div className={`${ADMIN_PANEL} mt-4 p-4 sm:p-5`}>
        <p className="text-sm text-amber-700">
          {result.message ?? "Population lookup failed."}
          {result.httpStatus ? ` (HTTP ${result.httpStatus})` : null}
        </p>
        <JsonDetails data={result} />
      </div>
    );
  }

  return (
    <div className={`${ADMIN_PANEL} mt-4 overflow-hidden`}>
      <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
        <p className="text-sm text-zinc-700">
          Spec ID <span className="font-mono font-medium">{result.specId}</span>
          {result.pop?.total != null ? (
            <>
              {" "}
              · total <span className="font-medium">{result.pop.total}</span>
            </>
          ) : null}
          {result.pop?.grade10 != null ? (
            <>
              {" "}
              · PSA 10 <span className="font-medium">{result.pop.grade10}</span>
            </>
          ) : null}
        </p>
      </div>
      {grades.length > 0 ? (
        <div className={ADMIN_TABLE_WRAP}>
          <table className={ADMIN_TABLE}>
            <thead className={ADMIN_TABLE_HEAD}>
              <tr>
                <th className={ADMIN_TABLE_TH}>Grade</th>
                <th className={ADMIN_TABLE_TH}>Count</th>
              </tr>
            </thead>
            <tbody>
              {grades.map(([grade, count]) => (
                <tr key={grade}>
                  <td className={ADMIN_TABLE_TD}>{grade}</td>
                  <td className={ADMIN_TABLE_TD}>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="px-4 py-3 sm:px-5">
        <JsonDetails data={result.raw} />
      </div>
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
  const [tab, setTab] = useState<VaultTab>("shipping");
  const [orderNumber, setOrderNumber] = useState("");
  const [submissionNumber, setSubmissionNumber] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [specId, setSpecId] = useState("");
  const [slabFront, setSlabFront] = useState<File | null>(null);
  const [slabBack, setSlabBack] = useState<File | null>(null);
  const [certHint, setCertHint] = useState("");

  const {
    orderProgressMutation,
    submissionProgressMutation,
    certMutation,
    fileAppendMutation,
    imagesMutation,
    populationMutation,
    analyzeByCertMutation,
    analyzeSlabMutation,
  } = useMarketplaceAdminPsaVault();

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Vault / PSA"
        subtitle="PSA Public API tools for vault operations — order shipping status, cert lookup, slab images, population, and mint OCR pipeline. Requires PSA_PUBLIC_API_TOKEN on the backend."
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

      {tab === "shipping" ? (
        <div className="space-y-5">
          <Section
            title="Order progress (GetProgress)"
            hint="Track PSA order status — grades ready, shipped, carrier, and tracking number. Order-level only (no per-cert list)."
          >
            <LookupForm
              label="PSA order number"
              placeholder="e.g. 123456789"
              value={orderNumber}
              onChange={setOrderNumber}
              busy={orderProgressMutation.isPending}
              onSubmit={() => {
                if (!orderNumber.trim()) return;
                void orderProgressMutation.mutateAsync(orderNumber.trim());
              }}
            />
            <LookupError err={orderProgressMutation.error} />
            {orderProgressMutation.data ? (
              <OrderProgressPanel result={orderProgressMutation.data} />
            ) : null}
          </Section>

          <Section
            title="Submission progress (GetSubmissionProgress)"
            hint="Same OrderProgress shape — use the submission number from psacard.com/orderstatus or confirmation email."
          >
            <LookupForm
              label="PSA submission number"
              placeholder="e.g. 987654321"
              value={submissionNumber}
              onChange={setSubmissionNumber}
              busy={submissionProgressMutation.isPending}
              onSubmit={() => {
                if (!submissionNumber.trim()) return;
                void submissionProgressMutation.mutateAsync(submissionNumber.trim());
              }}
            />
            <LookupError err={submissionProgressMutation.error} />
            {submissionProgressMutation.data ? (
              <OrderProgressPanel result={submissionProgressMutation.data} />
            ) : null}
          </Section>
        </div>
      ) : null}

      {tab === "cert" ? (
        <div className="space-y-5">
          <Section
            title="Cert metadata (GetByCertNumber)"
            hint="Raw PSA PublicCertificationModel — official grade, spec, population summary."
          >
            <LookupForm
              label="Cert number"
              placeholder="7–10 digit PSA cert"
              value={certNumber}
              onChange={setCertNumber}
              busy={certMutation.isPending}
              onSubmit={() => {
                if (!certNumber.trim()) return;
                void certMutation.mutateAsync(certNumber.trim());
              }}
            />
            <LookupError err={certMutation.error} />
            {certMutation.data ? <CertLookupPanel result={certMutation.data} /> : null}
          </Section>

          <Section
            title="Mint pipeline (analyze-by-cert)"
            hint="High-level vault lookup — PSA + Cardhedger match, same as /vault cert-only flow."
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
        </div>
      ) : null}

      {tab === "assets" ? (
        <div className="space-y-5">
          <Section
            title="Slab images (GetImagesByCertNumber)"
            hint="Front/back ImageURL from PSA — used for RWA cover and mint preview."
          >
            <LookupForm
              label="Cert number"
              placeholder="7–10 digit PSA cert"
              value={certNumber}
              onChange={setCertNumber}
              busy={imagesMutation.isPending}
              onSubmit={() => {
                if (!certNumber.trim()) return;
                void imagesMutation.mutateAsync(certNumber.trim());
              }}
            />
            <LookupError err={imagesMutation.error} />
            {imagesMutation.data ? <CertImagesPanel result={imagesMutation.data} /> : null}
          </Section>

          <Section
            title="Label / file append (GetByCertNumberForFileAppend)"
            hint="Compact cert fields for outbound labels, invoices, or batch print files."
          >
            <LookupForm
              label="Cert number"
              placeholder="7–10 digit PSA cert"
              value={certNumber}
              onChange={setCertNumber}
              busy={fileAppendMutation.isPending}
              onSubmit={() => {
                if (!certNumber.trim()) return;
                void fileAppendMutation.mutateAsync(certNumber.trim());
              }}
            />
            <LookupError err={fileAppendMutation.error} />
            {fileAppendMutation.data ? <CertLookupPanel result={fileAppendMutation.data} /> : null}
          </Section>
        </div>
      ) : null}

      {tab === "population" ? (
        <Section
          title="Spec population (GetPSASpecPopulation)"
          hint="Per-grade PSA population for a Spec ID (from PSACert.SpecID)."
        >
          <LookupForm
            label="PSA Spec ID"
            placeholder="e.g. 284890"
            value={specId}
            onChange={setSpecId}
            busy={populationMutation.isPending}
            onSubmit={() => {
              if (!specId.trim()) return;
              void populationMutation.mutateAsync(specId.trim());
            }}
          />
          <LookupError err={populationMutation.error} />
          {populationMutation.data ? (
            <PopulationPanel result={populationMutation.data} />
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
