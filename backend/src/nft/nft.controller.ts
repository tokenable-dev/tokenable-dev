import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UploadNftDto } from './dto/upload-nft.dto';
import { UploadNftResult } from './interfaces/nft-metadata.interface';
import { NftService } from './nft.service';

@ApiTags('nft')
@Controller('nft')
export class NftController {
  constructor(private readonly nftService: NftService) {}

  @ApiOperation({ summary: 'NFT 이미지 및 메타데이터를 IPFS에 업로드하고 tokenURI 반환' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'description'],
      properties: {
        name: { type: 'string', example: 'My NFT' },
        description: { type: 'string', example: 'This is my first NFT' },
        imageUrl: { type: 'string', example: 'https://example.com/image.png' },
        attributes: {
          type: 'string',
          example: '[{"trait_type":"Background","value":"Blue"}]',
          description: 'JSON 문자열로 전달',
        },
        image: { type: 'string', format: 'binary', description: '이미지 파일 (jpg, jpeg, png)' },
        gradedMetadata: {
          type: 'string',
          description:
            'JSON 문자열 — { graded, attributes?, external_url? } 형태 (PSA/JustTCG 병합)',
        },
      },
    },
  })
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
        cb(null, allowed.includes(file.mimetype));
      },
    }),
  )
  uploadToIpfs(
    @Body() dto: UploadNftDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UploadNftResult> {
    return this.nftService.uploadToIpfs(dto, file);
  }
}
