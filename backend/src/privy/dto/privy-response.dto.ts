import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PrivyStatusResponseDto {
  @ApiProperty()
  configured!: boolean;

  @ApiPropertyOptional()
  appId?: string | null;

  @ApiProperty({ description: 'Number of catalogued Privy capabilities' })
  catalogCount!: number;

  @ApiProperty({ type: [String] })
  swaggerTryPaths!: string[];

  @ApiProperty({
    description: 'Apple Pay / Google Pay are available via client `useFiatOnramp` on mainnet only',
  })
  applePayGooglePay!: {
    available: boolean;
    surface: string;
    clientHook: string;
    note: string;
  };
}
