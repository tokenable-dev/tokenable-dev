import { IsEthereumAddress, IsOptional, IsString, IsUUID, Matches, ValidateIf } from 'class-validator';

export class MintSealedBoxDto {
  @IsString()
  @Matches(/^\d{1,32}$/)
  pricechartingProductId!: string;

  @IsUUID()
  clientRequestId!: string;

  @IsOptional()
  @ValidateIf(
    (o: MintSealedBoxDto) =>
      typeof o.recipientAddress === 'string' && o.recipientAddress.trim() !== '',
  )
  @IsEthereumAddress()
  recipientAddress?: string;
}
