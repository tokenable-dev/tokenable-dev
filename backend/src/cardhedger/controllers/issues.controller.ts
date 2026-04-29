import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CardhedgerService } from '../cardhedger.service';

@ApiTags('Card Hedge · Card Issues')
@Controller('cardhedger/v1/cards')
export class CardhedgerIssuesController {
  constructor(private readonly cardhedger: CardhedgerService) {}

  @Get('issues')
  @ApiOperation({
    summary: 'List your card issues',
    description: 'Upstream: `GET /v1/cards/issues`.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'e.g. new, in_progress, resolved',
  })
  async listIssues(@Query('status') status?: string): Promise<unknown> {
    this.cardhedger.assertConfigured();
    const query: Record<string, string | undefined> = {};
    if (status !== undefined && status !== '') query.status = status;
    return this.cardhedger.forwardJson('GET', '/v1/cards/issues', { query });
  }

  @Post('issues')
  @ApiOperation({
    summary: 'Submit a card data issue',
    description: 'Upstream: `POST /v1/cards/issues`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async submitIssue(@Body() body: Record<string, unknown>): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/issues', {
      body,
    });
  }

  @Get('issues/:issue_id')
  @ApiOperation({
    summary: 'Get issue by ID',
    description: 'Upstream: `GET /v1/cards/issues/{issue_id}`.',
  })
  @ApiParam({ name: 'issue_id', type: Number })
  async getIssue(@Param('issue_id') issueId: string): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson(
      'GET',
      `/v1/cards/issues/${encodeURIComponent(issueId)}`,
      {},
    );
  }
}
