import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
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
