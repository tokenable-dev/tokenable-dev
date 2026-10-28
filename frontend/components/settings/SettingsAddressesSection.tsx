"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createShippingAddress,
  deleteShippingAddress,
  listShippingAddresses,
  setDefaultShippingAddress,
  updateShippingAddress,
  type ShippingAddress,
  type ShippingAddressInput,
  type ShippingCountry,
} from "@/lib/core/api/shipping-addresses";
import {
  ShippingAddressFormFields,
  type ShippingAddressFormValues,
} from "@/components/shipping/ShippingAddressFormFields";
import { TkField, TkInput } from "@/components/ds";
import {
  clearSavedRedeemAddress,
  hasMigratedRedeemAddress,
  markRedeemAddressMigrated,
  readSavedRedeemAddress,
  writeSavedRedeemAddress,
} from "@/lib/portfolio/redeemDraft";
import { SettingsBtn } from "./SettingsBtn";
import { SettingsPartnerVaultSection } from "./SettingsPartnerVaultSection";

type AddressForm = ShippingAddressFormValues & {
  label: string;
  isDefault: boolean;
};

const EMPTY_FORM: AddressForm = {
  label: "Home",
  name: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postal: "",
  country: "us",
  phone: "",
  isDefault: false,
};

function addressRowTitle(addr: ShippingAddress): string {
  const name = addr.name.trim();
  const label = addr.label.trim();
  if (!label || label.toLowerCase() === "home") return name;
  return `${name} · ${label}`;
}

