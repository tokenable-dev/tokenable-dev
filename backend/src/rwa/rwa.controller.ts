import {
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../user/entities/user.entity';
import { SWAGGER_BODY_EXAMPLES } from '../swagger/examples';
import { ApiChainIdHeader } from '../swagger/api-headers.util';
import {
  CHAIN_ID_HEADER,
  ChainConfigService,
} from '../blockchain/chain-config.service';
import { UploadRwaDto } from './dto/upload-rwa.dto';
import { MintRwaDto } from './dto/mint-rwa.dto';
import { RedeemRequestDto } from './dto/redeem-request.dto';
import { UploadRwaResult } from './interfaces/rwa-metadata.interface';
import { RwaMintService } from './rwa-mint.service';
import { RwaRedeemService } from './rwa-redeem.service';
import { RwaService } from './rwa.service';

/**
 * RWA 민트용 메타데이터 — IPFS 업로드 + owner-signed on-chain mint.
 * `POST /api/rwa/upload` · `POST /api/rwa/mint`
 */
@ApiTags('rwa')
@Controller('rwa')
export class RwaController {
  constructor(
    private readonly rwaService: RwaService,
    private readonly rwaMint: RwaMintService,
    private readonly rwaRedeem: RwaRedeemService,
    private readonly chainConfig: ChainConfigService,
  ) {}

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
  @ApiChainIdHeader()
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
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ): Promise<UploadRwaResult> {
    // requireChainId: vault availability is per-chain — silent DEFAULT_CHAIN_ID
    // fallback would reject a Polygon mint because of a live Sepolia cycle.
    const chainId = this.chainConfig.requireChainId(chainHeader);
    return this.rwaService.uploadToIpfs(dto, chainId, file);
  }

  /** Platform owner wallet mints RWA to custody; admin delivers to user's linked wallet. */
  @ApiBearerAuth()
  @ApiChainIdHeader()
  @ApiOperation({
    summary: 'RWA on-chain mint (owner-signed, backend relayer)',
  })
  @Post('mint')
  @UseGuards(JwtAuthGuard)
  mint(
    @Req() req: Request & { user: User },
    @Body() dto: MintRwaDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const chainId = this.chainConfig.requireChainId(chainHeader);
    return this.rwaMint.mintForUser(req.user, dto, chainId);
  }

  /**
   * User-initiated "Redeem Request" — verifies the caller currently owns the
   * NFT (via a linked wallet), then records the request. Actual burn +
   * physical vault release are executed by ops once redemption is confirmed
   * (see POST /marketplace/admin/rwa-tokens/:tokenId/burn).
   */
  @ApiBearerAuth()
  @ApiChainIdHeader()
  @ApiOperation({
    summary: 'Request redemption of an RWA NFT for its physical asset',
  })
  @Post('redeem-request')
  @UseGuards(JwtAuthGuard)
  redeemRequest(
    @Req() req: Request & { user: User },
    @Body() dto: RedeemRequestDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const chainId = this.chainConfig.requireChainId(chainHeader);
    return this.rwaRedeem.requestRedemption(req.user, dto, chainId);
  }
}
