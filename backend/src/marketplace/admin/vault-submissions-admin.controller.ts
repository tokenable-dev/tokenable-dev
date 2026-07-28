import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { VaultSubmissionService } from '../../vault/vault-submission.service';
import {
  AdminUpdateItemStatusDto,
  AdminUpdateSubmissionStatusDto,
} from '../../vault/dto/admin-vault-submission.dto';
import { MarketplaceAdminService } from './marketplace-admin.service';

@ApiTags('marketplace-admin-vault-submissions')
@Controller('marketplace/admin/vault-submissions')
export class VaultSubmissionsAdminController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly submissions: VaultSubmissionService,
  ) {}

  @Get('counts')
  @ApiOperation({ summary: 'Pipeline status counts for ops dashboard' })
  counts(@Req() req: Request) {
    this.admin.assertAdminSession(req);
    return this.submissions.adminCounts();
  }

  @Get()
  @ApiOperation({ summary: 'List all vault sell-flow submissions' })
  list(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    this.admin.assertAdminSession(req);
    return this.submissions.adminList({ status, q });
  }

  @Get(':idOrPublicId')
  @ApiOperation({ summary: 'Submission detail for ops' })
  get(@Req() req: Request, @Param('idOrPublicId') idOrPublicId: string) {
    this.admin.assertAdminSession(req);
    return this.submissions.adminGet(idOrPublicId);
  }

  @Post(':idOrPublicId/arrived')
  @ApiOperation({ summary: 'Mark package arrived at PSA → reviewing' })
  arrived(@Req() req: Request, @Param('idOrPublicId') idOrPublicId: string) {
    this.admin.assertAdminSession(req);
    return this.submissions.adminMarkArrived(idOrPublicId);
  }

  @Patch(':idOrPublicId/status')
  @ApiOperation({ summary: 'Set package-level status' })
  setStatus(
    @Req() req: Request,
    @Param('idOrPublicId') idOrPublicId: string,
    @Body() dto: AdminUpdateSubmissionStatusDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.submissions.adminSetSubmissionStatus(idOrPublicId, dto.status);
  }

  @Patch(':idOrPublicId/items/:itemId')
  @ApiOperation({ summary: 'Set per-card status (approve / reject / …)' })
  setItemStatus(
    @Req() req: Request,
    @Param('idOrPublicId') idOrPublicId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: AdminUpdateItemStatusDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.submissions.adminSetItemStatus(
      idOrPublicId,
      itemId,
      dto.status,
      dto.rejectionReason,
    );
  }
}
