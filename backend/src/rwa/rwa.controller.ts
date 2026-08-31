import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
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
import { ListMyRedemptionsQueryDto } from './dto/list-my-redemptions-query.dto';
import { RedeemEstimateQueryDto } from './dto/redeem-estimate-query.dto';
import { RedeemEstimateBodyDto } from './dto/redeem-estimate-body.dto';
import {
  RedeemBatchCustodyDto,
  RedeemBatchRequestDto,
  RedeemRequestDto,
} from './dto/redeem-request.dto';
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
  @ApiBearerAuth()
  @ApiChainIdHeader()
  @ApiOperation({
    summary:
      'Check whether a PSA cert can be minted on this chain (no open vault cycle)',
  })
  @Get('cert-availability/:certNumber')
  @UseGuards(JwtAuthGuard)
  checkCertAvailability(
    @Param('certNumber') certNumber: string,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const chainId = this.chainConfig.requireChainId(chainHeader);
    return this.rwaService.checkCertAvailability(certNumber, chainId);
  }

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

  /** Mint RWA (owner-signed). Default custody + admin deliver; `deliveryMode=direct` for self vault. */
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
   *
   * @deprecated Prefer POST /rwa/redeem-batch (requires USDC payment).
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

  @ApiBearerAuth()
  @ApiChainIdHeader()
  @ApiOperation({
    summary:
      'Pay USDC (to PLATFORM_FEE_RECIPIENT) then redeem one or more tokens in one shipment',
  })
  @Post('redeem-batch')
  @UseGuards(JwtAuthGuard)
  redeemBatch(
    @Req() req: Request & { user: User },
    @Body() dto: RedeemBatchRequestDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const chainId = this.chainConfig.requireChainId(chainHeader);
    return this.rwaRedeem.requestRedemptionBatch(req.user, dto, chainId);
  }

  @ApiBearerAuth()
  @ApiChainIdHeader()
  @ApiOperation({
    summary:
      'Confirm user-signed NFT transfers into RWA custody for a paid redeem batch',
  })
  @Post('redeem-batch/:batchId/custody')
  @UseGuards(JwtAuthGuard)
  confirmRedeemCustody(
    @Req() req: Request & { user: User },
    @Param('batchId') batchId: string,
    @Body() dto: RedeemBatchCustodyDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const chainId = this.chainConfig.requireChainId(chainHeader);
    return this.rwaRedeem.confirmCustodyTransfers(
      req.user,
      batchId,
      dto,
      chainId,
    );
  }

  @ApiBearerAuth()
  @ApiChainIdHeader()
  @ApiOperation({
    summary:
      'Confirm physical receipt for a redeem batch (I\'ve received my cards → Done)',
  })
  @Post('redeem-batch/:batchId/confirm-received')
  @UseGuards(JwtAuthGuard)
  confirmRedeemReceived(
    @Req() req: Request & { user: User },
    @Param('batchId') batchId: string,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const chainId = this.chainConfig.requireChainId(chainHeader);
    return this.rwaRedeem.confirmReceipt(req.user, batchId, chainId);
  }

  @ApiBearerAuth()
  @ApiChainIdHeader()
  @ApiOperation({
    summary: 'RWA custody wallet address for user-signed NFT intake',
  })
  @Get('redeem/custody-wallet')
  @UseGuards(JwtAuthGuard)
  getRedeemCustodyWallet(@Headers(CHAIN_ID_HEADER) chainHeader?: string) {
    const chainId = this.chainConfig.requireChainId(chainHeader);
    return this.rwaRedeem.getCustodyWallet(chainId);
  }

  @ApiBearerAuth()
  @ApiChainIdHeader()
  @ApiOperation({
    summary: 'List redemption requests for the signed-in user (portfolio badges)',
  })
  @Get('redemptions/mine')
  @UseGuards(JwtAuthGuard)
  listMyRedemptions(
    @Req() req: Request & { user: User },
    @Query() query: ListMyRedemptionsQueryDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const chainId = this.chainConfig.requireChainId(chainHeader);
    return this.rwaRedeem.listMyRedemptions(req.user, chainId, query.tokenIds);
  }

  /**
   * PSA Vault retrieval + early-withdrawal + shipping schedule for redeem UI.
   * Pass tokenIds (+ chain header) for deposited_at-based early fees.
   * Prefer POST with shipTo when Partner FedEx Rate is enabled.
   */
  @ApiChainIdHeader()
  @ApiOperation({
    summary: 'Estimate redeem shipping + PSA vault withdraw fees',
  })
  @Get('redeem/estimate')
  estimateRedeem(
    @Query() query: RedeemEstimateQueryDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    return this.runEstimate(
      {
        country: query.country,
        cardCount: query.cardCount ?? 1,
        tokenIds: query.tokenIds
          ? query.tokenIds
              .split(',')
              .map((s) => Number(s.trim()))
              .filter((n) => n > 0)
          : undefined,
      },
      chainHeader,
    );
  }

  @ApiChainIdHeader()
  @ApiOperation({
    summary:
      'Estimate redeem fees with shipTo (required for Partner FedEx Rate)',
  })
  @Post('redeem/estimate')
  estimateRedeemPost(
    @Body() body: RedeemEstimateBodyDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    return this.runEstimate(
      {
        country: body.country,
        cardCount: body.cardCount ?? 1,
        tokenIds: body.tokenIds,
        shipTo: body.shipTo
          ? {
              name: body.shipTo.name,
              line1: body.shipTo.line1,
              line2: body.shipTo.line2,
              city: body.shipTo.city,
              region: body.shipTo.region,
              postal: body.shipTo.postal,
              phone: body.shipTo.phone,
              countryCode: body.shipTo.countryCode,
            }
          : undefined,
      },
      chainHeader,
    );
  }

  private runEstimate(
    params: {
      country: 'us' | 'ca' | 'intl';
      cardCount: number;
      tokenIds?: number[];
      shipTo?: {
        name: string;
        line1: string;
        line2?: string;
        city: string;
        region?: string;
        postal: string;
        phone: string;
        countryCode?: string;
      };
    },
    chainHeader?: string,
  ) {
    let chainId: ReturnType<ChainConfigService['requireChainId']> | undefined;
    try {
      chainId = this.chainConfig.requireChainId(chainHeader);
    } catch {
      chainId = this.chainConfig.getDefaultChainId();
    }
    return this.rwaRedeem.estimateRedeemCost({
      country: params.country,
      cardCount: params.cardCount,
      tokenIds: params.tokenIds,
      chainId,
      shipTo: params.shipTo,
    });
  }
}
