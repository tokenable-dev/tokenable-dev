import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  CHAIN_ID_HEADER,
  ChainConfigService,
} from '../../blockchain/chain-config.service';
import { ApiChainIdHeader } from '../../swagger/api-headers.util';
import type { User } from '../../user/entities/user.entity';
import { CreatePartnerVaultMintJobDto } from '../dto/create-partner-vault-mint-job.dto';
import { PartnerVaultMintJobService } from './partner-vault-mint-job.service';

@ApiTags('marketplace')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('marketplace/partners/me/vault-mint-jobs')
export class PartnerVaultMintController {
  constructor(
    private readonly jobs: PartnerVaultMintJobService,
    private readonly chainConfig: ChainConfigService,
  ) {}

  @Post()
  @ApiChainIdHeader()
  @ApiOperation({
    summary:
      'Start partner self-vault bulk mint (runs on server — safe to leave the page)',
  })
  async create(
    @Req() req: Request & { user: User },
    @Body() body: CreatePartnerVaultMintJobDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const chainId = this.chainConfig.requireChainId(chainHeader);
    return this.jobs.createJob(req.user, chainId, body);
  }

  @Get(':jobId')
  @ApiOperation({ summary: 'Poll partner vault mint job progress' })
  async get(
    @Req() req: Request & { user: User },
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    return this.jobs.getJobForUser(req.user.id, jobId);
  }
}
