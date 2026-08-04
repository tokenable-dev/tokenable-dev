"use client";

import { useCallback, useEffect, useState } from "react";
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
  clearSavedRedeemAddress,
  hasMigratedRedeemAddress,
  markRedeemAddressMigrated,
  readSavedRedeemAddress,
  writeSavedRedeemAddress,
} from "@/lib/portfolio/redeemDraft";
import { SettingsBtn } from "./SettingsBtn";

type AddressForm = {
  label: string;
  name: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  country: ShippingCountry;
  phone: string;
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

function formatAddressInline(addr: ShippingAddress): string {
  const street = [addr.line1, addr.line2].filter(Boolean).join(", ");
  const locality = [addr.city, addr.region, addr.postal].filter(Boolean).join(", ");
  return [street, locality, addr.country.toUpperCase(), addr.phone]
    .filter(Boolean)
    .join(" · ");
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
        // One-shot per user — never resurrect after the user cleared the book,
        // and never migrate another account's localStorage into this user.
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
      setError(e instanceof Error ? e.message : "Failed to load addresses.");
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

  function openEdit(addr: ShippingAddress) {
    setForm(toForm(addr));
    setEditor(addr.id);
    setError(null);
  }

  async function saveForm() {
    const input = toInput(form);
    if (!input.name || !input.line1 || !input.city || !input.postal || !input.phone) {
      setError("Name, street, city, postal code, and phone are required.");
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
      setError(e instanceof Error ? e.message : "Could not save address.");
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
      setError(e instanceof Error ? e.message : "Could not set default.");
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
      setError(e instanceof Error ? e.message : "Could not delete address.");
    }
  }

  return (
    <section className="tk-settings__sec">
      <h1 className="tk-settings__sec-h">Addresses</h1>
      <p className="tk-settings__sec-sub">
        Used when you withdraw physical cards from the vault.
      </p>

      <div className="tk-settings__card">
        {loading ? (
          <p className="py-4 text-sm text-[var(--t2)]">Loading addresses…</p>
        ) : null}
        {!loading
          ? addresses.map((addr) => (
              <div
                key={addr.id}
                className="tk-settings__row tk-settings__row--start tk-settings__row--addr"
              >
                <div className="tk-settings__addr-main">
                  <div className="tk-settings__row-t">
                    {addr.label}
                    {addr.isDefault ? (
                      <span
                        className="tk-settings__chip tk-settings__chip--pos"
                        style={{ marginLeft: 6 }}
                      >
                        DEFAULT
                      </span>
                    ) : null}
                  </div>
                  <div className="tk-settings__row-d tk-settings__row-d--wide">
                    <span className="text-white/80">{addr.name}</span>
                    <span className="text-[var(--t3)]"> · </span>
                    <span>{formatAddressInline(addr)}</span>
                  </div>
                </div>
                <div className="tk-settings__actions tk-settings__actions--addr">
                  <span className="tk-settings__addr-default-slot">
                    {addr.isDefault ? (
                      <span className="tk-settings__addr-default-spacer" aria-hidden>
                        Set as default
                      </span>
                    ) : (
                      <SettingsBtn
                        variant="ghost"
                        size="sm"
                        onClick={() => void setDefault(addr.id)}
                      >
                        Set as default
                      </SettingsBtn>
                    )}
                  </span>
                  <SettingsBtn variant="ghost" size="sm" onClick={() => openEdit(addr)}>
                    Edit
                  </SettingsBtn>
                  <SettingsBtn variant="ghost" size="sm" onClick={() => void remove(addr.id)}>
                    Delete
                  </SettingsBtn>
                </div>
              </div>
            ))
          : null}
        {!loading && addresses.length === 0 && editor == null ? (
          <p className="py-4 text-sm text-[var(--t2)]">No saved addresses.</p>
        ) : null}
      </div>

      {editor == null ? (
        <SettingsBtn variant="ghost" size="md" onClick={openCreate}>
          + Add address
        </SettingsBtn>
      ) : (
        <div className="tk-settings__card mt-3">
          <div className="tk-settings__lbl" style={{ marginBottom: 12 }}>
            {editor === "create" ? "New address" : "Edit address"}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="tk-settings__lbl" htmlFor="addr-label">
                Label
              </label>
              <input
                id="addr-label"
                className="tk-settings__inp"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div>
              <label className="tk-settings__lbl" htmlFor="addr-name">
                Recipient name
              </label>
              <input
                id="addr-name"
                className="tk-settings__inp"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="tk-settings__lbl" htmlFor="addr-line1">
                Street address
              </label>
              <input
                id="addr-line1"
                className="tk-settings__inp"
                value={form.line1}
                onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="tk-settings__lbl" htmlFor="addr-line2">
                Apt / suite (optional)
              </label>
              <input
                id="addr-line2"
                className="tk-settings__inp"
                value={form.line2}
                onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div>
              <label className="tk-settings__lbl" htmlFor="addr-city">
                City
              </label>
              <input
                id="addr-city"
                className="tk-settings__inp"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div>
              <label className="tk-settings__lbl" htmlFor="addr-region">
                State / region
              </label>
              <input
                id="addr-region"
                className="tk-settings__inp"
                value={form.region}
                onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div>
              <label className="tk-settings__lbl" htmlFor="addr-postal">
                Postal code
              </label>
              <input
                id="addr-postal"
                className="tk-settings__inp"
                value={form.postal}
                onChange={(e) => setForm((f) => ({ ...f, postal: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div>
              <label className="tk-settings__lbl" htmlFor="addr-country">
                Country
              </label>
              <select
                id="addr-country"
                className="tk-settings__inp"
                value={form.country}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    country: e.target.value as ShippingCountry,
                  }))
                }
                disabled={saving}
              >
                <option value="us">United States</option>
                <option value="ca">Canada</option>
                <option value="intl">Other / International</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="tk-settings__lbl" htmlFor="addr-phone">
                Phone
              </label>
              <input
                id="addr-phone"
                className="tk-settings__inp"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                disabled={saving}
              />
            </div>
          </div>
          {editor !== "create" && form.isDefault ? (
            <p className="mt-4 text-sm text-[var(--t2)]">
              This is your default address. Use <strong className="text-white">Set as default</strong>{" "}
              on another address to change it.
            </p>
          ) : (
            <label className="mt-4 flex items-center gap-2 text-sm text-[var(--t2)]">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                disabled={saving}
              />
              Set as default
            </label>
          )}
          <div className="mt-5 flex gap-2.5">
            <SettingsBtn
              variant="primary"
              size="sm"
              disabled={saving}
              onClick={() => void saveForm()}
            >
              {saving ? "Saving…" : "Save address"}
            </SettingsBtn>
            <SettingsBtn
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => setEditor(null)}
            >
              Cancel
            </SettingsBtn>
          </div>
        </div>
      )}

      {error ? (
        <p className="mt-3 text-xs text-[var(--warn)]" role="status">
          {error}
        </p>
      ) : null}
    </section>
  );
}
