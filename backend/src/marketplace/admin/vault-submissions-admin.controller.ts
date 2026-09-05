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
import { PsaReceivedMailService } from '../../vault/psa-received-mail.service';
import {
  AdminInjectPsaReceivedMailDto,
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
    private readonly psaMail: PsaReceivedMailService,
  ) {}

  @Get('counts')
  @ApiOperation({ summary: 'Pipeline status counts for ops dashboard' })
  counts(@Req() req: Request) {
    this.admin.assertAdminSession(req);
    return this.submissions.adminCounts();
  }

  @Get('arrival-reviews')
  @ApiOperation({
    summary: 'PSA Items Received mail queue (pending admin confirm → PSA)',
  })
  listArrivalReviews(
    @Req() req: Request,
    @Query('status') status?: string,
  ) {
    this.admin.assertAdminSession(req);
    const st =
      status === 'pending' || status === 'confirmed' || status === 'dismissed'
        ? status
        : 'pending';
    return this.submissions.listPsaArrivalReviews(st);
  }

  @Get('mint-queue')
  @ApiOperation({
    summary:
      'PSA reviewing / approved cards ready for admin mint + deliver to user',
  })
  listMintQueue(@Req() req: Request, @Query('q') q?: string) {
    this.admin.assertAdminSession(req);
    return this.submissions.listAdminMintQueue({ q });
  }

  @Get('vaulted-reviews')
  @ApiOperation({
    summary: 'PSA Items Vaulted (secured) mail audit queue',
  })
  listVaultedReviews(@Req() req: Request, @Query('status') status?: string) {
    this.admin.assertAdminSession(req);
    const st =
      status === 'pending' ||
      status === 'minted' ||
      status === 'failed' ||
      status === 'dismissed'
        ? status
        : 'pending';
    return this.submissions.listPsaVaultedReviews(st);
  }

  @Post('vaulted-reviews/:reviewId/dismiss')
  @ApiOperation({ summary: 'Dismiss a vaulted mail review without minting' })
  dismissVaultedReview(
    @Req() req: Request,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    this.admin.assertAdminSession(req);
    return this.submissions.dismissPsaVaultedReview(reviewId);
  }

  @Post('arrival-reviews/test-inject')
  @ApiOperation({
    summary:
      'TEST: inject Items Received Gmail + poll once (PSA_RECEIVED_MAIL_TEST_INJECT=1)',
  })
  async testInjectArrivalMail(
    @Req() req: Request,
    @Body() dto: AdminInjectPsaReceivedMailDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.psaMail.injectTestItemsReceivedAndPoll({
      cert: dto.cert,
      cardLabel: dto.cardLabel,
    });
  }

  @Post('arrival-reviews/:reviewId/confirm')
  @ApiOperation({
    summary: 'Confirm mail match and mark linked packages arrived at PSA',
  })
  confirmArrivalReview(
    @Req() req: Request,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    this.admin.assertAdminSession(req);
    return this.submissions.confirmPsaArrivalReview(reviewId);
  }

  @Post('arrival-reviews/:reviewId/dismiss')
  @ApiOperation({ summary: 'Dismiss a PSA arrival mail review without marking arrived' })
  dismissArrivalReview(
    @Req() req: Request,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    this.admin.assertAdminSession(req);
    return this.submissions.dismissPsaArrivalReview(reviewId);
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
