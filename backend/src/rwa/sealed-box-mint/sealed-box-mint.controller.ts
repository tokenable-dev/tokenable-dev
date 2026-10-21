import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  CHAIN_ID_HEADER,
  ChainConfigService,
} from '../../blockchain/chain-config.service';
import { ApiChainIdHeader } from '../../swagger/api-headers.util';
import type { User } from '../../user/entities/user.entity';
import { MintSealedBoxDto } from '../dto/mint-sealed-box.dto';
import { SealedBoxMintService } from './sealed-box-mint.service';

@ApiTags('marketplace')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('marketplace/partners/me/sealed-box-mints')
export class SealedBoxMintController {
  constructor(
    private readonly boxes: SealedBoxMintService,
    private readonly chainConfig: ChainConfigService,
  ) {}

  @Post()
  @ApiChainIdHeader()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['pricechartingProductId', 'clientRequestId', 'image'],
      properties: {
        pricechartingProductId: { type: 'string' },
        clientRequestId: { type: 'string', format: 'uuid' },
        recipientAddress: { type: 'string' },
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary:
      'Mint one sealed box to the partner wallet (S3 + IPFS, then mint(to). No collection.)',
  })
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
          return;
        }
        cb(
          new BadRequestException(
            'Image must be JPEG, PNG, or WebP. HEIC and other formats are not supported — convert or re-export and try again.',
          ) as unknown as Error,
          false,
        );
      },
    }),
  )
  mint(
    @Req() req: Request & { user: User },
    @Body() body: MintSealedBoxDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const chainId = this.chainConfig.requireChainId(chainHeader);
    return this.boxes.mintForPartner(req.user, chainId, body, file);
  }
}
