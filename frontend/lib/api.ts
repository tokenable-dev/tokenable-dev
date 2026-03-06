/** Resolves API URL: env override, or same host:4000 when accessed via LAN (e.g. 192.168.x.x:3000) */
function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    return `${protocol}//${hostname}:4000/api`;
  }
  return "http://localhost:4000/api";
}

export interface UploadNftResult {
  tokenURI: string;
  imageURI: string;
  metadataCID: string;
}

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
}

export interface NftContractInfo {
  name: string;
  symbol: string;
  totalMinted: number;
}

export interface MarketplaceListing {
  tokenId: number;
  seller: string;
  price: string;
  tokenURI: string;
}

export async function uploadNft(formData: FormData): Promise<UploadNftResult> {
  const res = await fetch(`${getApiUrl()}/nft/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Upload failed" }));
    throw new Error((error as { message: string }).message ?? "NFT upload failed");
  }
  return res.json() as Promise<UploadNftResult>;
}

export async function getTokenInfo(): Promise<TokenInfo> {
  const res = await fetch(`${getApiUrl()}/blockchain/token/info`);
  if (!res.ok) throw new Error("Failed to fetch token info");
  return res.json() as Promise<TokenInfo>;
}

export async function getTokenSupply(): Promise<string> {
  const res = await fetch(`${getApiUrl()}/blockchain/token/supply`);
  if (!res.ok) throw new Error("Failed to fetch token supply");
  return res.json() as Promise<string>;
}

export async function getTokenBalance(address: string): Promise<string> {
  const res = await fetch(`${getApiUrl()}/blockchain/token/balance/${address}`);
  if (!res.ok) throw new Error("Failed to fetch token balance");
  return res.json() as Promise<string>;
}

export async function getNftContractInfo(): Promise<NftContractInfo> {
  const res = await fetch(`${getApiUrl()}/blockchain/nft/info`);
  if (!res.ok) throw new Error("Failed to fetch NFT contract info");
  return res.json() as Promise<NftContractInfo>;
}

export async function getNftBalance(address: string): Promise<number> {
  const res = await fetch(`${getApiUrl()}/blockchain/nft/balance/${address}`);
  if (!res.ok) throw new Error("Failed to fetch NFT balance");
  return res.json() as Promise<number>;
}

export async function getNftTokensByOwner(address: string): Promise<number[]> {
  const res = await fetch(`${getApiUrl()}/blockchain/nft/tokens/${address}`);
  if (!res.ok) throw new Error("Failed to fetch owned NFTs");
  return res.json() as Promise<number[]>;
}

export async function getNftTokenURI(tokenId: number): Promise<string> {
  const res = await fetch(`${getApiUrl()}/blockchain/nft/token-uri/${tokenId}`);
  if (!res.ok) throw new Error("Failed to fetch token URI");
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "string" ? parsed : parsed?.tokenURI ?? String(parsed);
  } catch {
    return text.trim();
  }
}

export async function getMarketplaceListings(): Promise<MarketplaceListing[]> {
  const res = await fetch(`${getApiUrl()}/blockchain/marketplace/listings`);
  if (!res.ok) throw new Error("Failed to fetch marketplace listings");
  return res.json() as Promise<MarketplaceListing[]>;
}

export async function getMarketplaceListing(
  tokenId: number
): Promise<MarketplaceListing> {
  const res = await fetch(
    `${getApiUrl()}/blockchain/marketplace/listing/${tokenId}`
  );
  if (!res.ok) throw new Error("Failed to fetch listing");
  return res.json() as Promise<MarketplaceListing>;
}

export interface NftMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
}

const PINATA_GATEWAY =
  process.env.NEXT_PUBLIC_PINATA_GATEWAY ??
  "chocolate-voluntary-raccoon-677.mypinata.cloud";

function buildPinataUrl(cid: string): string {
  return `https://${PINATA_GATEWAY}/ipfs/${cid}`;
}

export async function fetchIpfsMetadata(
  tokenURI: string
): Promise<NftMetadata> {
  const cid = tokenURI.replace("ipfs://", "");
  const url = buildPinataUrl(cid);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch metadata: ${url}`);
  return res.json() as Promise<NftMetadata>;
}

export function resolveIpfsImage(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return buildPinataUrl(uri.replace("ipfs://", ""));
  }
  return uri;
}
