/**
 * P3.11 / P3.13 — In-memory simulation + deterministic replay utilities.
 */

import { IdentityCacheDecisionEngine } from '../identity-cache-decision.engine';
import type {
  CacheExecutionCommand,
  CacheExecutionResult,
} from '../identity-cache-execution.types';
import type {
  IdentityCacheDecision,
  IdentityConsistencyContext,
} from '../identity-cache-consistency.types';
import { IDENTITY_CACHE_TTL_MS } from '../identity-cache-consistency.types';
import type { IdentityCacheProvider } from '../identity-cache.provider';

// ---------------------------------------------------------------------------
// Simulated DB (P3.1 / P3.3 write + audit clear semantics)
// ---------------------------------------------------------------------------

export class SimulatedIdentityDb {
  private readonly rows = new Map<string, string>();
  private readonly locks = new Map<string, Promise<void>>();

  getCardId(key: string): string {
    return this.rows.get(key.toLowerCase()) ?? '';
  }

  setCardId(key: string, cardId: string): void {
    this.rows.set(key.toLowerCase(), cardId);
  }

  persistIdIfEmpty(key: string, cardId: string): boolean {
    const k = key.toLowerCase();
    if (this.getCardId(k)) return false;
    this.rows.set(k, cardId);
    return true;
  }

  clearIfUnchanged(key: string, expectedCardId: string): boolean {
    const k = key.toLowerCase();
    const current = this.getCardId(k);
    if (current !== expectedCardId) return false;
    this.rows.delete(k);
    return true;
  }

  async withKeyLock<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
    const k = key.toLowerCase();
    const prev = this.locks.get(k) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    this.locks.set(k, prev.then(() => gate));
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(k) === gate) this.locks.delete(k);
    }
  }
}

// ---------------------------------------------------------------------------
// Controllable layered cache (L1 / L2 split-brain + Redis failure injection)
// ---------------------------------------------------------------------------

export class SimulatedLayeredCache implements IdentityCacheProvider {
  readonly l1 = new Map<string, string>();
  readonly l2 = new Map<string, string>();

  l2Connected = true;
  l2ReadFails = false;
  l2WriteFails = false;

  async get(key: string): Promise<string | null> {
    const k = key.toLowerCase();
    if (this.l2Connected && !this.l2ReadFails && this.l2.has(k)) {
      const v = this.l2.get(k)!;
      this.l1.set(k, v);
      return v;
    }
    if (this.l2Connected) {
      this.l1.delete(k);
      return null;
    }
    return this.l1.get(k) ?? null;
  }

  async set(key: string, value: string | null, _ttlMs: number): Promise<void> {
    const k = key.toLowerCase();
    if (!this.l2Connected || this.l2WriteFails) {
      if (!this.l2Connected) {
        this.l1.set(k, value ?? '');
      }
      return;
    }
    if (value == null) {
      this.l2.delete(k);
    } else {
      this.l2.set(k, value);
    }
    this.l1.set(k, value ?? '');
  }

  async exists(key: string): Promise<boolean> {
    const k = key.toLowerCase();
    if (this.l2Connected && !this.l2ReadFails) {
      if (this.l2.has(k)) return true;
      this.l1.delete(k);
      return false;
    }
    return this.l1.has(k);
  }

  async delete(key: string): Promise<void> {
    const k = key.toLowerCase();
    this.l1.delete(k);
    if (this.l2Connected && !this.l2WriteFails) {
      this.l2.delete(k);
    }
  }

  probeL2MissL1Hit(key: string): string | null {
    const k = key.toLowerCase();
    if (!this.l2Connected || this.l2ReadFails) return null;
    if (this.l2.has(k)) return null;
    return this.l1.get(k) ?? null;
  }
}

// ---------------------------------------------------------------------------
// Pure IO executor (mirrors IdentityCacheExecutionService.execute)
// ---------------------------------------------------------------------------

export class SimulatedCacheExecutor {
  private readonly cooldownUntil = new Map<string, number>();
  private readonly cooldownMs: number;
  stallMs = 0;

  constructor(
    private readonly cache: SimulatedLayeredCache,
    cooldownMs = 10_000,
  ) {
    this.cooldownMs = cooldownMs;
  }

