import { ConfigService } from '@nestjs/config';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import { CollectionMarketSnapshotSchedulerService } from './collection-market-snapshot-scheduler.service';

function makeScheduler(
  bulkCap: string,
  cardhedger?: Pick<CardhedgerService, 'wouldRejectDueToCircuit'>,
): CollectionMarketSnapshotSchedulerService {
  const config = {
    get: (key: string) => {
      if (key === 'MARKET_SNAPSHOT_BULK_COLD_START_CAP') return bulkCap;
      if (key === 'MARKET_SNAPSHOT_MAX_QUEUE_DEPTH') return '200';
      return undefined;
    },
  } as ConfigService;

  return new CollectionMarketSnapshotSchedulerService(
    config,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    cardhedger as CardhedgerService,
    undefined,
  );
}

describe('CollectionMarketSnapshotSchedulerService.enqueueColdStartBulk', () => {
  it('enqueues at most the configured cap per bulk call', () => {
    const svc = makeScheduler('3');
    svc.enqueueColdStartBulk([
      'aaa',
      'bbb',
      'ccc',
      'ddd',
      'eee',
    ]);
    expect(svc.getSchedulerHealth().queueDepth).toBe(3);
  });

  it('treats cap 0 as unlimited', () => {
    const svc = makeScheduler('0');
    svc.enqueueColdStartBulk(['a', 'b', 'c', 'd']);
    expect(svc.getSchedulerHealth().queueDepth).toBe(4);
  });
});

describe('CollectionMarketSnapshotSchedulerService.enqueueStaleSwrBulk', () => {
  it('enqueues at most the configured cap per bulk call', () => {
    const svc = makeScheduler('2');
    svc.enqueueStaleSwrBulk(['a', 'b', 'c', 'd']);
    expect(svc.getSchedulerHealth().queueDepth).toBe(2);
  });
});

describe('CollectionMarketSnapshotSchedulerService circuit gating', () => {
  it('skips deferrable enqueues while circuit blocks upstream', () => {
    const svc = makeScheduler('12', {
      wouldRejectDueToCircuit: () => true,
    });
    svc.enqueueColdStartBulk(['a', 'b', 'c']);
    svc.enqueue('detail-key', 'manual');
    expect(svc.getSchedulerHealth().queueDepth).toBe(1);
  });
});
