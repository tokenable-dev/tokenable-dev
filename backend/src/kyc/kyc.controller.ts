import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../user/entities/user.entity';
import { KycService } from './kyc.service';

@ApiTags('kyc')
@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Current user KYC status (Sumsub-backed)' })
  async status(@Req() req: Request & { user: User }) {
    return this.kyc.getStatus(req.user);
  }

  @Post('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Issue Sumsub WebSDK access token for the signed-in user',
  })
  async accessToken(@Req() req: Request & { user: User }) {
    return this.kyc.createAccessToken(req.user);
  }
}
