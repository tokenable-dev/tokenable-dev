import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from './entities/user.entity';
import {
  CreateShippingAddressDto,
  UpdateShippingAddressDto,
} from './dto/shipping-address.dto';
import { UserService } from './user.service';

@ApiTags('user-settings')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('user/shipping-addresses')
export class UserShippingAddressesController {
  constructor(private readonly users: UserService) {}

  @Get()
  @ApiOperation({ summary: 'List saved shipping addresses' })
  async list(@Req() req: Request & { user: User }) {
    const rows = await this.users.listShippingAddresses(req.user.id);
    return { addresses: rows.map((r) => this.users.serializeShippingAddress(r)) };
  }

  @Post()
  @ApiOperation({ summary: 'Add a shipping address' })
  async create(
    @Req() req: Request & { user: User },
    @Body() dto: CreateShippingAddressDto,
  ) {
    const row = await this.users.createShippingAddress(req.user.id, dto);
    return this.users.serializeShippingAddress(row);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a shipping address' })
  async update(
    @Req() req: Request & { user: User },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShippingAddressDto,
  ) {
    const row = await this.users.updateShippingAddress(req.user.id, id, dto);
    return this.users.serializeShippingAddress(row);
  }

  @Post(':id/default')
  @HttpCode(200)
  @ApiOperation({ summary: 'Set shipping address as default' })
  @ApiOkResponse({ description: 'Updated address' })
  async setDefault(
    @Req() req: Request & { user: User },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const row = await this.users.setDefaultShippingAddress(req.user.id, id);
    return this.users.serializeShippingAddress(row);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a shipping address' })
  async remove(
    @Req() req: Request & { user: User },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.users.deleteShippingAddress(req.user.id, id);
  }
}
