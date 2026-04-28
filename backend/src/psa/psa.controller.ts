import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
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
      'PSA 슬랩 OCR + Cardhedger cert OCR 후보 → PSA Public API 조회',
    description:
      '슬랩 앞면 필수, 뒷면 선택. Cardhedger OCR과 슬랩 OCR로 Cert 후보를 찾은 뒤 PSA 공식 API로 검증·메타 보강합니다. OCR이 Cert를 못 읽으면 multipart 필드 `certNumber`(숫자 또는 psacard.com/cert/ URL)를 넣으면 해당 번호를 우선 조회합니다.',
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
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`PSA analyze failed: ${msg}`, stack);
      throw new InternalServerErrorException(
        'PSA 슬랩 분석 중 서버 오류가 발생했습니다. 백엔드 로그의 스택 트레이스를 확인하세요.',
      );
    }
  }

  @ApiOperation({
    summary: 'Cert 번호만으로 PSA Public API 조회 (OCR 없음)',
    description:
      '슬랩 사진 없이 `certNumber`만 보냅니다. 값은 7~10자리 숫자이거나 `https://www.psacard.com/cert/12345678` 형태일 수 있습니다. `PSA_PUBLIC_API_TOKEN`이 있으면 공식 API로 메타·이미지 URL을 보강합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['certNumber'],
      properties: {
        certNumber: {
          type: 'string',
          description:
            'PSA Cert 숫자만 또는 psacard.com/cert/… URL (본문 JSON)',
        },
      },
    },
  })
  @Post('analyze-by-cert')
  async analyzeByCert(
    @Body() body: { certNumber?: string },
  ): Promise<PsaAnalyzeResult> {
    const raw = body?.certNumber?.trim();
    if (!raw) {
      throw new BadRequestException('certNumber 필드가 필요합니다.');
    }
    try {
      return await this.psaService.analyzeByCertNumber(raw);
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`PSA analyze-by-cert failed: ${msg}`, stack);
      throw new InternalServerErrorException(
        'PSA Cert 조회 중 서버 오류가 발생했습니다. 백엔드 로그의 스택 트레이스를 확인하세요.',
      );
    }
  }
}
