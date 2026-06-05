import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SWAGGER_BODY_EXAMPLES } from '../swagger/examples';
import { UploadRwaDto } from './dto/upload-rwa.dto';
import { UploadRwaResult } from './interfaces/rwa-metadata.interface';
import { RwaService } from './rwa.service';

/**
 * RWA 민트용 메타데이터 — IPFS 업로드.
 * `POST /api/rwa/upload`
 */
@ApiTags('rwa')
@Controller('rwa')
export class RwaController {
  constructor(private readonly rwaService: RwaService) {}

  /** 이미지·속성을 IPFS에 올리고 ERC-721 `tokenURI` 반환 */
  @ApiOperation({
    summary: 'RWA 메타데이터 IPFS 업로드 (tokenURI)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'description'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        imageUrl: { type: 'string' },
        attributes: { type: 'string', description: 'JSON 배열 문자열' },
        image: { type: 'string', format: 'binary' },
        gradedMetadata: { type: 'string', description: 'PSA/Cardhedger JSON' },
      },
      example: { ...SWAGGER_BODY_EXAMPLES.uploadRwa, image: '(binary)' },
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
    @Body() dto: UploadRwaDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UploadRwaResult> {
    return this.rwaService.uploadToIpfs(dto, file);
  }
}
