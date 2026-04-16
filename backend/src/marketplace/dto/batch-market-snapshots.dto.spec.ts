import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BatchMarketSnapshotsDto } from './batch-market-snapshots.dto';

describe('BatchMarketSnapshotsDto', () => {
  it('accepts up to 40 collection keys', async () => {
    const keys = Array.from({ length: 40 }, (_, i) => `key-${i}`);
    const dto = plainToInstance(BatchMarketSnapshotsDto, {
      collectionKeys: keys,
      priceHistoryDuration: '30d',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects more than 40 collection keys', async () => {
    const keys = Array.from({ length: 41 }, (_, i) => `key-${i}`);
    const dto = plainToInstance(BatchMarketSnapshotsDto, {
      collectionKeys: keys,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const keyErr = errors.find((e) => e.property === 'collectionKeys');
    expect(keyErr).toBeDefined();
  });
});
