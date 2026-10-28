import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsString, MaxLength } from 'class-validator';

const CATALOG_LOCALES = ['ja', 'zh-CN', 'zh-TW'] as const;

export class CatalogNamesDto {
  @ApiProperty({ enum: CATALOG_LOCALES, example: 'ja' })
  @IsIn(CATALOG_LOCALES)
  locale!: (typeof CATALOG_LOCALES)[number];

  @ApiProperty({ type: [String], example: ['Monkey D. Luffy'] })
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(180, { each: true })
  texts!: string[];
}