function formatAddressBlock(
  addr: ShippingAddress,
  countryName: (code: string) => string,
): string[] {
  const street = [addr.line1, addr.line2].filter(Boolean).join(", ");
  const locality = [
    addr.city,
    [addr.region, addr.postal].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const countryLabel = countryName(addr.country);
  const cityLine = [locality, countryLabel].filter(Boolean).join(", ");
  const lines = [street, cityLine].filter(Boolean);
  if (addr.phone.trim()) lines.push(addr.phone.trim());
  return lines;
}

function toForm(addr: ShippingAddress): AddressForm {
  return {
    label: addr.label,
    name: addr.name,
    line1: addr.line1,
    line2: addr.line2 ?? "",
    city: addr.city,
    region: addr.region ?? "",
    postal: addr.postal,
    country: addr.country,
    phone: addr.phone,
    isDefault: addr.isDefault,
  };
}

function toInput(form: AddressForm): ShippingAddressInput {
  return {
    label: form.label.trim() || "Home",
    name: form.name.trim(),
    line1: form.line1.trim(),
    line2: form.line2.trim() || undefined,
    city: form.city.trim(),
    region: form.region.trim() || undefined,
    postal: form.postal.trim(),
    country: form.country,
    phone: form.phone.trim(),
    isDefault: form.isDefault,
  };
}

function syncRedeemCache(addr: ShippingAddress, userId: string) {
  writeSavedRedeemAddress(
    {
      name: addr.name,
      line1: addr.line1,
      line2: addr.line2 ?? undefined,
      city: addr.city,
      region: addr.region ?? undefined,
      postal: addr.postal,
      country: addr.country,
      phone: addr.phone,
    },
    userId,
  );
}

export function SettingsAddressesSection({ userId }: { userId: string }) {
  const t = useTranslations("Settings");
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<"create" | string | null>(null);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let rows = await listShippingAddresses();
      if (rows.length === 0) {
        if (!hasMigratedRedeemAddress(userId)) {
          const legacy = readSavedRedeemAddress(userId);
          if (legacy) {
            const migrated = await createShippingAddress({
              label: "Home",
              name: legacy.name,
              line1: legacy.line1,
              line2: legacy.line2 || undefined,
              city: legacy.city,
              region: legacy.region || undefined,
              postal: legacy.postal,
              country: legacy.country,
              phone: legacy.phone,
              isDefault: true,
            });
            markRedeemAddressMigrated(userId);
            rows = [migrated];
            syncRedeemCache(migrated, userId);
          } else {
            markRedeemAddressMigrated(userId);
            clearSavedRedeemAddress();
          }
        } else {
          clearSavedRedeemAddress();
        }
      } else {
        markRedeemAddressMigrated(userId);
        const def = rows.find((a) => a.isDefault) ?? rows[0];
        if (def) syncRedeemCache(def, userId);
      }
      setAddresses(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("ui.loadAddrFailed"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function openCreate() {
    setForm({ ...EMPTY_FORM, isDefault: addresses.length === 0 });
    setEditor("create");
    setError(null);
  }

  function toggleAddForm() {
    if (editor === "create") {
      setEditor(null);
      return;
    }
    openCreate();
  }

  function openEdit(addr: ShippingAddress) {
    setForm(toForm(addr));
    setEditor(addr.id);
    setError(null);
  }

  async function saveForm() {
    const input = toInput(form);
    if (!input.name || !input.line1 || !input.city || !input.postal || !input.phone) {
      setError(t("ui.addrRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editor === "create") {
        const created = await createShippingAddress(input);
        if (created.isDefault) syncRedeemCache(created, userId);
      } else if (editor) {
        const updated = await updateShippingAddress(editor, input);
        if (updated.isDefault) syncRedeemCache(updated, userId);
      }
      setEditor(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("ui.saveAddrFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(id: string) {
    setError(null);
    const prev = addresses;
    setAddresses((list) =>
      [...list]
        .map((a) => ({ ...a, isDefault: a.id === id }))
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
    );
    try {
      const updated = await setDefaultShippingAddress(id);
      syncRedeemCache(updated, userId);
    } catch (e) {
      setAddresses(prev);
      setError(e instanceof Error ? e.message : t("ui.defaultFailed"));
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await deleteShippingAddress(id);
      if (addresses.length <= 1) {
        clearSavedRedeemAddress();
        markRedeemAddressMigrated(userId);
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("ui.deleteAddrFailed"));
    }
  }

  const shipValues: ShippingAddressFormValues = {
    name: form.name,
    line1: form.line1,
    line2: form.line2,
    city: form.city,
    region: form.region,
    postal: form.postal,
    country: form.country as ShippingCountry,
    phone: form.phone,
  };

  return (
    <section className="tk-settings__sec">
      <h1 className="tk-settings__sec-h">{t("nav.addresses")}</h1>
      <p className="tk-settings__sec-sub">
        {t("ui.addrSub")}
      </p>

      <div className="tk-settings__card">
        {loading ? (
          <p className="py-4 text-sm text-[var(--t2)]">{t("ui.loadingAddr")}</p>
        ) : null}
        {!loading
          ? addresses.map((addr) => (
              <div
                key={addr.id}
                className="tk-settings__row tk-settings__row--start"
              >
                <div className="min-w-0 flex-1">
                  <div className="tk-settings__row-t">
                    {addressRowTitle(addr)}
                    {addr.isDefault ? (
                      <span
                        className="tk-settings__chip tk-settings__chip--pos"
                        style={{ marginLeft: 6 }}
                      >
                        {t("ui.defaultChip")}
                      </span>
                    ) : null}
                  </div>
                  <div className="tk-settings__row-d tk-settings__row-d--wide">
                    {formatAddressBlock(addr, (code) =>
                      code.toLowerCase() === "us"
                        ? t("ui.unitedStates")
                        : code.length === 2
                          ? code.toUpperCase()
                          : code,
                    ).map((line, i) => (
                      <Fragment key={`${addr.id}-${i}`}>
                        {i > 0 ? <br /> : null}
                        {line}
                      </Fragment>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  {!addr.isDefault ? (
                    <SettingsBtn
                      variant="ghost"
                      size="sm"
                      onClick={() => void setDefault(addr.id)}
                    >
                      {t("ui.setDefault")}
                    </SettingsBtn>
                  ) : null}
                  <SettingsBtn variant="ghost" size="sm" onClick={() => openEdit(addr)}>
                    {t("ui.edit")}
                  </SettingsBtn>
                  <SettingsBtn variant="ghost" size="sm" onClick={() => void remove(addr.id)}>
                    {t("ui.delete")}
                  </SettingsBtn>
                </div>
              </div>
            ))
          : null}
        {!loading && addresses.length === 0 && editor !== "create" ? (
          <p className="py-4 text-sm text-[var(--t2)]">{t("ui.noAddr")}</p>
        ) : null}
      </div>

      <SettingsBtn variant="ghost" size="md" onClick={toggleAddForm}>
        {t("ui.addAddress")}
      </SettingsBtn>

      {editor != null ? (
        <div className="tk-settings__card tk-settings__card--ship-form mt-4">
          <div className="tk-settings__lbl" style={{ marginBottom: 16 }}>
            {editor === "create" ? t("ui.newAddress") : t("ui.editAddress")}
          </div>
          <ShippingAddressFormFields
            idPrefix={editor === "create" ? "addr-new" : `addr-${editor}`}
            value={shipValues}
            disabled={saving}
            onChange={(next) => setForm((f) => ({ ...f, ...next }))}
            extrasBefore={
              <div className="tk-ship-form__section">
                <TkField label={t("ui.label")} htmlFor="addr-label">
                  <TkInput
                    id="addr-label"
                    value={form.label}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, label: e.target.value }))
                    }
                    disabled={saving}
                    placeholder={t("ui.labelPlaceholder")}
                  />
                </TkField>
              </div>
            }
            extrasAfter={
              editor !== "create" && form.isDefault ? (
                <p className="tk-ship-form__note">
                  {t("ui.defaultNote")}
                </p>
              ) : (
                <label className="tk-ship-cbx">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isDefault: e.target.checked }))
                    }
                    disabled={saving}
                  />
                  {t("ui.setDefault")}
                </label>
              )
            }
          />
          <div className="mt-5 flex gap-2.5">
            <SettingsBtn
              variant="primary"
              size="sm"
              disabled={saving}
              onClick={() => void saveForm()}
            >
              {saving ? t("ui.saving") : t("ui.saveAddress")}
            </SettingsBtn>
            <SettingsBtn
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => setEditor(null)}
            >
              {t("ui.cancel")}
            </SettingsBtn>
          </div>
        </div>
      ) : null}

      <SettingsPartnerVaultSection />

      {error ? (
        <p className="mt-3 text-xs text-[var(--warn)]" role="status">
          {error}
        </p>
      ) : null}
    </section>
  );
}
