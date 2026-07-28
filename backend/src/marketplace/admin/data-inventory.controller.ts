import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { DataInventoryService } from './data-inventory.service';
import { MarketplaceAdminService } from './marketplace-admin.service';

@ApiTags('marketplace-admin')
@Controller('marketplace/admin/data-inventory')
export class DataInventoryController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly inventory: DataInventoryService,
  ) {}

  @ApiOperation({
    summary:
      '[Admin] Data inventory — accumulated PostgreSQL stores, row counts, and freshness',
  })
  @Get()
  getInventory(@Req() req: Request) {
    this.admin.assertAdminSession(req);
    return this.inventory.getInventory();
  }
}
