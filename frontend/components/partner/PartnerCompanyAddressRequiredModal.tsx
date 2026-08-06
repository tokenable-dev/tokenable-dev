"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TkButton } from "@/components/ds";
import {
  getPartnerMe,
  putPartnerCompanyAddress,
} from "@/lib/core/api/marketplace-partner-me";
import { rq } from "@/lib/core/queryKeys";
import { useAuthStore } from "@/store/authStore";

/** Designer country labels → ISO 3166-1 alpha-2 for FedEx / backend. */
const COUNTRY_OPTIONS: { label: string; code: string }[] = [
  { label: "United States", code: "US" },
  { label: "Korea, Republic of", code: "KR" },
  { label: "Japan", code: "JP" },
  { label: "Singapore", code: "SG" },
  { label: "Hong Kong", code: "HK" },
  { label: "United Kingdom", code: "GB" },
  { label: "Germany", code: "DE" },
  { label: "France", code: "FR" },
  { label: "Canada", code: "CA" },
  { label: "Australia", code: "AU" },
];

type FormState = {
  companyName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  phone: string;
  email: string;
  carrier: string;
  carrierAccount: string;
};

type FieldKey = keyof FormState;

const EMPTY: FormState = {
  companyName: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postal: "",
  country: "US",
  phone: "",
  email: "",
  carrier: "",
  carrierAccount: "",
};

function deferKey(partnerId: string) {
  return `tk_partner_origin_deferred:${partnerId}`;
}

function readDeferred(partnerId: string): boolean {
  try {
    return localStorage.getItem(deferKey(partnerId)) === "1";
  } catch {
    return false;
  }
}

function writeDeferred(partnerId: string, deferred: boolean) {
  try {
    if (deferred) localStorage.setItem(deferKey(partnerId), "1");
    else localStorage.removeItem(deferKey(partnerId));
  } catch {
    /* ignore */
  }
}

function Field({
  id,
  label,
  full,
  children,
  error,
}: {
  id: string;
  label: string;
  full?: boolean;
  children: React.ReactNode;
  error?: string | null;
}) {
  return (
    <div className={`po-field${full ? " po-field--full" : ""}`}>
      <label className="po-label" htmlFor={id}>
        {label}
      </label>
      {children}
      <span className={`po-err${error ? " on" : ""}`} data-for={id}>
        {error || "This field is required"}
      </span>
    </div>
  );
}

/**
 * Designer shipping-origin onboarding (Tokenable - Partner Shipping Origin.html).
 * Remind me later → sticky banner; Self vault stays locked until address is saved.
 */
