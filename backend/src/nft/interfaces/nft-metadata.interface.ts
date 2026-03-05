export interface NftAttribute {
  trait_type: string;
  value: string;
}

export interface NftMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: NftAttribute[];
}

export interface UploadNftResult {
  tokenURI: string;
  metadataCID: string;
  imageCID: string;
  metadata: NftMetadata;
}
