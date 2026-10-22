import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type SealedBoxMintStatus = 'pending' | 'minting' | 'minted' | 'failed';

/** One physical sealed box. Not a vault cycle and not a catalog ask. */
@Entity('sealed_box_mints')
@Unique('uq_sealed_box_mints_user_request', ['userId', 'clientRequestId'])
export class SealedBoxMint {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'partner_id', type: 'uuid' })
  partnerId: string;

  @Column({ name: 'chain_id', type: 'int' })
  chainId: number;

  @Column({ name: 'pricecharting_product_id', type: 'varchar', length: 32 })
  pricechartingProductId: string;

  @Column({ name: 'product_name', type: 'varchar', length: 512 })
  productName: string;

  @Column({ name: 'console_name', type: 'varchar', length: 256, default: '' })
  consoleName: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  upc: string | null;

  @Column({ name: 'client_request_id', type: 'varchar', length: 64 })
  clientRequestId: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: SealedBoxMintStatus;

  @Column({ name: 'photo_object_key', type: 'varchar', length: 512, nullable: true })
  photoObjectKey: string | null;

  /** Partner photo on S3. Shown in that owner's portfolio, not on collection detail. */
  @Column({ name: 'display_image_url', type: 'text', nullable: true })
  displayImageUrl: string | null;

  @Column({ name: 'token_uri', type: 'text', nullable: true })
  tokenUri: string | null;

  /** keccak256("sealed-box:" + id). Not VaultService.computeVaultRef. */
  @Column({ name: 'vault_ref', type: 'varchar', length: 66, nullable: true })
  vaultRef: string | null;

  @Column({ name: 'token_contract', type: 'varchar', length: 42, nullable: true })
  tokenContract: string | null;

  @Column({ name: 'token_id', type: 'varchar', length: 64, nullable: true })
  tokenId: string | null;

  @Column({ name: 'mint_tx_hash', type: 'varchar', length: 80, nullable: true })
  mintTxHash: string | null;

  @Column({ name: 'recipient_address', type: 'varchar', length: 42 })
  recipientAddress: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
