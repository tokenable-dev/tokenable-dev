export interface RwaAttribute {
  trait_type: string;
  value: string;
}

export interface RwaMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: RwaAttribute[];
  /** OpenSea / wallets — custom structured data */
  properties?: Record<string, unknown>;
  external_url?: string;
}

export interface UploadRwaResult {
  tokenURI: string;
  metadataCID: string;
  imageCID: string;
  metadata: RwaMetadata;
  /** Platform S3 slab URL when catalog S3 is configured; null if skipped or failed. */
  displayImageUrl: string | null;
}
