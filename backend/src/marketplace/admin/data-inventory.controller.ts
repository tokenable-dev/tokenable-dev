import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { DataInventoryService } from './data-inventory.service';
import { AdminDataInventoryResetDto } from './dto/admin-data-inventory-reset.dto';
import {
  AdminDataInventoryRowsQueryDto,
} from './dto/admin-data-inventory-rows.dto';
import { MarketplaceAdminService } from './marketplace-admin.service';

@ApiTags('marketplace-admin')
@ApiCookieAuth('marketplace_admin_session')
@Controller('marketplace/admin/data-inventory')
export class DataInventoryController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly inventory: DataInventoryService,
  ) {}

  @ApiOperation({
    summary:
      '[Admin] Data inventory — all public tables, row counts, catalog metadata',
  })
  @Get()
  getInventory(@Req() req: Request) {
    this.admin.assertAdminSession(req);
    return this.inventory.getInventory();
  }

  @Get('schema')
  @ApiOperation({
    summary:
      '[Admin] Live public schema — columns, PK/UK/FK, plus logical marketplace joins',
  })
  getSchema(@Req() req: Request) {
    this.admin.assertAdminSession(req);
    return this.inventory.getSchema();
  }

  @Get('tables/:table/rows')
  @ApiOperation({
    summary:
      '[Admin] Paginated raw rows for a public table (sensitive columns redacted)',
  })
  getTableRows(
    @Req() req: Request,
    @Param('table') table: string,
    @Query() query: AdminDataInventoryRowsQueryDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.inventory.getTableRows(
      table,
      query.page ?? 1,
      query.pageSize ?? 50,
    );
  }

  @Post('reset-for-new-contract')
  @ApiOperation({
    summary:
      '[Dev/staging only] Wipe marketplace + vault DB rows after redeploying RWA (keeps users/admins/partners)',
  })
  resetForNewContract(
    @Req() req: Request,
    @Body() body: AdminDataInventoryResetDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.inventory.resetForNewContract(body.password);
  }
}
