import { ArrayMaxSize, ArrayMinSize, IsArray, IsEthereumAddress, IsOptional, IsString, Matches } from 'class-validator';

export const PARTNER_VAULT_MINT_MAX_ITEMS = 99;

export class CreatePartnerVaultMintJobDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PARTNER_VAULT_MINT_MAX_ITEMS)
  @IsString({ each: true })
  @Matches(/^\d{7,10}$/, { each: true })
  certNumbers!: string[];

  @IsOptional()
  @IsEthereumAddress()
  recipientAddress?: string;
}
