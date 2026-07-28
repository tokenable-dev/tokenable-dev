import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
  listMine(@Req() req: Request & { user: User }) {
    return this.submissions.listForUser(req.user.id);
  }

  @Get(':idOrPublicId')
  @ApiOperation({ summary: 'Get one submission (uuid or SUB-… public id)' })
  getOne(
    @Req() req: Request & { user: User },
    @Param('idOrPublicId') idOrPublicId: string,
  ) {
    return this.submissions.getForUser(req.user.id, idOrPublicId);
  }

  @Post('draft')
  @ApiOperation({ summary: 'Create or update draft cards for sell flow' })
  upsertDraft(
    @Req() req: Request & { user: User },
    @Body() dto: UpsertVaultSubmissionDraftDto,
  ) {
    return this.submissions.upsertDraft(req.user.id, dto);
  }

  @Post(':idOrPublicId/packing-slip')
  @ApiOperation({ summary: 'Mark packing slip downloaded' })
  packingSlip(
    @Req() req: Request & { user: User },
    @Param('idOrPublicId') idOrPublicId: string,
  ) {
    return this.submissions.markPackingSlipDownloaded(req.user.id, idOrPublicId);
  }

  @Post(':idOrPublicId/tracking')
  @ApiOperation({ summary: 'Register carrier tracking → in_transit' })
  tracking(
    @Req() req: Request & { user: User },
    @Param('idOrPublicId') idOrPublicId: string,
    @Body() dto: RegisterVaultShipmentDto,
  ) {
    return this.submissions.registerTracking(req.user.id, idOrPublicId, dto);
  }

  @Patch(':idOrPublicId/draft')
  @ApiOperation({ summary: 'Alias of POST /draft with publicId pinned' })
  patchDraft(
    @Req() req: Request & { user: User },
    @Param('idOrPublicId') idOrPublicId: string,
    @Body() dto: UpsertVaultSubmissionDraftDto,
  ) {
    return this.submissions.upsertDraft(req.user.id, {
      ...dto,
      publicId: idOrPublicId,
    });
  }
}
