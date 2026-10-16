import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CHAIN_ID_HEADER } from '../blockchain/chain-config.service';
import type { User } from '../user/entities/user.entity';
import {
  RegisterVaultShipmentDto,
  UpsertVaultSubmissionDraftDto,
} from './dto/vault-submission.dto';
import { VaultSubmissionService } from './vault-submission.service';

@ApiTags('vault-submissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vault/submissions')
export class VaultSubmissionsController {
  constructor(private readonly submissions: VaultSubmissionService) {}

  @Get()
  @ApiOperation({ summary: 'List my vault sell-flow submissions' })
  listMine(
    @Req() req: Request & { user: User },
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    return this.submissions.listForUser(req.user.id, chainHeader);
  }

  // Static paths before `:idOrPublicId` so `draft` is never treated as a public id.
  @Post('draft')
  @ApiOperation({
    summary:
      'Upsert shipping package (confirmed cards → awaiting_shipment). Add-cards is local-only.',
  })
  upsertDraft(
    @Req() req: Request & { user: User },
    @Body() dto: UpsertVaultSubmissionDraftDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    return this.submissions.upsertDraft(req.user.id, dto, chainHeader);
  }

  @Post(':idOrPublicId/packing-slip')
  @ApiOperation({ summary: 'Mark packing slip downloaded' })
  packingSlip(
    @Req() req: Request & { user: User },
    @Param('idOrPublicId') idOrPublicId: string,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    return this.submissions.markPackingSlipDownloaded(
      req.user.id,
      idOrPublicId,
      chainHeader,
    );
  }

  @Post(':idOrPublicId/tracking')
  @ApiOperation({ summary: 'Register carrier tracking → in_transit' })
  tracking(
    @Req() req: Request & { user: User },
    @Param('idOrPublicId') idOrPublicId: string,
    @Body() dto: RegisterVaultShipmentDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    return this.submissions.registerTracking(
      req.user.id,
      idOrPublicId,
      dto,
      chainHeader,
    );
  }

  @Patch(':idOrPublicId/draft')
  @ApiOperation({
    summary: 'Alias of POST /draft with publicId pinned (ship-stage package upsert)',
  })
  patchDraft(
    @Req() req: Request & { user: User },
    @Param('idOrPublicId') idOrPublicId: string,
    @Body() dto: UpsertVaultSubmissionDraftDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    return this.submissions.upsertDraft(
      req.user.id,
      {
        ...dto,
        publicId: idOrPublicId,
      },
      chainHeader,
    );
  }

  @Get(':idOrPublicId')
  @ApiOperation({ summary: 'Get one submission (uuid or SUB-… public id)' })
  getOne(
    @Req() req: Request & { user: User },
    @Param('idOrPublicId') idOrPublicId: string,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    return this.submissions.getForUser(req.user.id, idOrPublicId, chainHeader);
  }
}
