import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/** Admin: create a Markets collection bucket from a PSA cert (no mint / ask required). */
export class AdminCreateCatalogCollectionDto {
  @ApiProperty({
    description:
      'PSA cert number. Graded identity is loaded from PSA Public API and hashed into collection_key.',
    example: '83179580',
  })
  @Matches(/^\d{7,10}$/, {
    message: 'certNumber must be 7–10 digits',
  })
  certNumber!: string;
}
