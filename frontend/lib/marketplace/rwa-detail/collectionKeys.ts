export function resolveRwaDetailCollectionKeyForMatch(input: {
  listingCollectionKey?: string | null;
  fromCollectionParam: string;
  /** Authoritative key from `POST …/token-collection-keys` (mint registry). */
  serverCollectionKey?: string | null;
  metadataDerivedCollectionKey?: string | null;
}): string | null {
  const fromListing = input.listingCollectionKey?.trim();
  if (fromListing) return fromListing;
  if (input.fromCollectionParam) return input.fromCollectionParam;
  const fromServer = input.serverCollectionKey?.trim();
  if (fromServer) return fromServer;
  return input.metadataDerivedCollectionKey ?? null;
}

export function resolveRwaDetailCollectionKeyForRedirect(input: {
  fromCollectionParam: string;
  listingCollectionKey?: string | null;
  serverCollectionKey?: string | null;
  metadataDerivedCollectionKey?: string | null;
}): string | null {
  if (input.fromCollectionParam) return input.fromCollectionParam;
  if (input.listingCollectionKey?.trim()) return input.listingCollectionKey.trim();
  const fromServer = input.serverCollectionKey?.trim();
  if (fromServer) return fromServer;
  return input.metadataDerivedCollectionKey ?? null;
}

export function rwaDetailCollectionHref(collectionKeyForRedirect: string | null): string | null {
  if (!collectionKeyForRedirect) return null;
  return `/marketplace/collections/${encodeURIComponent(collectionKeyForRedirect)}`;
}
