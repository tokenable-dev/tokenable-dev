"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminPartnerCompanyAddress,
  putAdminPartnerCompanyAddress,
  rq,
} from "@/lib/core";
import {
  EMPTY_PARTNER_COMPANY_ADDRESS_FORM,
  PARTNER_COMPANY_COUNTRY_OPTIONS,
  partnerCompanyAddressFormToInput,
  partnerCompanyAddressToForm,
  validatePartnerCompanyAddressForm,
  type PartnerCompanyAddressFormState,
} from "@/components/partner/PartnerCompanyAddressFormFields";
import {
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_TEXT_ERROR,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={ADMIN_LABEL} htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Expandable admin panel — view/edit Partner vault Origin (FedEx ship-from).
 * Uses light admin inputs (not dark Tk* DS) so it matches Marketplace Admin.
 */
export function AdminPartnerOriginPanel({
  partnerId,
  partnerName,
  onClose,
}: {
  partnerId: string;
  partnerName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PartnerCompanyAddressFormState>(
    EMPTY_PARTNER_COMPANY_ADDRESS_FORM,
  );
  const [formError, setFormError] = useState<string | null>(null);

  const addressQuery = useQuery({
    queryKey: rq.adminPartnerCompanyAddress(partnerId),
    queryFn: () => getAdminPartnerCompanyAddress(partnerId),
  });

  useEffect(() => {
    if (!addressQuery.data) return;
    setForm(partnerCompanyAddressToForm(addressQuery.data.address));
    if (!addressQuery.data.hasCompanyAddress) setEditing(true);
  }, [addressQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const err = validatePartnerCompanyAddressForm(form);
      if (err) throw new Error(err);
      return putAdminPartnerCompanyAddress(
        partnerId,
        partnerCompanyAddressFormToInput(form),
      );
    },
    onSuccess: () => {
      setFormError(null);
      setEditing(false);
      void qc.invalidateQueries({
        queryKey: rq.adminPartnerCompanyAddress(partnerId),
      });
      void qc.invalidateQueries({ queryKey: rq.adminMarketplacePartners });
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const address = addressQuery.data?.address ?? null;
  const set =
    <K extends keyof PartnerCompanyAddressFormState>(key: K) =>
    (value: PartnerCompanyAddressFormState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            Partner vault Origin · {partnerName}
          </p>
          <p className={`mt-0.5 text-xs ${ADMIN_TEXT_MUTED}`}>
            FedEx ship-from for Partner vault redeems. Same record partners edit
            in Settings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing ? (
            <button
              type="button"
              className={ADMIN_BTN_SECONDARY}
              onClick={() => setEditing(true)}
            >
              {address ? "Edit Origin" : "Add Origin"}
            </button>
          ) : null}
          <button type="button" className={ADMIN_BTN_SECONDARY} onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {addressQuery.isLoading ? (
        <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>Loading Origin…</p>
      ) : addressQuery.isError ? (
        <p className={ADMIN_TEXT_ERROR} role="alert">
          {addressQuery.error instanceof Error
            ? addressQuery.error.message
            : "Failed to load Origin"}
        </p>
      ) : !editing && address ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className={ADMIN_TEXT_MUTED}>Company</dt>
            <dd className="font-medium text-zinc-900">{address.companyName}</dd>
          </div>
          <div>
            <dt className={ADMIN_TEXT_MUTED}>Contact</dt>
            <dd className="text-zinc-800">
              {address.contactName} · {address.phone}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className={ADMIN_TEXT_MUTED}>Address</dt>
            <dd className="text-zinc-800">
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}
              <br />
              {[address.city, address.region, address.postal]
                .filter(Boolean)
                .join(", ")}{" "}
              · {address.country}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={`ao-${partnerId}-co`} label="Company name">
            <input
              id={`ao-${partnerId}-co`}
              className={ADMIN_INPUT}
              value={form.companyName}
              onChange={(e) => set("companyName")(e.target.value)}
              autoComplete="organization"
            />
          </Field>
          <Field id={`ao-${partnerId}-contact`} label="Contact name">
            <input
              id={`ao-${partnerId}-contact`}
              className={ADMIN_INPUT}
              value={form.contactName}
              onChange={(e) => set("contactName")(e.target.value)}
              autoComplete="name"
            />
          </Field>
          <Field id={`ao-${partnerId}-phone`} label="Phone">
            <input
              id={`ao-${partnerId}-phone`}
              className={ADMIN_INPUT}
              value={form.phone}
              onChange={(e) => set("phone")(e.target.value)}
              autoComplete="tel"
            />
          </Field>
          <Field id={`ao-${partnerId}-country`} label="Country">
            <select
              id={`ao-${partnerId}-country`}
              className={ADMIN_INPUT}
              value={form.country}
              onChange={(e) => set("country")(e.target.value)}
            >
              {PARTNER_COMPANY_COUNTRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field id={`ao-${partnerId}-line1`} label="Address line 1">
              <input
                id={`ao-${partnerId}-line1`}
                className={ADMIN_INPUT}
                value={form.line1}
                onChange={(e) => set("line1")(e.target.value)}
                autoComplete="address-line1"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id={`ao-${partnerId}-line2`} label="Address line 2 (optional)">
              <input
                id={`ao-${partnerId}-line2`}
                className={ADMIN_INPUT}
                value={form.line2}
                onChange={(e) => set("line2")(e.target.value)}
                autoComplete="address-line2"
              />
            </Field>
          </div>
          <Field id={`ao-${partnerId}-city`} label="City">
            <input
              id={`ao-${partnerId}-city`}
              className={ADMIN_INPUT}
              value={form.city}
              onChange={(e) => set("city")(e.target.value)}
              autoComplete="address-level2"
            />
          </Field>
          <Field id={`ao-${partnerId}-region`} label="State / province">
            <input
              id={`ao-${partnerId}-region`}
              className={ADMIN_INPUT}
              value={form.region}
              onChange={(e) => set("region")(e.target.value)}
              autoComplete="address-level1"
            />
          </Field>
          <Field id={`ao-${partnerId}-postal`} label="Postal code">
            <input
              id={`ao-${partnerId}-postal`}
              className={ADMIN_INPUT}
              value={form.postal}
              onChange={(e) => set("postal")(e.target.value)}
              autoComplete="postal-code"
            />
          </Field>
          {formError || saveMutation.isError ? (
            <p className={`sm:col-span-2 ${ADMIN_TEXT_ERROR}`} role="alert">
              {formError ??
                (saveMutation.error instanceof Error
                  ? saveMutation.error.message
                  : "Save failed")}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="button"
              className={ADMIN_BTN_PRIMARY}
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving…" : "Save Origin"}
            </button>
            {address ? (
              <button
                type="button"
                className={ADMIN_BTN_SECONDARY}
                onClick={() => {
                  setForm(partnerCompanyAddressToForm(address));
                  setFormError(null);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
