import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Logger,
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
  private readonly logger = new Logger(PsaController.name);

  constructor(private readonly psaService: PsaService) {}

  @ApiOperation({
    summary:
      'PSA 슬랩 OCR → (선택) PSA Public API Cert 조회 → JustTCG 검색',
    description:
      '슬랩 앞면 필수, 뒷면 선택. 서버에 PSA_PUBLIC_API_TOKEN이 있으면 Cert 번호로 PSA 공식 API를 호출해 메타를 보강합니다. OCR이 Cert를 못 읽으면 multipart 필드 `certNumber`(숫자 또는 psacard.com/cert/ URL)를 넣으면 해당 번호로 조회합니다. 인식·API 결과는 민팅 전 반드시 확인하세요.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['slabFront'],
      properties: {
        slabFront: { type: 'string', format: 'binary', description: '슬랩 앞면' },
        slabBack: { type: 'string', format: 'binary', description: '슬랩 뒷면 (선택)' },
        certNumber: {
          type: 'string',
          description:
            '선택. OCR보다 우선 — Cert 숫자만 또는 https://www.psacard.com/cert/83179580 형태',
        },
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
    @Body('certNumber') certNumber?: string,
  ): Promise<PsaAnalyzeResult> {
    const front = files?.slabFront?.[0];
    if (!front?.buffer?.length) {
      throw new BadRequestException('slabFront 이미지 파일이 필요합니다.');
    }
    const back = files?.slabBack?.[0];
    const hint = certNumber?.trim() || undefined;
    try {
      return await this.psaService.analyzeSlabImages(
        front.buffer,
        back?.buffer,
        hint,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`PSA analyze failed: ${msg}`, stack);
      throw new InternalServerErrorException(
        'PSA 슬랩 분석 중 서버 오류가 발생했습니다. 백엔드 로그의 스택 트레이스를 확인하세요.',
      );
    }
  }
}
