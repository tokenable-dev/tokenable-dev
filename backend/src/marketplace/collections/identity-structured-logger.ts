/**
 * P3.19 / P3.21 — Structured event logging for identity cache operations.
 *
 * CI enforces contract; runtime always emits (fallback on invalid schema).
 * Execution layer has no logging dependency.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { CardhedgerMetricsService } from '../../common/metrics/cardhedger-metrics.service';
import { IdentityLogDeduper } from './identity-log-sampler';
import {
  IdentityLogEventType,
  type IdentityLogContext,
  type IdentityLogEvent,
  type IdentityLogFallbackEvent,
  type IdentityLogLevel,
  resolveIdentityTraceId,
  validateIdentityLogEvent,
} from './identity-log-contract';
import { getIdentityTraceStore } from './identity-trace.context';

export type {
  IdentityLogContext,
  IdentityLogEvent,
  IdentityLogLevel,
} from './identity-log-contract';
export { IdentityLogEventType } from './identity-log-contract';

type DomainPayload = Omit<IdentityLogEvent, 'event' | 'traceId'> & {
  traceId?: string;
};

export interface IdentityLogEmitOptions {
  skipDedup?: boolean;
}

@Injectable()
export class IdentityStructuredLogger {
  private readonly deduper = new IdentityLogDeduper();

  constructor(
    @Optional() private readonly metrics?: CardhedgerMetricsService,
  ) {}

  logDrift(
    logger: Logger,
    level: IdentityLogLevel,
    payload: DomainPayload,
    options?: IdentityLogEmitOptions,
  ): void {
    this.emitDomain(logger, level, IdentityLogEventType.Drift, payload, options);
  }

  logRepair(
    logger: Logger,
    level: IdentityLogLevel,
    payload: DomainPayload,
    options?: IdentityLogEmitOptions,
  ): void {
    this.emitDomain(
      logger,
      level,
      IdentityLogEventType.Repair,
      payload,
      options,
    );
  }

  logReconcile(
    logger: Logger,
    level: IdentityLogLevel,
    payload: DomainPayload,
    options?: IdentityLogEmitOptions,
  ): void {
    this.emitDomain(
      logger,
      level,
      IdentityLogEventType.Reconcile,
      payload,
      options,
    );
  }

  logWrite(
    logger: Logger,
    level: IdentityLogLevel,
    payload: DomainPayload,
    options?: IdentityLogEmitOptions,
  ): void {
    this.emitDomain(
      logger,
      level,
      IdentityLogEventType.Write,
      payload,
      options,
    );
  }

  private emitDomain(
    logger: Logger,
    level: IdentityLogLevel,
    eventType: IdentityLogEventType,
    payload: DomainPayload,
    options?: IdentityLogEmitOptions,
  ): void {
    const dedupOutcome = `${eventType}:${payload.outcome}`;
    if (
      !options?.skipDedup &&
      !this.deduper.shouldEmit(payload.key, dedupOutcome)
    ) {
      return;
    }

    const traceId = resolveIdentityTraceId(
      payload.key,
      payload.traceId ?? getIdentityTraceStore()?.correlationId,
    );

    const event: IdentityLogEvent = {
      ...payload,
      event: eventType,
      traceId,
    };

    const validationError = validateIdentityLogEvent(event);
    if (validationError) {
      this.emitFallback(logger, validationError, event);
      return;
    }

    this.writeLine(logger, level, event);
  }

  private emitFallback(
    logger: Logger,
    validationError: string,
    event: IdentityLogEvent,
  ): void {
    this.metrics?.recordIdentityLogInvalid();
    const fallback: IdentityLogFallbackEvent = {
      event: IdentityLogEventType.Fallback,
      originalEvent: event.event,
      reason: 'schema_invalid',
      traceId: event.traceId,
      detail: validationError,
      key: event.key,
    };
    logger.warn(JSON.stringify(fallback));
  }

  private writeLine(
    logger: Logger,
    level: IdentityLogLevel,
    event: IdentityLogEvent,
  ): void {
    const line = JSON.stringify(event);
    switch (level) {
      case 'debug':
        logger.debug(line);
        break;
      case 'warn':
        logger.warn(line);
        break;
      default:
        logger.log(line);
    }
  }
}
