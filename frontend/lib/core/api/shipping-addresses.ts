import { backendFetch, getApiUrl } from "./client";

export type ShippingCountry = "us" | "ca" | "intl";

export type ShippingAddress = {
  id: string;
  label: string;
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postal: string;
  country: ShippingCountry;
  phone: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ShippingAddressInput = {
  label?: string;
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postal: string;
  country: ShippingCountry;
  phone: string;
  isDefault?: boolean;
};

async function readError(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({ message: fallback }));
  const message =
    (err as { message?: string | string[] }).message ?? fallback;
  return Array.isArray(message) ? message.join(", ") : message;
}

export async function listShippingAddresses(): Promise<ShippingAddress[]> {
  const res = await backendFetch(`${getApiUrl()}/user/shipping-addresses`);
  if (!res.ok) throw new Error(await readError(res, "Failed to load addresses"));
  const data = (await res.json()) as { addresses: ShippingAddress[] };
  return data.addresses ?? [];
}

export async function createShippingAddress(
  input: ShippingAddressInput,
): Promise<ShippingAddress> {
  const res = await backendFetch(`${getApiUrl()}/user/shipping-addresses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to save address"));
  return (await res.json()) as ShippingAddress;
}

export async function updateShippingAddress(
  id: string,
  input: Partial<ShippingAddressInput>,
): Promise<ShippingAddress> {
  const res = await backendFetch(
    `${getApiUrl()}/user/shipping-addresses/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw new Error(await readError(res, "Failed to update address"));
  return (await res.json()) as ShippingAddress;
}

export async function setDefaultShippingAddress(
  id: string,
): Promise<ShippingAddress> {
  const res = await backendFetch(
    `${getApiUrl()}/user/shipping-addresses/${encodeURIComponent(id)}/default`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(await readError(res, "Failed to set default"));
  return (await res.json()) as ShippingAddress;
}

export async function deleteShippingAddress(id: string): Promise<void> {
  const res = await backendFetch(
    `${getApiUrl()}/user/shipping-addresses/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error(await readError(res, "Failed to delete address"));
}

/**
 * Save as the user's default profile address (Settings → Addresses).
 * Updates the current default if one exists; otherwise creates a new default.
 */
export async function upsertDefaultShippingAddress(
  input: ShippingAddressInput,
): Promise<ShippingAddress> {
  const rows = await listShippingAddresses();
  const current = rows.find((a) => a.isDefault) ?? rows[0] ?? null;
  if (current) {
    return updateShippingAddress(current.id, {
      ...input,
      label: input.label ?? current.label,
      isDefault: true,
    });
  }
  return createShippingAddress({
    ...input,
    label: input.label ?? "Home",
    isDefault: true,
  });
}
