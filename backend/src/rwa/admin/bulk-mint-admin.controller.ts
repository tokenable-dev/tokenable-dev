import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { MarketplaceAdminService } from '../../marketplace/admin/marketplace-admin.service';
import { BulkMintJobService } from '../bulk-mint/bulk-mint-job.service';
import { CreateBulkMintJobDto } from '../dto/bulk-mint.dto';
import { BULK_MINT_MAX_ITEMS } from '../bulk-mint/bulk-mint-cert-list.util';

@ApiTags('marketplace-admin')
@ApiCookieAuth('marketplace_admin_session')
@Controller('marketplace/admin/bulk-mint')
export class BulkMintAdminController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly bulkMint: BulkMintJobService,
  ) {}

  @Get('inventory')
  @ApiOperation({
    summary: 'Partner mint+list inventory (Listed/Sold across jobs)',
  })
  @ApiQuery({ name: 'partnerId', required: true })
  async inventory(
    @Req() req: Request,
    @Query('partnerId', ParseUUIDPipe) partnerId: string,
  ) {
    this.admin.assertAdminSession(req);
    return this.bulkMint.getPartnerInventory(partnerId);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List recent partner bulk mint+list jobs' })
  @ApiQuery({ name: 'partnerId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listJobs(
    @Req() req: Request,
    @Query('partnerId') partnerId?: string,
    @Query('limit') limitRaw?: string,
  ) {
    this.admin.assertAdminSession(req);
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.bulkMint.listJobs({
      partnerId: partnerId?.trim() || undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Post('jobs')
  @ApiOperation({
    summary: `Create partner bulk mint+list job (max ${BULK_MINT_MAX_ITEMS})`,
    description:
      'Upload Excel/CSV with **certNumber + price** columns **or** JSON `{ partnerId, items:[{certNumber,price}] }`. ' +
      'Prepare (PSA + IPFS) starts asynchronously. Commit mints to the partner wallet and lists Seaport asks.',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['partnerId'],
      properties: {
        partnerId: { type: 'string', format: 'uuid' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              certNumber: { type: 'string' },
              price: { type: 'string' },
            },
          },
        },
        csvText: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async createJob(
    @Req() req: Request,
    @Body() body: CreateBulkMintJobDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.admin.assertAdminSession(req);

    let items = body.items;
    if (typeof (body as { items?: unknown }).items === 'string') {
      try {
        const parsed = JSON.parse(
          (body as unknown as { items: string }).items,
        ) as unknown;
        if (Array.isArray(parsed)) {
          items = parsed.map((row) => {
            const r = row as { certNumber?: string; price?: string };
            return {
              certNumber: String(r.certNumber ?? ''),
              price: String(r.price ?? ''),
            };
          });
        }
      } catch {
        throw new BadRequestException(
          'items must be a JSON array when sent as a string',
        );
      }
    }

    if (!items?.length && !body.csvText?.trim() && !file?.buffer?.length) {
      throw new BadRequestException(
        'Provide items[], csvText, or an Excel/CSV file upload with certNumber + price',
      );
    }

    return this.bulkMint.createJob({
      partnerId: body.partnerId,
      items,
      csvText: body.csvText,
      file: file?.buffer?.length
        ? { buffer: file.buffer, originalname: file.originalname || 'upload.csv' }
        : undefined,
    });
  }

  @Get('jobs/:id')
  @ApiOperation({
    summary: 'Get bulk mint+list job + per-cert status (incl. Listed/Sold)',
  })
  async getJob(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    this.admin.assertAdminSession(req);
    return this.bulkMint.getJobOrThrow(id);
  }

  @Post('jobs/:id/prepare')
  @ApiOperation({
    summary: 'Re-run prepare for pending / prepare_failed items',
  })
  async prepare(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    this.admin.assertAdminSession(req);
    return this.bulkMint.startPrepare(id);
  }

  @Post('jobs/:id/commit')
  @ApiOperation({
    summary: 'Approve once — mintBatch to partner wallet, then Seaport list',
    description:
      'On-chain mint TX count = ceil(readyCount / 50). Then server signs asks with the entrusted partner key. Partial failures leave remaining items for retry.',
  })
  async commit(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    this.admin.assertAdminSession(req);
    return this.bulkMint.commit(id);
  }

  @Post('jobs/:jobId/items/:itemId/cancel-listing')
  @ApiOperation({
    summary: 'Cancel active Seaport ask for a job item (partner offerer)',
    description:
      'Marks the order cancelled and sets the item to list_failed so commit can re-list.',
  })
  async cancelListing(
    @Req() req: Request,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    this.admin.assertAdminSession(req);
    return this.bulkMint.cancelItemListing(jobId, itemId);
  }
}
