import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { VaultSubmissionItemStatus } from '../entities/vault-submission-item.entity';
import type { VaultSubmissionStatus } from '../entities/vault-submission.entity';

export class AdminUpdateSubmissionStatusDto {
  @IsIn([
    'draft',
    'awaiting_shipment',
    'in_transit',
    'psa_reviewing',
    'completed',
    'cancelled',
  ])
  status!: VaultSubmissionStatus;
}

export class AdminUpdateItemStatusDto {
  @IsIn([
    'draft',
    'confirmed',
    'in_transit',
    'reviewing',
    'approved',
    'rejected',
    'minting',
    'completed',
    'failed',
  ])
  status!: VaultSubmissionItemStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejectionReason?: string;
}

/** Dev/ops: inject a fake PSA “Items Received” Gmail then poll once. */
export class AdminInjectPsaReceivedMailDto {
  /** One cert (7–10 digits). */
  @IsString()
  @Matches(/^\d{7,10}$/)
  cert!: string;

  /** Display line after “cert - …” (card title). */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cardLabel?: string;
}
