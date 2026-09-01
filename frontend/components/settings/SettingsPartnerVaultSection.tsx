"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  EMPTY_PARTNER_COMPANY_ADDRESS_FORM,
  PartnerCompanyAddressFormFields,
  partnerCompanyAddressFormToInput,
  validatePartnerCompanyAddressForm,
  type PartnerCompanyAddressFormState,
} from "@/components/partner/PartnerCompanyAddressFormFields";
import {
  getPartnerMe,
  putPartnerCompanyAddress,
  type PartnerCompanyAddress,
} from "@/lib/core/api/marketplace-partner-me";
import { rq } from "@/lib/core/queryKeys";
import { SettingsBtn } from "./SettingsBtn";

function toForm(addr: PartnerCompanyAddress | null): PartnerCompanyAddressFormState {
  if (!addr) return EMPTY_PARTNER_COMPANY_ADDRESS_FORM;
  return {
    companyName: addr.companyName,
    contactName: addr.contactName,
    phone: addr.phone,
    country: addr.country,
    city: addr.city,
    region: addr.region ?? "",
    postal: addr.postal,
    line1: addr.line1,
    line2: addr.line2 ?? "",
  };
}

function formatPartnerOriginInline(addr: PartnerCompanyAddress): string {
  const street = [addr.line1, addr.line2].filter(Boolean).join(", ");
  const locality = [addr.city, addr.region, addr.postal]
    .filter(Boolean)
    .join(", ");
  return [street, locality, addr.country.toUpperCase(), addr.phone]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Partner vault Origin — same list/edit UX as ship-to addresses.
 * Saved address is FedEx ship-from when buyers redeem Partner vault cards.
 */
export function SettingsPartnerVaultSection() {
  const qc = useQueryClient();
  const meQuery = useQuery({
    queryKey: rq.partnerMe(),
    queryFn: getPartnerMe,
    staleTime: 30_000,
  });

  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<PartnerCompanyAddressFormState>(
    EMPTY_PARTNER_COMPANY_ADDRESS_FORM,
  );
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const addr = meQuery.data?.companyAddress ?? null;
  const hasAddress = Boolean(meQuery.data?.hasCompanyAddress && addr);

  useEffect(() => {
    if (meQuery.data?.companyAddress) {
      setForm(toForm(meQuery.data.companyAddress));
    } else if (meQuery.data?.displayName) {
      setForm((prev) =>
        prev.companyName
          ? prev
          : { ...prev, companyName: meQuery.data!.displayName ?? "" },
      );
    }
  }, [meQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      putPartnerCompanyAddress(partnerCompanyAddressFormToInput(form)),
    onSuccess: async () => {
      setError(null);
      setSavedFlash(true);
      setEditorOpen(false);
      await qc.invalidateQueries({ queryKey: rq.partnerMe() });
      await qc.invalidateQueries({
        queryKey: ["self-vault-partner-eligibility"],
      });
      window.setTimeout(() => setSavedFlash(false), 2500);
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : "Save failed");
    },
  });

  function openCreate() {
    setForm({
      ...EMPTY_PARTNER_COMPANY_ADDRESS_FORM,
      companyName: meQuery.data?.displayName ?? "",
    });
    setEditorOpen(true);
    setError(null);
  }

  function openEdit() {
    setForm(toForm(addr));
    setEditorOpen(true);
    setError(null);
  }

  function onSave() {
    const validationError = validatePartnerCompanyAddressForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    saveMutation.mutate();
  }

  if (meQuery.isLoading || !meQuery.data?.isPartner) {
    return null;
  }

  return (
    <div className="mb-6" id="partner-origin">
      <div className="tk-settings__card">
        <div className="tk-settings__row-t mb-1">Partner vault address</div>
        <p className="tk-settings__row-d tk-settings__row-d--wide mb-3">
          Shipping Origin for{" "}
          <strong className="text-white/90">
            {meQuery.data.vaultLabel ??
              meQuery.data.displayName ??
              "your partner vault"}
          </strong>
          . Used for FedEx rates when buyers ship Partner vault cards home.
        </p>

        {!hasAddress && !editorOpen ? (
          <p className="tk-settings__hint" role="status" style={{ marginBottom: 12 }}>
            Add your vault Origin address to unlock Partner vault listing.
          </p>
        ) : null}

        {meQuery.isFetching && !addr && !editorOpen ? (
          <p className="py-4 text-sm text-[var(--t2)]">Loading…</p>
        ) : null}

        {hasAddress && addr && !editorOpen ? (
          <div className="tk-settings__row tk-settings__row--start tk-settings__row--addr">
            <div className="tk-settings__addr-main">
              <div className="tk-settings__row-t">
                {addr.companyName || "Company"}
                <span
                  className="tk-settings__chip tk-settings__chip--pos"
                  style={{ marginLeft: 6 }}
                >
                  ORIGIN
                </span>
              </div>
              <div className="tk-settings__row-d tk-settings__row-d--wide">
                <span className="text-white/80">{addr.contactName}</span>
                <span className="text-[var(--t3)]"> · </span>
                <span>{formatPartnerOriginInline(addr)}</span>
              </div>
            </div>
            <div className="tk-settings__actions tk-settings__actions--addr">
              <SettingsBtn variant="ghost" size="sm" onClick={openEdit}>
                Edit
              </SettingsBtn>
            </div>
          </div>
        ) : null}

        {!hasAddress && !editorOpen ? (
          <p className="py-4 text-sm text-[var(--t2)]">
            No partner vault address yet.
          </p>
        ) : null}
      </div>

      {!editorOpen && !hasAddress ? (
        <SettingsBtn
          variant="ghost"
          size="md"
          className="mt-3"
          onClick={openCreate}
        >
          + Add partner vault address
        </SettingsBtn>
      ) : null}

      {editorOpen ? (
        <div className="tk-settings__card tk-settings__card--ship-form mt-3">
          <div className="tk-settings__lbl" style={{ marginBottom: 16 }}>
            {hasAddress ? "Edit partner vault address" : "New partner vault address"}
          </div>
          <PartnerCompanyAddressFormFields
            idPrefix="pv-origin"
            value={form}
            onChange={setForm}
            disabled={saveMutation.isPending}
          />
          {error ? (
            <p className="mt-3 text-sm text-neg" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex gap-2.5">
            <SettingsBtn
              type="button"
              variant="primary"
              size="sm"
              disabled={saveMutation.isPending}
              onClick={onSave}
            >
              {saveMutation.isPending ? "Saving…" : "Save address"}
            </SettingsBtn>
            <SettingsBtn
              type="button"
              variant="ghost"
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() => {
                setEditorOpen(false);
                setError(null);
                if (addr) setForm(toForm(addr));
              }}
            >
              Cancel
            </SettingsBtn>
          </div>
        </div>
      ) : null}

      {savedFlash ? (
        <p className="tk-settings__hint mt-3" role="status">
          Partner vault address saved. Shipping out of this vault will use this
          Origin.
        </p>
      ) : null}
    </div>
  );
}
