export interface NftAttribute {
  trait_type: string;
  value: string;
}

export interface NftMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: NftAttribute[];
  /** OpenSea / wallets — custom structured data */
  properties?: Record<string, unknown>;
  external_url?: string;
}

export interface UploadNftResult {
  tokenURI: string;
  metadataCID: string;
  imageCID: string;
  metadata: NftMetadata;
}