  async execute(command: CacheExecutionCommand): Promise<CacheExecutionResult> {
    const k = command.key.toLowerCase();
    if (command.op === 'noop') {
      return { applied: false, skippedCooldown: false };
    }
    if (!command.bypassCooldown && this.isCooldown(k)) {
      return { applied: false, skippedCooldown: true };
    }
    if (!command.bypassCooldown) {
      this.cooldownUntil.set(k, Date.now() + this.cooldownMs);
    }

    if (this.stallMs > 0) {
      await sleep(this.stallMs);
    }

    switch (command.op) {
      case 'set':
        if (command.value) {
          await this.cache.set(k, command.value, command.ttlMs ?? IDENTITY_CACHE_TTL_MS);
        }
        break;
      case 'delete':
        await this.cache.delete(k);
        break;
      case 'replace':
        await this.cache.delete(k);
        if (command.value) {
          await this.cache.set(k, command.value, command.ttlMs ?? IDENTITY_CACHE_TTL_MS);
        }
        break;
    }
    return { applied: true, skippedCooldown: false };
  }

  private isCooldown(key: string): boolean {
    const until = this.cooldownUntil.get(key);
    return until != null && Date.now() < until;
  }
}

// ---------------------------------------------------------------------------
// Scenario runner — decision → command → execution (P3.12 flow)
// ---------------------------------------------------------------------------

export class IdentityScenarioRunner {
  readonly decision = new IdentityCacheDecisionEngine();
  readonly db = new SimulatedIdentityDb();
  readonly cache = new SimulatedLayeredCache();
  readonly executor = new SimulatedCacheExecutor(this.cache);
  /** P3.16 — stale replica read overlay (decision input only). */
  readonly replicationLag = new Map<string, string>();

  async evaluateAndRepair(
    key: string,
    context: IdentityConsistencyContext,
    overrides?: {
      cacheExists?: boolean;
      cachedValue?: string | null;
      dbValue?: string;
    },
  ): Promise<{
    decision: IdentityCacheDecision;
    returnValue: string | null;
    repaired: boolean;
  }> {
    const k = key.toLowerCase();
    const dbValue =
      overrides?.dbValue ??
      this.replicationLag.get(k) ??
      this.db.getCardId(k);

    let cacheExists = overrides?.cacheExists;
    let cachedValue = overrides?.cachedValue;
    if (cacheExists === undefined) {
      cacheExists = await this.cache.exists(k);
      if (cachedValue === undefined && cacheExists) {
        cachedValue = await this.cache.get(k);
      }
    } else if (cachedValue === undefined && cacheExists) {
      cachedValue = await this.cache.get(k);
    }

    const decision = this.decision.decide({
      cacheExists: cacheExists ?? false,
      cachedValue: cachedValue ?? null,
      dbValue,
    });

    const bypass = this.decision.shouldBypassRepairCooldown(context);
    const command = this.decision.buildExecutionCommand(
      k,
      decision.action,
      dbValue,
      bypass,
    );
    const executeResult = await this.executor.execute(command);

    const returnValue = this.decision.resolveReturnValue(
      decision.driftKind,
      dbValue,
      cachedValue ?? null,
      executeResult.applied,
      context,
    );

    return {
      decision,
      returnValue,
      repaired: executeResult.applied,
    };
  }

  async reconcileKey(
    key: string,
    allowRepair: () => boolean,
  ): Promise<'hit' | 'miss' | 'repair' | 'skipped'> {
    const k = key.toLowerCase();
    const dbValue = this.db.getCardId(k);
    const cacheExists = await this.cache.exists(k);
    const cachedValue = cacheExists ? await this.cache.get(k) : null;
    const decision = this.decision.decide({
      cacheExists,
      cachedValue,
      dbValue,
    });
    const command = this.decision.buildExecutionCommand(
      k,
      decision.action,
      dbValue,
      false,
    );
    const repairAllowed = allowRepair();
    const executeResult =
      !this.decision.isExecutable(command) || !repairAllowed
        ? { applied: false, skippedCooldown: false }
        : await this.executor.execute(command);
    return this.decision.reconciliationOutcome(
      decision,
      {
        repaired: executeResult.applied,
        skippedCooldown: executeResult.skippedCooldown,
      },
      repairAllowed,
    );
  }

  async applyPostCommitCache(
    key: string,
    hint: string | null | undefined,
  ): Promise<void> {
    const k = key.toLowerCase();
    if (hint === undefined) return;
    if (hint === null) {
      await this.cache.delete(k);
      return;
    }
    if (await this.cache.exists(k)) {
      const cached = await this.cache.get(k);
      if (cached === hint) return;
    }
    await this.cache.set(k, hint, IDENTITY_CACHE_TTL_MS);
  }
}

// ---------------------------------------------------------------------------
// P3.13 — Deterministic PRNG
// ---------------------------------------------------------------------------

export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function pickSeeded<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
