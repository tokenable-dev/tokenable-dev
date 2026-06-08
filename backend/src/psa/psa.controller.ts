import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  ServiceUnavailableException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PsaOrderProgressLookupResponseDto } from './dto/psa-order-progress.dto';
import {
  PsaPublicApiService,
  type PsaOrderProgressLookupResult,
  type PsaSubmissionProgressLookupResult,
} from './psa-public-api.service';
import { PsaService, type PsaAnalyzeResult } from './psa.service';
import { SWAGGER_BODY_EXAMPLES } from '../swagger/examples';
import { SWAGGER_FIXTURES } from '../swagger/fixtures';

const imageFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (e: Error | null, ok: boolean) => void,
) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  cb(null, allowed.includes(file.mimetype));
};

/**
 * PSA 슬랩 분석·Cert 조회·주문/제출 진행 상태 (Public API 프록시).
 */
@ApiTags('psa')
@Controller('psa')
export class PsaController {
  private readonly logger = new Logger(PsaController.name);

  constructor(
    private readonly psaService: PsaService,
    private readonly psaPublicApi: PsaPublicApiService,
  ) {}

  /** 슬랩 사진 OCR → Cert 후보 → PSA 공식 API 검증 */
  @ApiOperation({
    summary: '슬랩 이미지 분석 (OCR + PSA API)',
    description:
      '슬랩 앞면 필수, 뒷면 선택. Cardhedger OCR과 슬랩 OCR로 Cert 후보를 찾은 뒤 PSA 공식 API로 검증·메타 보강합니다. OCR이 Cert를 못 읽으면 multipart 필드 `certNumber`(숫자 또는 psacard.com/cert/ URL)를 넣으면 해당 번호를 우선 조회합니다.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['slabFront'],
      properties: {
        slabFront: { type: 'string', format: 'binary' },
        slabBack: { type: 'string', format: 'binary' },
        certNumber: { type: 'string', example: SWAGGER_FIXTURES.certNumber },
      },
      example: {
        slabFront: '(binary — jpg/png/webp)',
        certNumber: SWAGGER_FIXTURES.certNumber,
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

  /** Cert 번호만으로 PSA 메타 조회 */
  @ApiOperation({
    summary: 'Cert 번호로 PSA 조회',
    description:
      '슬랩 사진 없이 `certNumber`만 보냅니다. 값은 7~10자리 숫자이거나 `https://www.psacard.com/cert/12345678` 형태일 수 있습니다. `PSA_PUBLIC_API_TOKEN`이 있으면 공식 API로 메타·이미지 URL을 보강합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['certNumber'],
      properties: {
        certNumber: { type: 'string', example: SWAGGER_FIXTURES.certNumber },
      },
      example: SWAGGER_BODY_EXAMPLES.psaAnalyzeByCert,
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

  /** PSA 주문 진행 상태 (Public API 프록시) */
  @ApiOperation({
    summary: 'PSA 주문 진행 조회',
    description:
      'PSA Public API `GET /order/GetProgress/{orderNumber}` 프록시.\n\n' +
      '- `PSA_PUBLIC_API_TOKEN` 필요 (psacard.com/publicapi)\n' +
      '- 응답 `raw`는 PSA Swagger `OrderProgress` (gradesReady, shipped, orderProgressSteps 등)\n' +
      '- **Cert 번호 목록은 포함되지 않음** (공식 스키마 기준)',
  })
  @ApiParam({ name: 'orderNumber', description: 'PSA 주문 번호', example: SWAGGER_FIXTURES.psaOrderNumber })
  @ApiOkResponse({ type: PsaOrderProgressLookupResponseDto })
  @Get('order/progress/:orderNumber')
  async getOrderProgress(
    @Param('orderNumber') orderNumber: string,
  ): Promise<PsaOrderProgressLookupResult> {
    return this.handleOrderProgressLookup(
      () => this.psaPublicApi.getOrderProgress(orderNumber),
      'order progress',
    );
  }

  /** PSA 제출(submission) 진행 상태 */
  @ApiOperation({
    summary: 'PSA 제출 진행 조회',
    description:
      'PSA Public API `GET /order/GetSubmissionProgress/{submissionNumber}` 프록시.\n\n' +
      '제출 번호는 psacard.com/orderstatus 또는 제출 확인 이메일에서 확인.',
  })
  @ApiParam({ name: 'submissionNumber', description: 'PSA 제출 번호', example: SWAGGER_FIXTURES.psaSubmissionNumber })
  @ApiOkResponse({ type: PsaOrderProgressLookupResponseDto })
  @Get('order/submission-progress/:submissionNumber')
  async getSubmissionProgress(
    @Param('submissionNumber') submissionNumber: string,
  ): Promise<PsaSubmissionProgressLookupResult> {
    return this.handleOrderProgressLookup(
      () => this.psaPublicApi.getSubmissionProgress(submissionNumber),
      'submission progress',
    );
  }

  /** 주문 진행 조회 (POST, Swagger 테스트용) */
  @ApiOperation({
    summary: 'PSA 주문 진행 조회 (POST)',
    description:
      '`GET /psa/order/progress/:orderNumber` 와 동일. Swagger에서 번호만 넣고 테스트할 때 사용.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderNumber'],
      properties: {
        orderNumber: { type: 'string', example: SWAGGER_FIXTURES.psaOrderNumber },
      },
      example: SWAGGER_BODY_EXAMPLES.psaOrderProgress,
    },
  })
  @ApiOkResponse({ type: PsaOrderProgressLookupResponseDto })
  @Post('order/progress')
  async postOrderProgress(
    @Body() body: { orderNumber?: string },
  ): Promise<PsaOrderProgressLookupResult> {
    return this.handleOrderProgressLookup(
      () => this.psaPublicApi.getOrderProgress(body?.orderNumber),
      'order progress',
    );
  }

  /** 제출 진행 조회 (POST, Swagger 테스트용) */
  @ApiOperation({
    summary: 'PSA 제출 진행 조회 (POST)',
    description:
      '`GET /psa/order/submission-progress/:submissionNumber` 와 동일.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['submissionNumber'],
      properties: {
        submissionNumber: {
          type: 'string',
          example: SWAGGER_FIXTURES.psaSubmissionNumber,
        },
      },
      example: SWAGGER_BODY_EXAMPLES.psaSubmissionProgress,
    },
  })
  @ApiOkResponse({ type: PsaOrderProgressLookupResponseDto })
  @Post('order/submission-progress')
  async postSubmissionProgress(
    @Body() body: { submissionNumber?: string },
  ): Promise<PsaSubmissionProgressLookupResult> {
    return this.handleOrderProgressLookup(
      () => this.psaPublicApi.getSubmissionProgress(body?.submissionNumber),
      'submission progress',
    );
  }

  private async handleOrderProgressLookup<T extends PsaOrderProgressLookupResult>(
    run: () => Promise<T>,
    label: string,
  ): Promise<T> {
    try {
      const result = await run();
      if (result.status === 'disabled') {
        throw new ServiceUnavailableException(
          'PSA_PUBLIC_API_TOKEN 이 설정되지 않았습니다. backend/.env 에 psacard.com/publicapi 토큰을 추가하세요.',
        );
      }
      if (result.status === 'skipped') {
        throw new BadRequestException('orderNumber 또는 submissionNumber 가 필요합니다.');
      }
      return result;
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`PSA ${label} failed: ${msg}`);
      throw new InternalServerErrorException(
        `PSA ${label} 조회 중 서버 오류가 발생했습니다.`,
      );
    }
  }
}