export function PartnerCompanyAddressRequiredModal() {
  const user = useAuthStore((s) => s.user);
  const authReady = useAuthStore((s) => s.initialized);
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: rq.partnerMe(),
    queryFn: getPartnerMe,
    enabled: Boolean(authReady && user),
    staleTime: 30_000,
  });

  const needsOrigin =
    Boolean(user) &&
    Boolean(meQuery.data?.isPartner) &&
    meQuery.data?.hasCompanyAddress === false;

  const partnerId = meQuery.data?.partnerId ?? null;
  const vaultLabel =
    meQuery.data?.vaultLabel ??
    (meQuery.data?.displayName
      ? `${meQuery.data.displayName} vault`
      : "Partner vault");

  const [deferred, setDeferred] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>(
    {},
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!needsOrigin || !partnerId) {
      setDeferred(false);
      return;
    }
    setDeferred(readDeferred(partnerId));
  }, [needsOrigin, partnerId]);

  useEffect(() => {
    if (!needsOrigin) return;
    const name = meQuery.data?.displayName?.trim();
    if (name) {
      setForm((prev) =>
        prev.companyName ? prev : { ...prev, companyName: name },
      );
    }
  }, [needsOrigin, meQuery.data?.displayName]);

  const showModal = needsOrigin && !deferred;
  const showBanner = needsOrigin && deferred;

  const saveMutation = useMutation({
    mutationFn: () =>
      putPartnerCompanyAddress({
        companyName: form.companyName.trim(),
        contactName: form.companyName.trim(),
        phone: form.phone.trim(),
        country: form.country,
        city: form.city.trim(),
        region: form.region.trim() || null,
        postal: form.postal.trim(),
        line1: form.line1.trim(),
        line2: form.line2.trim() || null,
        residential: false,
      }),
    onSuccess: async () => {
      setSaveError(null);
      if (partnerId) writeDeferred(partnerId, false);
      setDeferred(false);
      await qc.invalidateQueries({ queryKey: rq.partnerMe() });
      await qc.invalidateQueries({
        queryKey: ["self-vault-partner-eligibility"],
      });
    },
    onError: (e: unknown) => {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    },
  });

  function setField(key: FieldKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate(): boolean {
    const next: Partial<Record<FieldKey, string>> = {};
    const require = (key: FieldKey, label: string) => {
      if (!form[key].trim()) next[key] = `${label} is required`;
    };
    require("companyName", "Sender / company name");
    require("line1", "Address line 1");
    require("city", "City");
    require("region", "State / Region");
    require("postal", "Postal code");
    require("phone", "Contact phone");
    if (!form.email.trim()) {
      next.email = "Contact email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = "Enter a valid email address";
    }
    if (
      (form.country === "US" || form.country === "CA") &&
      !form.region.trim()
    ) {
      next.region = "State / region is required for US and Canada";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSave() {
    setSaveError(null);
    if (!validate()) return;
    saveMutation.mutate();
  }

  function onRemindLater() {
    if (!partnerId) return;
    writeDeferred(partnerId, true);
    setDeferred(true);
  }

  function onReopen() {
    if (!partnerId) return;
    writeDeferred(partnerId, false);
    setDeferred(false);
  }

  useEffect(() => {
    if (!showModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showModal]);

  if (!mounted || !needsOrigin) return null;

  return (
    <>
      {showBanner ? (
        <div className="po-banner" role="status">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#EA8200"
            strokeWidth="2.2"
            style={{ flex: "none" }}
            aria-hidden
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
          <span style={{ flex: 1, minWidth: 200 }}>
            <span className="po-banner__t">
              Add your shipping origin to start listing
            </span>
            <br />
            <span className="po-banner__d">
              Your cards stay unlisted until we have an address to ship from.
            </span>
          </span>
          <TkButton
            type="button"
            variant="primary"
            className="!h-10 !px-[18px] !text-sm"
            onClick={onReopen}
          >
            Add address
          </TkButton>
        </div>
      ) : null}

      {showModal
        ? createPortal(
            <div className="po-scrim" role="dialog" aria-modal="true">
              <div className="po-modal">
                <div className="po-eyebrow">Vault partner setup</div>
                <h2 className="po-title">Add your shipping origin</h2>
                <p className="po-sub">
                  As a vault partner, you ship cards to buyers when they redeem.
                  Add the address you&rsquo;ll ship from — we use it to calculate
                  shipping and to fulfill redemptions.
                </p>

                <div className="po-chip">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    aria-hidden
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.3 7 12 12 20.7 7" />
                  </svg>
                  {vaultLabel}
                </div>

                <div className="po-grid">
                  <Field
                    id="po-name"
                    label="Sender / company name"
                    full
                    error={fieldErrors.companyName}
                  >
                    <input
                      className={`po-in${fieldErrors.companyName ? " err" : ""}`}
                      id="po-name"
                      value={form.companyName}
                      placeholder="KDH Collectibles Ltd."
                      disabled={saveMutation.isPending}
                      onChange={(e) => setField("companyName", e.target.value)}
                      autoComplete="organization"
                    />
                  </Field>

                  <Field
                    id="po-a1"
                    label="Address line 1"
                    full
                    error={fieldErrors.line1}
                  >
                    <input
                      className={`po-in${fieldErrors.line1 ? " err" : ""}`}
                      id="po-a1"
                      value={form.line1}
                      placeholder="Street address"
                      disabled={saveMutation.isPending}
                      onChange={(e) => setField("line1", e.target.value)}
                      autoComplete="address-line1"
                    />
                  </Field>

                  <Field id="po-a2" label="Address line 2 (optional)" full>
                    <input
                      className="po-in"
                      id="po-a2"
                      value={form.line2}
                      placeholder="Suite, unit, floor"
                      disabled={saveMutation.isPending}
                      onChange={(e) => setField("line2", e.target.value)}
                      autoComplete="address-line2"
                    />
                  </Field>

                  <Field id="po-city" label="City" error={fieldErrors.city}>
                    <input
                      className={`po-in${fieldErrors.city ? " err" : ""}`}
                      id="po-city"
                      value={form.city}
                      placeholder="City"
                      disabled={saveMutation.isPending}
                      onChange={(e) => setField("city", e.target.value)}
                      autoComplete="address-level2"
                    />
                  </Field>

                  <Field
                    id="po-state"
                    label="State / Region"
                    error={fieldErrors.region}
                  >
                    <input
                      className={`po-in${fieldErrors.region ? " err" : ""}`}
                      id="po-state"
                      value={form.region}
                      placeholder="State or region"
                      disabled={saveMutation.isPending}
                      onChange={(e) => setField("region", e.target.value)}
                      autoComplete="address-level1"
                    />
                  </Field>

                  <Field
                    id="po-zip"
                    label="Postal code"
                    error={fieldErrors.postal}
                  >
                    <input
                      className={`po-in${fieldErrors.postal ? " err" : ""}`}
                      id="po-zip"
                      value={form.postal}
                      placeholder="Postal code"
                      disabled={saveMutation.isPending}
                      onChange={(e) => setField("postal", e.target.value)}
                      autoComplete="postal-code"
                    />
                  </Field>

                  <Field id="po-country" label="Country">
                    <select
                      className="po-in"
                      id="po-country"
                      value={form.country}
                      disabled={saveMutation.isPending}
                      onChange={(e) => setField("country", e.target.value)}
                    >
                      {COUNTRY_OPTIONS.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    id="po-phone"
                    label="Contact phone"
                    error={fieldErrors.phone}
                  >
                    <input
                      className={`po-in${fieldErrors.phone ? " err" : ""}`}
                      id="po-phone"
                      type="tel"
                      value={form.phone}
                      placeholder="+82 10 0000 0000"
                      disabled={saveMutation.isPending}
                      onChange={(e) => setField("phone", e.target.value)}
                      autoComplete="tel"
                    />
                  </Field>

                  <Field
                    id="po-email"
                    label="Contact email"
                    error={fieldErrors.email}
                  >
                    <input
                      className={`po-in${fieldErrors.email ? " err" : ""}`}
                      id="po-email"
                      type="email"
                      value={form.email}
                      placeholder="ops@yourvault.com"
                      disabled={saveMutation.isPending}
                      onChange={(e) => setField("email", e.target.value)}
                      autoComplete="email"
                    />
                  </Field>
                </div>

                <details className="po-acc">
                  <summary>Carrier account / preference (optional)</summary>
                  <div className="po-grid" style={{ marginTop: 14 }}>
                    <Field id="po-carrier" label="Preferred carrier">
                      <input
                        className="po-in"
                        id="po-carrier"
                        value={form.carrier}
                        placeholder="DHL, UPS, FedEx…"
                        disabled={saveMutation.isPending}
                        onChange={(e) => setField("carrier", e.target.value)}
                      />
                    </Field>
                    <Field id="po-acct" label="Carrier account number">
                      <input
                        className="po-in"
                        id="po-acct"
                        value={form.carrierAccount}
                        placeholder="Optional"
                        disabled={saveMutation.isPending}
                        onChange={(e) =>
                          setField("carrierAccount", e.target.value)
                        }
                      />
                    </Field>
                  </div>
                </details>

                <div className="po-help">
                  Required before your cards can be listed. Editable later in
                  Settings → Addresses.
                </div>

                <button
                  type="button"
                  className="po-link"
                  style={{ marginTop: 10 }}
                  onClick={() => setWhyOpen((v) => !v)}
                >
                  Why do we need this?
                </button>
                <div className={`po-why${whyOpen ? " on" : ""}`}>
                  We quote buyers a shipping price from your origin address at
                  checkout, and we hand the same address to the carrier when a
                  buyer redeems a card you hold. Without it we can&rsquo;t price
                  shipping, so your cards can&rsquo;t go live.
                </div>

                {saveError ? (
                  <p className="po-save-error" role="alert">
                    {saveError}
                  </p>
                ) : null}

                <div className="po-foot">
                  <TkButton
                    type="button"
                    variant="primary"
                    className="!h-[50px] !px-[26px] !text-[15px]"
                    disabled={saveMutation.isPending}
                    onClick={onSave}
                  >
                    {saveMutation.isPending
                      ? "Saving…"
                      : "Save shipping origin"}
                  </TkButton>
                  <TkButton
                    type="button"
                    variant="subtle"
                    className="!h-[50px] !px-[22px] !text-[15px]"
                    disabled={saveMutation.isPending}
                    onClick={onRemindLater}
                  >
                    Remind me later
                  </TkButton>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
