import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  ServiceUnavailableException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { MarketplaceAdminService } from '../../marketplace/admin/marketplace-admin.service';
import { RwaToken } from '../../marketplace/entities/rwa-token.entity';
import {
  CHAIN_ID_HEADER,
  ChainConfigService,
} from '../../blockchain/chain-config.service';
import { ApiChainIdHeader } from '../../swagger/api-headers.util';
import { AdminRwaSlabBackfillDto } from '../dto/admin-rwa-slab-backfill.dto';
import { RwaSlabBackfillService } from '../rwa-slab-backfill.service';
import {
  RWA_SLAB_UPLOAD_MAX_BYTES,
  RwaSlabS3Service,
} from '../rwa-slab-s3.service';
import type { RwaSlabFace } from '../rwa-slab-s3.util';

@ApiTags('marketplace-admin')
@ApiCookieAuth('marketplace_admin_session')
@ApiChainIdHeader()
@Controller('marketplace/admin/rwa-slab')
export class RwaSlabAdminController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly backfill: RwaSlabBackfillService,
    private readonly chainConfig: ChainConfigService,
    private readonly rwaSlabS3: RwaSlabS3Service,
    @InjectRepository(RwaToken)
    private readonly rwaTokenRepo: Repository<RwaToken>,
  ) {}

  @Post('backfill-display-images')
  @ApiOperation({
    summary:
      'Backfill rwa_tokens.display_image_url from IPFS metadata → S3 (best-effort per row)',
  })
  async backfillDisplayImages(
    @Req() req: Request,
    @Body() body: AdminRwaSlabBackfillDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.admin.assertAdminSession(req);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    return this.backfill.backfillMissingDisplayImages({
      limit: body.limit,
      dryRun: body.dryRun,
      chainId,
    });
  }

  @Post(':tokenId/image')
  @ApiOperation({
    summary:
      '[Admin] Upload PSA slab front or back image to S3 and store on rwa_tokens',
  })
  @ApiParam({ name: 'tokenId', example: 1 })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'face'],
      properties: {
        file: { type: 'string', format: 'binary' },
        face: { type: 'string', enum: ['front', 'back'] },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: RWA_SLAB_UPLOAD_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        cb(null, allowed.includes(file.mimetype));
      },
    }),
  )
  async uploadTokenSlabImage(
    @Req() req: Request,
    @Param('tokenId', ParseIntPipe) tokenId: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('face') faceRaw: string,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.admin.assertAdminSession(req);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    const face: RwaSlabFace = faceRaw === 'back' ? 'back' : 'front';
    if (faceRaw !== 'front' && faceRaw !== 'back') {
      throw new BadRequestException('face must be front or back');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }

    const contract = this.chainConfig.getRwaAddress(chainId);
    const row = await this.rwaTokenRepo.findOne({
      where: { tokenContract: contract, tokenId: String(tokenId) },
    });
    if (!row) {
      throw new NotFoundException(`RWA token #${tokenId} not found`);
    }
    const cert = row.certNumber?.trim() ?? '';
    if (!cert) {
      throw new BadRequestException(
        'This token has no cert number — cannot store a slab image on S3',
      );
    }

    try {
      const url = await this.rwaSlabS3.ingestAdminSlab({
        chainId,
        certNumber: cert,
        buffer: file.buffer,
        contentType: file.mimetype,
        face,
      });
      if (face === 'back') {
        row.displayImageBackUrl = url;
      } else {
        row.displayImageUrl = url;
      }
      await this.rwaTokenRepo.save(row);
      return {
        tokenId,
        face,
        displayImageUrl: row.displayImageUrl,
        displayImageBackUrl: row.displayImageBackUrl,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'CATALOG_COVER_S3_NOT_CONFIGURED') {
        throw new ServiceUnavailableException(
          'Catalog cover S3 is not configured',
        );
      }
      if (
        msg === 'CATALOG_COVER_FILE_EMPTY' ||
        msg === 'CATALOG_COVER_FILE_TOO_LARGE' ||
        msg === 'CATALOG_COVER_FILE_TYPE_INVALID'
      ) {
        throw new BadRequestException(
          msg === 'CATALOG_COVER_FILE_TOO_LARGE'
            ? 'Image is too large after processing'
            : msg === 'CATALOG_COVER_FILE_TYPE_INVALID'
              ? 'Image must be JPEG, PNG, or WebP'
              : 'Invalid image upload',
        );
      }
      throw e;
    }
  }
}
