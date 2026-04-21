import { ApiProperty } from '@nestjs/swagger';

export class MatchAcceptedResponseDto {
  @ApiProperty()
  executionId!: string;

  @ApiProperty()
  matchIntentId!: string;

  @ApiProperty({ enum: ['pending'] })
  executionState!: 'pending';

  @ApiProperty({ description: 'Relative URL for polling (includes /api prefix)' })
  pollUrl!: string;
}
