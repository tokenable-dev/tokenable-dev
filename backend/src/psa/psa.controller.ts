import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PsaService, type PsaAnalyzeResult } from './psa.service';

const imageFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (e: Error | null, ok: boolean) => void,
) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  cb(null, allowed.includes(file.mimetype));
};

@ApiTags('psa')
@Controller('psa')
export class PsaController {
  constructor(private readonly psaService: PsaService) {}

  @ApiOperation({
    summary:
      'PSA 슬랩 OCR → (선택) PSA Public API Cert 조회 → JustTCG 검색',
    description:
      '슬랩 앞면 필수, 뒷면 선택. 서버에 PSA_PUBLIC_API_TOKEN이 있으면 OCR로 추출한 Cert 번호로 PSA 공식 API를 호출해 메타를 보강합니다. 인식·API 결과는 민팅 전 반드시 확인하세요.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['slabFront'],
      properties: {
        slabFront: { type: 'string', format: 'binary', description: '슬랩 앞면' },
        slabBack: { type: 'string', format: 'binary', description: '슬랩 뒷면 (선택)' },
      },
    },
  })
  @Post('analyze')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'slabFront', maxCount: 1 },
        { name: 'slabBack', maxCount: 1 },
      ],
      {
        limits: { fileSize: 15 * 1024 * 1024 },
        fileFilter: imageFilter,
      },
    ),
  )
  async analyze(
    @UploadedFiles()
    files: {
      slabFront?: Express.Multer.File[];
      slabBack?: Express.Multer.File[];
    },
  ): Promise<PsaAnalyzeResult> {
    const front = files?.slabFront?.[0];
    if (!front?.buffer?.length) {
      throw new BadRequestException('slabFront 이미지 파일이 필요합니다.');
    }
    const back = files?.slabBack?.[0];
    return this.psaService.analyzeSlabImages(
      front.buffer,
      back?.buffer,
    );
  }
}
