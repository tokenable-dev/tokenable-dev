import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEvent } from '../entities/outbox-event.entity';

const POLL_MS = Number(process.env.OUTBOX_PUBLISHER_POLL_MS ?? 1500);
const BATCH = Number(process.env.OUTBOX_PUBLISHER_BATCH ?? 50);

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
  ) {}

  onModuleInit(): void {
    if (process.env.OUTBOX_PUBLISHER_ENABLED === 'false') {
      this.logger.warn('Outbox publisher disabled (OUTBOX_PUBLISHER_ENABLED=false)');
      return;
    }
    this.timer = setInterval(() => {
      void this.flushBatch();
    }, POLL_MS);
    void this.flushBatch();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Marks rows published after a simulated Kafka send (replace with real producer).
   */
  async flushBatch(): Promise<void> {
    const rows = await this.outboxRepo.find({
      where: { published: false },
      order: { createdAt: 'ASC' },
      take: BATCH,
    });
    for (const row of rows) {
      this.logger.debug(
        `[outbox] ${row.eventType} aggregate=${row.aggregateType}:${row.aggregateId}`,
      );
      await this.outboxRepo.update({ id: row.id }, { published: true });
    }
  }
}
