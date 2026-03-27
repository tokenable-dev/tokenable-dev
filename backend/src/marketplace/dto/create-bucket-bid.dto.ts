import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEthereumAddress,
  IsNotEmpty,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateBucketBidDto {
  @ApiProperty({
    description:
      'NFT tokenId — 서버가 tokenURI 메타에서 버킷 키를 계산합니다 (권장). bucketKey와 둘 중 하나.',
    example: '42',
  })
  @IsOptional()
  @IsNumberString()
  tokenId?: string;

  @ApiPropertyOptional({
    description:
      '클라이언트가 직접 계산한 버킷 키(64 hex). tokenId가 없을 때만 사용.',
    example: 'a1b2c3...',
  })
  @IsOptional()
  @IsNotEmpty()
  bucketKey?: string;

  @ApiPropertyOptional({
    description: 'tokenId 없이 bucketKey만 보낼 때 필수 — properties.graded 기반 components',
  })
  @IsOptional()
  @IsObject()
  components?: Record<string, unknown>;

  @ApiProperty({ description: 'USDC 금액 (최소단위 wei 문자열)', example: '10000000' })
  @IsNumberString()
  @IsNotEmpty()
  considerationAmount: string;

  /** Unix seconds */
  @ApiProperty({ description: '주문 만료 시각 (Unix 초)', example: '1735689600' })
  @IsNumberString()
  @IsNotEmpty()
  endTime: string;

  @ApiProperty({ description: '매수자 지갑 주소' })
  @IsEthereumAddress()
  buyerOfferer: string;

  @ApiProperty({
    description:
      'EIP-712 TokenableCollectionBid 서명 (domain: chainId + verifyingContract 0x0)',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({
    description: 'CollectionBid.nonce — buyer별 유일 (uint256 문자열)',
    example: '1730000000000001',
  })
  @IsNumberString()
  @IsNotEmpty()
  nonce: string;
}
