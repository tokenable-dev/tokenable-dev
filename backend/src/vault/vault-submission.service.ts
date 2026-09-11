import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, LessThan, Repository } from 'typeorm';
import { NotificationsService } from '../marketplace/notifications/notifications.service';
import {
  RegisterVaultShipmentDto,
  UpsertVaultSubmissionDraftDto,
  VaultSubmissionCardDto,
} from './dto/vault-submission.dto';
import { VaultSubmissionItem } from './entities/vault-submission-item.entity';
import {
  VaultSubmission,
  VaultSubmissionStatus,
} from './entities/vault-submission.entity';
import {
  VaultPsaArrivalReview,
  type VaultPsaArrivalReviewStatus,
} from './entities/vault-psa-arrival-review.entity';
import {
  VaultPsaVaultedReview,
  type VaultPsaVaultedReviewStatus,
} from './entities/vault-psa-vaulted-review.entity';

export type VaultSubmissionScenario = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export type OpenPackageByCertMatch = {
  matchedCerts: string[];
  unmatchedCerts: string[];
  packages: Array<{
    id: string;
    publicId: string;
    userId: string;
    status: string;
    certs: string[];
  }>;
};

@Injectable()
export class VaultSubmissionService {
  private readonly logger = new Logger(VaultSubmissionService.name);

  constructor(
    @InjectRepository(VaultSubmission)
    private readonly submissions: Repository<VaultSubmission>,
    @InjectRepository(VaultSubmissionItem)
    private readonly items: Repository<VaultSubmissionItem>,
    @InjectRepository(VaultPsaArrivalReview)
    private readonly arrivalReviews: Repository<VaultPsaArrivalReview>,
    @InjectRepository(VaultPsaVaultedReview)
    private readonly vaultedReviews: Repository<VaultPsaVaultedReview>,
    private readonly notifications: NotificationsService,
  ) {}

  private static normalizeCert(cert: string): string {
    return cert.trim().toUpperCase();
  }

  /**
   * After PSA vault ship tracking is registered, the physical card is in
   * transit / at PSA — self-vault (`deliveryMode=direct`) must not mint it.
   */
  static readonly SELF_VAULT_BLOCKED_ITEM_STATUSES = [
    'in_transit',
    'reviewing',
    'approved',
    'minting',
  ] as const;

  static readonly SELF_VAULT_BLOCKED_SUBMISSION_STATUSES = [
    'in_transit',
    'psa_reviewing',
  ] as const;

  static isBlockedForSelfVault(params: {
    submissionStatus: VaultSubmissionStatus | string;
    itemStatus: VaultSubmissionItem['status'] | string;
  }): boolean {
    const item = String(params.itemStatus);
    if (item === 'rejected' || item === 'failed' || item === 'completed') {
      return false;
    }
    if (
      (
        VaultSubmissionService.SELF_VAULT_BLOCKED_ITEM_STATUSES as readonly string[]
      ).includes(item)
    ) {
      return true;
    }
    return (
      VaultSubmissionService.SELF_VAULT_BLOCKED_SUBMISSION_STATUSES as readonly string[]
    ).includes(String(params.submissionStatus));
  }

  /**
   * Throws when this cert is already on a non-cancelled PSA shipment that has
   * finished the ship step (tracking registered) or is further along at PSA.
   * Global across users — the physical slab cannot be in two vault paths.
   */
  async assertCertAvailableForSelfVault(certNumber: string): Promise<void> {
    const cert = VaultSubmissionService.normalizeCert(certNumber);
    if (!cert) {
      throw new BadRequestException('certNumber is required');
    }

    const rows = await this.items
      .createQueryBuilder('i')
      .innerJoin('i.submission', 's')
      .select('i.status', 'itemStatus')
      .addSelect('s.status', 'submissionStatus')
      .addSelect('s.public_id', 'publicId')
      .where('i.cert_number = :cert', { cert })
      .andWhere("s.status <> 'cancelled'")
      .getRawMany<{
        itemStatus: string;
        submissionStatus: string;
        publicId: string;
      }>();

    const hit = rows.find((r) =>
      VaultSubmissionService.isBlockedForSelfVault({
        submissionStatus: r.submissionStatus,
        itemStatus: r.itemStatus,
      }),
    );
    if (!hit) return;

    throw new BadRequestException(
      `PSA cert #${cert} is already in PSA vault shipment ${hit.publicId} ` +
        `(${hit.submissionStatus}/${hit.itemStatus}). Self vault mint is not ` +
        `allowed while the card is in transit or at PSA.`,
    );
  }

  /**
   * `SUB-YYYYMMDD-#####` — date stamp + per-day sequence (00001, 00002, …).
   * Must run inside a transaction; uses a day-scoped advisory lock for concurrency.
   */
  async nextDailyPublicId(
    em: EntityManager,
    now = new Date(),
  ): Promise<string> {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const prefix = `SUB-${y}${m}${day}-`;
    const dayKey = Number(`${y}${m}${day}`);
    if (!Number.isFinite(dayKey)) {
      throw new InternalServerErrorException('Invalid submission date key');
    }

    // Serialize creates for this calendar day across concurrent transactions.
    await em.query('SELECT pg_advisory_xact_lock($1)', [dayKey]);

    const rows = await em
      .createQueryBuilder(VaultSubmission, 's')
      .select('s.public_id', 'publicId')
      .where('s.public_id LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('s.public_id', 'DESC')
      .limit(1)
      .getRawMany<{ publicId: string }>();

    let next = 1;
    const last = rows[0]?.publicId?.trim();
    if (last?.startsWith(prefix)) {
      const n = Number(last.slice(prefix.length));
      if (Number.isFinite(n) && n >= 0) next = Math.floor(n) + 1;
    }
    if (next > 99_999) {
      throw new InternalServerErrorException(
        'Daily vault submission id sequence exhausted (max 99999)',
      );
    }
    return `${prefix}${String(next).padStart(5, '0')}`;
  }

  /**
   * Map package + item statuses → Vault-Detail.html A~H scenario key.
   */
  static resolveScenario(
    status: VaultSubmissionStatus,
    items: Pick<VaultSubmissionItem, 'status'>[],
  ): VaultSubmissionScenario {
    if (status === 'draft') return 'A';
    if (status === 'awaiting_shipment') return 'B';
    if (status === 'in_transit') return 'C';
    if (status === 'cancelled') return 'A';

    if (items.length === 0) {
      if (status === 'psa_reviewing') return 'D';
      if (status === 'completed') return 'G';
      return 'C';
    }

    const statuses = items.map((i) => i.status);
    if (statuses.some((s) => s === 'rejected') && statuses.every((s) => s === 'rejected')) {
      return 'F';
    }
    if (statuses.some((s) => s === 'failed') && statuses.some((s) => s === 'completed')) {
      return 'H';
    }
    if (statuses.every((s) => s === 'completed')) return 'G';
    if (statuses.every((s) => s === 'approved' || s === 'completed' || s === 'minting')) {
      return 'E';
    }
    if (statuses.some((s) => s === 'reviewing' || s === 'approved' || s === 'rejected')) {
      return 'D';
    }
    if (status === 'psa_reviewing') return 'D';
    if (status === 'completed') return 'G';
    return 'C';
  }

  private isoOrNull(value: Date | string | null | undefined): string | null {
    if (value == null) return null;
    if (value instanceof Date) return value.toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  private toDto(sub: VaultSubmission) {
    const items = [...(sub.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      id: sub.id,
      publicId: sub.publicId,
      status: sub.status,
      scenario: VaultSubmissionService.resolveScenario(sub.status, items),
      carrier: sub.carrier,
      trackingNumber: sub.trackingNumber,
      shipDate: sub.shipDate,
      shippedAt: this.isoOrNull(sub.shippedAt),
      packingSlipDownloadedAt: this.isoOrNull(sub.packingSlipDownloadedAt),
      createdAt: this.isoOrNull(sub.createdAt) ?? new Date(0).toISOString(),
      updatedAt: this.isoOrNull(sub.updatedAt) ?? new Date(0).toISOString(),
      items: items.map((it) => ({
        id: it.id,
        cert: it.certNumber,
        name: it.displayName,
        cardNumber: it.cardNumber,
        year: it.cardYear,
        setName: it.setName,
        language: it.language,
        variant: it.variant,
        grade: it.grade,
        imageUrl: it.imageUrl,
        status: it.status,
        rejectionReason: it.rejectionReason,
        vaultCycleId: it.vaultCycleId,
        sortOrder: it.sortOrder,
      })),
    };
  }

  async listForUser(userId: string) {
    const rows = await this.submissions.find({
      where: { userId },
      relations: { items: true },
      order: { updatedAt: 'DESC' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async getForUser(userId: string, idOrPublicId: string) {
    const sub = await this.findOwned(userId, idOrPublicId);
    return this.toDto(sub);
  }

  private async findOwned(userId: string, idOrPublicId: string): Promise<VaultSubmission> {
    const key = idOrPublicId.trim();
    const byPublic = await this.submissions.findOne({
      where: { publicId: key.toUpperCase(), userId },
      relations: { items: true },
    });
    if (byPublic) return byPublic;

    const uuidLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        key,
      );
    if (uuidLike) {
      const byId = await this.submissions.findOne({
        where: { id: key, userId },
        relations: { items: true },
      });
      if (byId) return byId;
    }
    throw new NotFoundException('Submission not found');
  }

  /**
   * Upsert the sell-flow shipping package.
   * Add-cards is local-only — callers must send ≥1 confirmed card.
   * New rows are created as `awaiting_shipment` (never `draft`).
   * Legacy `draft` rows are still accepted and upgraded when cards are confirmed.
   */
  async upsertDraft(userId: string, dto: UpsertVaultSubmissionDraftDto) {
    const cards = dto.cards ?? [];
    if (cards.length === 0) {
      throw new BadRequestException(
        'Add at least one confirmed card before saving the shipping package',
      );
    }
    if (!cards.every((c) => c.confirmed === true)) {
      throw new BadRequestException(
        'Confirm every card before saving the shipping package',
      );
    }

    return this.submissions.manager.transaction(async (em) => {
      let sub: VaultSubmission | null = null;
      if (dto.publicId?.trim()) {
        // Lock the parent row only — relations + pessimistic_write emits
        // LEFT JOIN … FOR UPDATE, which Postgres rejects (nullable outer join).
        sub = await em.findOne(VaultSubmission, {
          where: { publicId: dto.publicId.trim().toUpperCase(), userId },
          lock: { mode: 'pessimistic_write' },
        });
        // Finished/cancelled package id left in the browser — ignore it.
        if (sub && !['draft', 'awaiting_shipment'].includes(sub.status)) {
          sub = null;
        }
      }
      if (!sub) {
        // Prefer open shipping package; fall back to legacy draft to upgrade.
        sub = await em
          .createQueryBuilder(VaultSubmission, 's')
          .setLock('pessimistic_write')
          .where('s.user_id = :userId', { userId })
          .andWhere("s.status = 'awaiting_shipment'")
          .orderBy('s.updated_at', 'DESC')
          .getOne();
        if (!sub) {
          sub = await em
            .createQueryBuilder(VaultSubmission, 's')
            .setLock('pessimistic_write')
            .where('s.user_id = :userId', { userId })
            .andWhere("s.status = 'draft'")
            .orderBy('s.updated_at', 'DESC')
            .getOne();
        }
      }

      if (!sub) {
        const publicId = await this.nextDailyPublicId(em);
        sub = em.create(VaultSubmission, {
          publicId,
          userId,
          status: 'awaiting_shipment',
        });
        sub = await em.save(sub);
      }

      await em.delete(VaultSubmissionItem, { submissionId: sub.id });

      const nextItems: VaultSubmissionItem[] = cards.map((c, i) =>
        em.create(VaultSubmissionItem, this.cardToItem(sub!.id, c, i)),
      );
      if (nextItems.length) await em.save(nextItems);

      // Update status via QueryBuilder — never em.save(sub) here.
      // OneToMany cascade:true would try to null submission_id on items when
      // the in-memory relation is stale/empty (Postgres NOT NULL → 500).
      // Never demote to draft — ship-stage upsert always lands awaiting_shipment.
      if (sub.status === 'draft' || sub.status === 'awaiting_shipment') {
        await em.update(
          VaultSubmission,
          { id: sub.id },
          { status: 'awaiting_shipment' },
        );
        sub.status = 'awaiting_shipment';
      }

      const full = await em.findOneOrFail(VaultSubmission, {
        where: { id: sub.id },
        relations: { items: true },
      });
      return this.toDto(full);
    });
  }

  private cardToItem(
    submissionId: string,
    card: VaultSubmissionCardDto,
    sortOrder: number,
  ): Partial<VaultSubmissionItem> {
    const cert = VaultSubmissionService.normalizeCert(card.cert);
    return {
      submissionId,
      certNumber: cert,
      displayName: card.name.trim() || null,
      cardNumber: card.cardNumber?.trim() || null,
      cardYear: card.year?.trim() || null,
      setName: card.setName?.trim() || null,
      language: card.language?.trim() || null,
      variant: card.variant?.trim() || null,
      grade: `PSA ${card.grade}`,
      imageUrl: card.img?.trim() || null,
      status: card.confirmed ? 'confirmed' : 'draft',
      sortOrder,
    };
  }

  async markPackingSlipDownloaded(userId: string, idOrPublicId: string) {
    const sub = await this.findOwned(userId, idOrPublicId);
    if (!sub.packingSlipDownloadedAt) {
      sub.packingSlipDownloadedAt = new Date();
      await this.submissions.save(sub);
    }
    return this.getForUser(userId, sub.id);
  }

  async registerTracking(userId: string, idOrPublicId: string, dto: RegisterVaultShipmentDto) {
    const sub = await this.findOwned(userId, idOrPublicId);
    // Normal path is awaiting_shipment; draft kept for legacy pre-ship rows.
    if (!['draft', 'awaiting_shipment', 'in_transit'].includes(sub.status)) {
      throw new BadRequestException(`Cannot register tracking while status is ${sub.status}`);
    }
    const items = sub.items ?? [];
    if (items.length === 0) {
      throw new BadRequestException('Add at least one confirmed card before shipping');
    }
    if (!items.every((it) => it.status === 'confirmed' || it.status === 'in_transit')) {
      throw new BadRequestException('Confirm all cards before registering tracking');
    }

    const cleaned = dto.trackingNumber.replace(/\s+/g, '').toUpperCase();
    sub.carrier = dto.carrier;
    sub.trackingNumber = cleaned;
    sub.shipDate = dto.shipDate ?? new Date().toISOString().slice(0, 10);
    sub.shippedAt = new Date();
    sub.status = 'in_transit';
    if (!sub.packingSlipDownloadedAt) {
      sub.packingSlipDownloadedAt = new Date();
    }
    await this.submissions.save(sub);

    for (const it of items) {
      if (it.status === 'confirmed') {
        it.status = 'in_transit';
        await this.items.save(it);
      }
    }

    return this.getForUser(userId, sub.id);
  }

  /**
   * When mint reserves a cycle for a cert, attach it to the user's open
   * submission item so hub/detail can track mint → live without a second source of truth.
   */
  async attachCycleForCert(params: {
    userId: string;
    certNumber: string;
    cycleId: string;
  }): Promise<void> {
    const cert = VaultSubmissionService.normalizeCert(params.certNumber);
    const item = await this.items
      .createQueryBuilder('i')
      .innerJoin('i.submission', 's')
      .where('s.user_id = :userId', { userId: params.userId })
      .andWhere('i.cert_number = :cert', { cert })
      .andWhere("s.status NOT IN ('cancelled')")
      .andWhere("i.status NOT IN ('completed', 'rejected', 'failed')")
      .orderBy('s.updated_at', 'DESC')
      .getOne();

    if (!item) return;

    item.vaultCycleId = params.cycleId;
    item.status = 'minting';
    await this.items.save(item);

    const sub = await this.submissions.findOne({
      where: { id: item.submissionId },
      relations: { items: true },
    });
    if (!sub) return;
    if (sub.status === 'in_transit' || sub.status === 'awaiting_shipment') {
      sub.status = 'psa_reviewing';
      await this.submissions.save(sub);
    }
  }

  async markItemCompletedForCycle(cycleId: string): Promise<void> {
    const item = await this.items.findOne({ where: { vaultCycleId: cycleId } });
    if (!item) return;
    item.status = 'completed';
    await this.items.save(item);

    const sub = await this.submissions.findOne({
      where: { id: item.submissionId },
      relations: { items: true },
    });
    if (!sub?.items) return;
    if (sub.items.every((i) => i.status === 'completed' || i.status === 'rejected')) {
      sub.status = 'completed';
      await this.submissions.save(sub);
    }
  }

  // ── Admin ops ──────────────────────────────────────────────────────────

  /**
   * Flat queue of cards at PSA waiting for ops mint → user wallet (Live).
   * Includes item status `reviewing` or `approved` on `psa_reviewing` packages.
   */
  async listAdminMintQueue(params?: { q?: string }) {
    // No QueryBuilder joins — TypeORM 0.3 throws `databaseName` on join+orderBy
    // for these entities (see adminList). Two plain finds keep the path reliable.
    const packages = await this.submissions.find({
      where: { status: 'psa_reviewing' },
      order: { updatedAt: 'DESC' },
      take: 200,
    });
    if (packages.length === 0) return [];

    const subById = new Map(packages.map((s) => [s.id, s]));
    const items = await this.items.find({
      where: {
        submissionId: In(packages.map((p) => p.id)),
        status: In(['reviewing', 'approved'] as const),
      },
      order: { updatedAt: 'DESC', sortOrder: 'ASC' },
      take: 200,
    });
    if (items.length === 0) return [];

    const userIds = [
      ...new Set(packages.map((s) => s.userId).filter(Boolean)),
    ];
    const userRows: Array<{ id: string; email: string | null; name: string | null }> =
      userIds.length > 0
        ? await this.submissions.manager.query(
            `SELECT id, email, name FROM users WHERE id = ANY($1::uuid[])`,
            [userIds],
          )
        : [];
    const userById = new Map(userRows.map((u) => [u.id, u]));

    const q = params?.q?.trim().toLowerCase() ?? '';
    const rows = items.flatMap((item) => {
      const sub = subById.get(item.submissionId);
      if (!sub) return [];
      const user = userById.get(sub.userId);
      const row = {
        itemId: item.id,
        submissionId: sub.id,
        publicId: sub.publicId,
        packageStatus: sub.status,
        itemStatus: item.status,
        cert: item.certNumber,
        name: item.displayName,
        grade: item.grade,
        imageUrl: item.imageUrl,
        userId: sub.userId,
        userEmail: user?.email ?? null,
        userName: user?.name ?? null,
        updatedAt: (item.updatedAt ?? sub.updatedAt).toISOString(),
      };
      if (!q) return [row];
      const hay = [
        row.publicId,
        row.cert,
        row.name ?? '',
        row.userEmail ?? '',
        row.userName ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q) ? [row] : [];
    });

    return rows;
  }

  async adminCounts() {
    const rows = await this.submissions
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('s.status')
      .getRawMany<{ status: VaultSubmissionStatus; count: string }>();
    const counts: Record<string, number> = {
      all: 0,
      draft: 0,
      awaiting_shipment: 0,
      in_transit: 0,
      psa_reviewing: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const r of rows) {
      const n = Number(r.count) || 0;
      counts[r.status] = n;
      counts.all += n;
    }
    return counts;
  }

  async adminList(params: { status?: string; q?: string }) {
    // Avoid leftJoinAndSelect + orderBy — TypeORM 0.3 throws
    // `Cannot read properties of undefined (reading 'databaseName')` on this path.
    const qb = this.submissions
      .createQueryBuilder('s')
      .orderBy('s.updated_at', 'DESC')
      .take(200);

    if (params.status && params.status !== 'all') {
      qb.andWhere('s.status = :status', { status: params.status });
    }
    if (params.q?.trim()) {
      const q = `%${params.q.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(s.public_id) LIKE :q
          OR EXISTS (
            SELECT 1 FROM vault_submission_items xi
            WHERE xi.submission_id = s.id
              AND (LOWER(xi.cert_number) LIKE :q OR LOWER(COALESCE(xi.display_name,'')) LIKE :q)
          )
          OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = s.user_id
              AND (LOWER(u.email) LIKE :q OR LOWER(COALESCE(u.name,'')) LIKE :q)
          ))`,
        { q },
      );
    }

    const entities = await qb.getMany();
    if (entities.length === 0) return [];

    const items = await this.items.find({
      where: { submissionId: In(entities.map((e) => e.id)) },
      order: { sortOrder: 'ASC' },
    });
    const itemsBySubmission = new Map<string, VaultSubmissionItem[]>();
    for (const item of items) {
      const bucket = itemsBySubmission.get(item.submissionId) ?? [];
      bucket.push(item);
      itemsBySubmission.set(item.submissionId, bucket);
    }
    for (const sub of entities) {
      sub.items = itemsBySubmission.get(sub.id) ?? [];
    }

    const userIds = [
      ...new Set(entities.map((e) => e.userId).filter(Boolean)),
    ];
    const userRows: Array<{ id: string; email: string | null; name: string | null }> =
      userIds.length > 0
        ? await this.submissions.manager.query(
            `SELECT id, email, name FROM users WHERE id = ANY($1::uuid[])`,
            [userIds],
          )
        : [];
    const userById = new Map(userRows.map((u) => [u.id, u]));

    return entities.map((sub) => {
      const user = userById.get(sub.userId);
      return {
        ...this.toDto(sub),
        userId: sub.userId,
        userEmail: user?.email ?? null,
        userName: user?.name ?? null,
      };
    });
  }

  async adminGet(idOrPublicId: string) {
    const sub = await this.findAny(idOrPublicId);
    const user = await this.submissions.manager.query(
      `SELECT email, name FROM users WHERE id = $1 LIMIT 1`,
      [sub.userId],
    );
    const u = (user?.[0] ?? null) as { email?: string; name?: string } | null;
    return {
      ...this.toDto(sub),
      userId: sub.userId,
      userEmail: u?.email ?? null,
      userName: u?.name ?? null,
    };
  }

  private async findAny(idOrPublicId: string): Promise<VaultSubmission> {
    const key = idOrPublicId.trim();
    const byPublic = await this.submissions.findOne({
      where: { publicId: key.toUpperCase() },
      relations: { items: true },
    });
    if (byPublic) return byPublic;
    const uuidLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        key,
      );
    if (uuidLike) {
      const byId = await this.submissions.findOne({
        where: { id: key },
        relations: { items: true },
      });
      if (byId) return byId;
    }
    throw new NotFoundException('Submission not found');
  }

  /** Package arrived at PSA — move in_transit → psa_reviewing; cards → reviewing. */
  async adminMarkArrived(idOrPublicId: string) {
    const sub = await this.findAny(idOrPublicId);
    if (sub.status !== 'in_transit' && sub.status !== 'awaiting_shipment') {
      throw new BadRequestException(
        `Can only mark arrived from in_transit/awaiting_shipment (now ${sub.status})`,
      );
    }
    sub.status = 'psa_reviewing';
    await this.submissions.save(sub);
    for (const it of sub.items ?? []) {
      if (it.status === 'in_transit' || it.status === 'confirmed') {
        it.status = 'reviewing';
        await this.items.save(it);
      }
    }
    const firstCard =
      (sub.items ?? []).find((i) => i.displayName?.trim())?.displayName ??
      (sub.items ?? [])[0]?.displayName ??
      null;
    void this.notifications
      .notifySellerSubmissionReceived({
        userId: sub.userId,
        submissionPublicId: sub.publicId,
        cardLabel: firstCard,
      })
      .catch((e) => {
        this.logger.warn(
          `notifySellerSubmissionReceived failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      });
    return this.adminGet(sub.id);
  }

  /**
   * Match PSA cert numbers to open packages (in_transit / awaiting_shipment).
   * Does not change status — used by mail ingest + admin review queue.
   */
  async findOpenPackagesByCerts(certs: string[]): Promise<OpenPackageByCertMatch> {
    const normalized = [
      ...new Set(
        certs
          .map((c) => VaultSubmissionService.normalizeCert(c))
          .filter((c) => /^\d{7,10}$/.test(c)),
      ),
    ];
    if (normalized.length === 0) {
      return { matchedCerts: [], unmatchedCerts: [], packages: [] };
    }

    const items = await this.items
      .createQueryBuilder('it')
      .innerJoinAndSelect('it.submission', 's')
      .where('it.cert_number IN (:...certs)', { certs: normalized })
      .andWhere("s.status IN ('in_transit', 'awaiting_shipment')")
      .getMany();

    const matchedCerts = [
      ...new Set(items.map((it) => it.certNumber.toUpperCase())),
    ];
    const unmatchedCerts = normalized.filter((c) => !matchedCerts.includes(c));

    const byId = new Map<
      string,
      OpenPackageByCertMatch['packages'][number]
    >();
    for (const it of items) {
      const sub = it.submission;
      if (!sub?.id) continue;
      const row = byId.get(sub.id) ?? {
        id: sub.id,
        publicId: sub.publicId,
        userId: sub.userId,
        status: sub.status,
        certs: [],
      };
      row.certs.push(it.certNumber.toUpperCase());
      byId.set(sub.id, row);
    }

    return {
      matchedCerts,
      unmatchedCerts,
      packages: [...byId.values()],
    };
  }

  /**
   * Queue an Items Received mail for admin review.
   * When `autoConfirmEligible`, Gmail poll may immediately mark matched packages arrived.
   * Idempotent on gmailMessageId.
   */
  async enqueuePsaArrivalReview(input: {
    gmailMessageId: string;
    subject: string | null;
    fromAddress: string | null;
    certs: string[];
    /** Set when parse did not fully match (e.g. no_certs) so ops can still see the mail. */
    ingestNote?: string | null;
    /** True when parsePsaReceivedMail returned matched — enables auto-confirm. */
    autoConfirmEligible?: boolean;
  }): Promise<VaultPsaArrivalReview> {
    const existing = await this.arrivalReviews.findOne({
      where: { gmailMessageId: input.gmailMessageId },
    });
    if (existing) {
      if (existing.status === 'pending' && input.autoConfirmEligible) {
        await this.maybeAutoConfirmPsaArrivalReview(existing.id);
      }
      return (
        (await this.arrivalReviews.findOne({ where: { id: existing.id } })) ??
        existing
      );
    }

    const match = await this.findOpenPackagesByCerts(input.certs);
    const row = this.arrivalReviews.create({
      gmailMessageId: input.gmailMessageId,
      subject: input.subject,
      fromAddress: input.fromAddress,
      certs: match.matchedCerts.length
        ? [...new Set([...match.matchedCerts, ...match.unmatchedCerts])]
        : [
            ...new Set(
              input.certs
                .map((c) => VaultSubmissionService.normalizeCert(c))
                .filter((c) => /^\d{7,10}$/.test(c)),
            ),
          ],
      matchedPublicIds: match.packages.map((p) => p.publicId),
      unmatchedCerts: match.unmatchedCerts,
      ingestNote: input.ingestNote?.trim() || null,
      status: 'pending',
      confirmedVia: null,
      skippedPublicIds: [],
    });
    // Prefer storing the full cert list from the mail when parse had certs.
    if (input.certs.length) {
      row.certs = [
        ...new Set(
          input.certs
            .map((c) => VaultSubmissionService.normalizeCert(c))
            .filter((c) => /^\d{7,10}$/.test(c)),
        ),
      ];
    }
    const saved = await this.arrivalReviews.save(row);
    if (input.autoConfirmEligible) {
      await this.maybeAutoConfirmPsaArrivalReview(saved.id);
    }
    return (
      (await this.arrivalReviews.findOne({ where: { id: saved.id } })) ?? saved
    );
  }

  async listPsaArrivalReviews(status?: VaultPsaArrivalReviewStatus) {
    const where =
      status === 'pending' || status === 'confirmed' || status === 'dismissed'
        ? { status }
        : undefined;
    const rows = await this.arrivalReviews.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return this.toArrivalReviewDtos(rows);
  }

  /** Admin confirms mail match → mark matched open packages arrived. */
  async confirmPsaArrivalReview(reviewId: string) {
    return this.applyPsaArrivalConfirm(reviewId, 'admin');
  }

  /**
   * Gmail poll: auto-confirm when parse matched and open packages exist.
   * Stays pending when auto is disabled, ingest incomplete, or no open package match.
   */
  async maybeAutoConfirmPsaArrivalReview(reviewId: string): Promise<{
    confirmed: boolean;
    reason?: string;
  }> {
    if (!VaultSubmissionService.isAutoConfirmEnabled()) {
      return { confirmed: false, reason: 'auto_confirm_disabled' };
    }
    const review = await this.arrivalReviews.findOne({ where: { id: reviewId } });
    if (!review) return { confirmed: false, reason: 'not_found' };
    if (review.status !== 'pending') {
      return { confirmed: false, reason: `already_${review.status}` };
    }
    if (review.ingestNote) {
      return { confirmed: false, reason: 'ingest_incomplete' };
    }
    const match = await this.findOpenPackagesByCerts(review.certs ?? []);
    if (match.packages.length === 0) {
      return { confirmed: false, reason: 'no_open_packages' };
    }
    try {
      await this.applyPsaArrivalConfirm(reviewId, 'auto');
      return { confirmed: true };
    } catch (e) {
      this.logger.warn(
        `maybeAutoConfirmPsaArrivalReview failed reviewId=${reviewId}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return { confirmed: false, reason: 'apply_failed' };
    }
  }

  private static isAutoConfirmEnabled(): boolean {
    const v = process.env.PSA_RECEIVED_MAIL_AUTO_CONFIRM?.trim();
    return v !== '0' && v !== 'false';
  }

  private async applyPsaArrivalConfirm(
    reviewId: string,
    via: 'auto' | 'admin',
  ) {
    const review = await this.arrivalReviews.findOne({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Arrival review not found');
    if (review.status !== 'pending') {
      throw new BadRequestException(`Review is already ${review.status}`);
    }

    const match = await this.findOpenPackagesByCerts(review.certs ?? []);
    const markedPublicIds: string[] = [];
    const skippedPublicIds: string[] = [];
    for (const pkg of match.packages) {
      try {
        await this.adminMarkArrived(pkg.id);
        markedPublicIds.push(pkg.publicId);
      } catch (e) {
        skippedPublicIds.push(pkg.publicId);
        this.logger.warn(
          `applyPsaArrivalConfirm(${via}) skip ${pkg.publicId}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    if (via === 'auto' && markedPublicIds.length === 0) {
      throw new BadRequestException(
        'Auto-confirm found no packages to mark arrived',
      );
    }

    review.status = 'confirmed';
    review.confirmedVia = via;
    review.reviewedAt = new Date();
    review.skippedPublicIds = skippedPublicIds;
    review.matchedPublicIds = [
      ...new Set([...(review.matchedPublicIds ?? []), ...markedPublicIds]),
    ];
    review.unmatchedCerts = match.unmatchedCerts;
    await this.arrivalReviews.save(review);

    return {
      review: await this.getArrivalReviewDto(review.id),
      markedPublicIds,
      skippedPublicIds,
      unmatchedCerts: match.unmatchedCerts,
    };
  }

  async dismissPsaArrivalReview(reviewId: string) {
    const review = await this.arrivalReviews.findOne({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Arrival review not found');
    if (review.status !== 'pending') {
      throw new BadRequestException(`Review is already ${review.status}`);
    }
    review.status = 'dismissed';
    review.reviewedAt = new Date();
    await this.arrivalReviews.save(review);
    return this.getArrivalReviewDto(review.id);
  }

  private async getArrivalReviewDto(id: string) {
    const entity = await this.arrivalReviews.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Arrival review not found');
    const [dto] = await this.toArrivalReviewDtos([entity]);
    return dto;
  }

  private async toArrivalReviewDtos(rows: VaultPsaArrivalReview[]) {
    const publicIds = [
      ...new Set(rows.flatMap((r) => r.matchedPublicIds ?? [])),
    ];
    const packageByPublic = new Map<
      string,
      {
        publicId: string;
        id: string;
        status: string;
        userId: string;
        userEmail: string | null;
        userName: string | null;
        certs: string[];
      }
    >();
    if (publicIds.length) {
      const subs = await this.submissions.find({
        where: { publicId: In(publicIds) },
        relations: { items: true },
      });
      for (const sub of subs) {
        const userRows = await this.submissions.manager.query(
          `SELECT email, name FROM users WHERE id = $1 LIMIT 1`,
          [sub.userId],
        );
        const u = (userRows as { email?: string; name?: string }[])[0];
        packageByPublic.set(sub.publicId, {
          publicId: sub.publicId,
          id: sub.id,
          status: sub.status,
          userId: sub.userId,
          userEmail: u?.email ?? null,
          userName: u?.name ?? null,
          certs: (sub.items ?? []).map((i) => i.certNumber),
        });
      }
    }

    return rows.map((r) => ({
      id: r.id,
      gmailMessageId: r.gmailMessageId,
      subject: r.subject,
      fromAddress: r.fromAddress,
      certs: r.certs ?? [],
      unmatchedCerts: r.unmatchedCerts ?? [],
      matchedPublicIds: r.matchedPublicIds ?? [],
      ingestNote: r.ingestNote ?? null,
      status: r.status,
      confirmedVia: r.confirmedVia ?? null,
      skippedPublicIds: r.skippedPublicIds ?? [],
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      packages: (r.matchedPublicIds ?? [])
        .map((pid) => packageByPublic.get(pid))
        .filter(Boolean),
    }));
  }

  /**
   * @deprecated Prefer enqueue + admin confirm. Kept for tests / emergency scripts.
   * Match certs and immediately mark arrived.
   */
  async markArrivedByCerts(certs: string[]): Promise<{
    matchedCerts: string[];
    unmatchedCerts: string[];
    markedPublicIds: string[];
    skippedPublicIds: string[];
  }> {
    const match = await this.findOpenPackagesByCerts(certs);
    const markedPublicIds: string[] = [];
    const skippedPublicIds: string[] = [];
    for (const pkg of match.packages) {
      try {
        await this.adminMarkArrived(pkg.id);
        markedPublicIds.push(pkg.publicId);
      } catch (e) {
        skippedPublicIds.push(pkg.publicId);
        this.logger.warn(
          `markArrivedByCerts skip ${pkg.publicId}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    if (match.unmatchedCerts.length) {
      this.logger.warn(
        `markArrivedByCerts unmatched certs=${match.unmatchedCerts.join(',')}`,
      );
    }
    return {
      matchedCerts: match.matchedCerts,
      unmatchedCerts: match.unmatchedCerts,
      markedPublicIds,
      skippedPublicIds,
    };
  }

  /**
   * Match certs to mint-queue items (psa_reviewing + reviewing/approved, no cycle).
   */
  async findMintQueueItemsByCerts(certs: string[]): Promise<{
    matchedCerts: string[];
    unmatchedCerts: string[];
    items: Array<{
      itemId: string;
      submissionId: string;
      publicId: string;
      cert: string;
      itemStatus: string;
      name: string | null;
    }>;
  }> {
    const normalized = [
      ...new Set(
        certs
          .map((c) => VaultSubmissionService.normalizeCert(c))
          .filter((c) => /^\d{7,10}$/.test(c)),
      ),
    ];
    if (normalized.length === 0) {
      return { matchedCerts: [], unmatchedCerts: [], items: [] };
    }

    const rows = await this.items
      .createQueryBuilder('it')
      .innerJoinAndSelect('it.submission', 's')
      .where('it.cert_number IN (:...certs)', { certs: normalized })
      .andWhere("s.status = 'psa_reviewing'")
      .andWhere("it.status IN ('reviewing', 'approved')")
      .andWhere('it.vault_cycle_id IS NULL')
      .getMany();

    const matchedCerts = [
      ...new Set(rows.map((it) => it.certNumber.toUpperCase())),
    ];
    const unmatchedCerts = normalized.filter((c) => !matchedCerts.includes(c));
    const items = rows.map((it) => ({
      itemId: it.id,
      submissionId: it.submissionId,
      publicId: it.submission?.publicId ?? '',
      cert: it.certNumber,
      itemStatus: it.status,
      name: it.displayName,
    }));
    return { matchedCerts, unmatchedCerts, items };
  }

  async enqueuePsaVaultedReview(input: {
    gmailMessageId: string;
    subject: string | null;
    fromAddress: string | null;
    certs: string[];
    ingestNote?: string | null;
  }): Promise<VaultPsaVaultedReview> {
    const existing = await this.vaultedReviews.findOne({
      where: { gmailMessageId: input.gmailMessageId },
    });
    if (existing) return existing;

    const match = await this.findMintQueueItemsByCerts(input.certs);
    const certList = input.certs.length
      ? [
          ...new Set(
            input.certs
              .map((c) => VaultSubmissionService.normalizeCert(c))
              .filter((c) => /^\d{7,10}$/.test(c)),
          ),
        ]
      : match.matchedCerts;

    const row = this.vaultedReviews.create({
      gmailMessageId: input.gmailMessageId,
      subject: input.subject,
      fromAddress: input.fromAddress,
      certs: certList,
      matchedItemIds: match.items.map((i) => i.itemId),
      matchedPublicIds: [
        ...new Set(match.items.map((i) => i.publicId).filter(Boolean)),
      ],
      unmatchedCerts: match.unmatchedCerts,
      ingestNote: input.ingestNote?.trim() || null,
      status: 'pending',
      mintedVia: null,
      mintResults: [],
      errorSummary: null,
    });
    return this.vaultedReviews.save(row);
  }

  async findPsaVaultedReviewById(id: string) {
    return this.vaultedReviews.findOne({ where: { id } });
  }

  async listPsaVaultedReviews(status?: VaultPsaVaultedReviewStatus) {
    const where =
      status === 'pending' ||
      status === 'minted' ||
      status === 'failed' ||
      status === 'dismissed'
        ? { status }
        : undefined;
    const rows = await this.vaultedReviews.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return this.toVaultedReviewDtos(rows);
  }

  async dismissPsaVaultedReview(reviewId: string) {
    const review = await this.vaultedReviews.findOne({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Vaulted review not found');
    if (review.status !== 'pending' && review.status !== 'failed') {
      throw new BadRequestException(`Review is already ${review.status}`);
    }
    review.status = 'dismissed';
    review.reviewedAt = new Date();
    await this.vaultedReviews.save(review);
    return this.getVaultedReviewDto(review.id);
  }

  async recordPsaVaultedMintOutcome(
    reviewId: string,
    input: {
      via: 'auto' | 'admin';
      results: Array<{
        cert: string;
        itemId?: string;
        publicId?: string;
        ok: boolean;
        tokenId?: number;
        error?: string;
      }>;
    },
  ) {
    const review = await this.vaultedReviews.findOne({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Vaulted review not found');

    // Merge with prior successes so partial retries do not erase Live certs.
    const merged = this.mergeVaultedMintResults(
      review.mintResults ?? [],
      input.results,
    );

    const anyOk = merged.some((r) => r.ok);
    const anyFail = merged.some((r) => !r.ok);
    review.mintResults = merged;
    review.mintedVia = input.via;
    review.reviewedAt = new Date();
    review.matchedItemIds = [
      ...new Set([
        ...(review.matchedItemIds ?? []),
        ...merged
          .map((r) => r.itemId)
          .filter((id): id is string => Boolean(id)),
      ]),
    ];
    review.matchedPublicIds = [
      ...new Set([
        ...(review.matchedPublicIds ?? []),
        ...merged
          .map((r) => r.publicId)
          .filter((id): id is string => Boolean(id)),
      ]),
    ];
    if (anyOk && !anyFail) {
      review.status = 'minted';
      review.errorSummary = null;
    } else if (anyOk && anyFail) {
      review.status = 'minted';
      review.errorSummary = merged
        .filter((r) => !r.ok)
        .map((r) => `${r.cert}: ${r.error ?? 'failed'}`)
        .join('; ');
    } else {
      review.status = 'failed';
      review.errorSummary =
        merged
          .map((r) => `${r.cert}: ${r.error ?? 'failed'}`)
          .join('; ') || 'mint failed';
    }
    await this.vaultedReviews.save(review);
    return this.getVaultedReviewDto(review.id);
  }

  private mergeVaultedMintResults(
    previous: Array<{
      cert: string;
      itemId?: string;
      publicId?: string;
      ok: boolean;
      tokenId?: number;
      error?: string;
    }>,
    next: Array<{
      cert: string;
      itemId?: string;
      publicId?: string;
      ok: boolean;
      tokenId?: number;
      error?: string;
    }>,
  ) {
    const byCert = new Map<string, (typeof next)[number]>();
    for (const r of previous) {
      byCert.set(r.cert.toUpperCase(), r);
    }
    for (const r of next) {
      const key = r.cert.toUpperCase();
      const prev = byCert.get(key);
      if (prev?.ok && !r.ok) {
        // Keep prior success (e.g. already Live; retry sees unmatched).
        continue;
      }
      byCert.set(key, r);
    }
    return [...byCert.values()];
  }

  private async getVaultedReviewDto(id: string) {
    const entity = await this.vaultedReviews.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Vaulted review not found');
    const [dto] = await this.toVaultedReviewDtos([entity]);
    return dto;
  }

  private async toVaultedReviewDtos(rows: VaultPsaVaultedReview[]) {
    const itemIds = [...new Set(rows.flatMap((r) => r.matchedItemIds ?? []))];
    const itemById = new Map<
      string,
      {
        itemId: string;
        submissionId: string;
        publicId: string;
        cert: string;
        itemStatus: string;
        name: string | null;
        userEmail: string | null;
        userName: string | null;
        tokenId: number | null;
      }
    >();

    if (itemIds.length) {
      const items = await this.items.find({
        where: { id: In(itemIds) },
        relations: { submission: true },
      });
      const userIds = [
        ...new Set(
          items.map((i) => i.submission?.userId).filter(Boolean) as string[],
        ),
      ];
      const userRows: Array<{
        id: string;
        email: string | null;
        name: string | null;
      }> =
        userIds.length > 0
          ? await this.submissions.manager.query(
              `SELECT id, email, name FROM users WHERE id = ANY($1::uuid[])`,
              [userIds],
            )
          : [];
      const userById = new Map(userRows.map((u) => [u.id, u]));

      for (const it of items) {
        const sub = it.submission;
        const u = sub ? userById.get(sub.userId) : undefined;
        const mintHit = rows
          .flatMap((r) => r.mintResults ?? [])
          .find((m) => m.itemId === it.id && m.ok);
        itemById.set(it.id, {
          itemId: it.id,
          submissionId: it.submissionId,
          publicId: sub?.publicId ?? '',
          cert: it.certNumber,
          itemStatus: it.status,
          name: it.displayName,
          userEmail: u?.email ?? null,
          userName: u?.name ?? null,
          tokenId: mintHit?.tokenId ?? null,
        });
      }
    }

    return rows.map((r) => ({
      id: r.id,
      gmailMessageId: r.gmailMessageId,
      subject: r.subject,
      fromAddress: r.fromAddress,
      certs: r.certs ?? [],
      unmatchedCerts: r.unmatchedCerts ?? [],
      matchedItemIds: r.matchedItemIds ?? [],
      matchedPublicIds: r.matchedPublicIds ?? [],
      ingestNote: r.ingestNote ?? null,
      status: r.status,
      mintedVia: r.mintedVia ?? null,
      mintResults: r.mintResults ?? [],
      errorSummary: r.errorSummary ?? null,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      items: (r.matchedItemIds ?? [])
        .map((id) => itemById.get(id))
        .filter(Boolean),
    }));
  }

  async adminSetSubmissionStatus(
    idOrPublicId: string,
    status: VaultSubmissionStatus,
  ) {
    const sub = await this.findAny(idOrPublicId);
    sub.status = status;
    await this.submissions.save(sub);
    return this.adminGet(sub.id);
  }

  async adminSetItemStatus(
    idOrPublicId: string,
    itemId: string,
    status: import('./entities/vault-submission-item.entity').VaultSubmissionItemStatus,
    rejectionReason?: string,
  ) {
    const sub = await this.findAny(idOrPublicId);
    const item = (sub.items ?? []).find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Item not found');
    item.status = status;
    if (status === 'rejected') {
      item.rejectionReason = rejectionReason?.trim() || 'Does not meet requirements';
    } else if (rejectionReason === '') {
      item.rejectionReason = null;
    }
    await this.items.save(item);

    // Keep package status in sync with card outcomes.
    const refreshed = await this.findAny(sub.id);
    const statuses = (refreshed.items ?? []).map((i) => i.status);
    if (statuses.length > 0 && statuses.every((s) => s === 'completed' || s === 'rejected')) {
      refreshed.status = 'completed';
      await this.submissions.save(refreshed);
    } else if (statuses.some((s) => s === 'reviewing' || s === 'approved' || s === 'rejected')) {
      if (refreshed.status === 'in_transit' || refreshed.status === 'awaiting_shipment') {
        refreshed.status = 'psa_reviewing';
        await this.submissions.save(refreshed);
      }
    }

    const cardLabel = item.displayName?.trim() || null;
    if (status === 'approved') {
      void this.notifications
        .notifySellerVerifyDoneSetPrice({
          userId: sub.userId,
          submissionPublicId: sub.publicId,
          itemId: item.id,
          cardLabel,
        })
        .catch((e) => {
          this.logger.warn(
            `notifySellerVerifyDoneSetPrice failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
    } else if (status === 'rejected') {
      void this.notifications
        .notifySellerCardRejected({
          userId: sub.userId,
          submissionPublicId: sub.publicId,
          itemId: item.id,
          cardLabel,
          reason: item.rejectionReason,
        })
        .catch((e) => {
          this.logger.warn(
            `notifySellerCardRejected failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
    } else if (status === 'failed') {
      void this.notifications
        .notifySellerListingFailed({
          userId: sub.userId,
          submissionPublicId: sub.publicId,
          itemId: item.id,
          cardLabel,
        })
        .catch((e) => {
          this.logger.warn(
            `notifySellerListingFailed failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
    }

    return this.adminGet(sub.id);
  }

  /**
   * Daily: approved cards waiting 3+ days without a set price
   * (SELLER_PRICE_PENDING_REMINDER).
   */
  @Cron('0 14 * * *')
  async cronPricePendingReminders(): Promise<void> {
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const items = await this.items.find({
      where: {
        status: In(['approved', 'completed']),
        updatedAt: LessThan(cutoff),
      },
      relations: { submission: true },
      take: 100,
    });
    for (const item of items) {
      const sub = item.submission;
      if (!sub?.userId || !sub.publicId) continue;
      void this.notifications
        .notifySellerPricePendingReminder({
          userId: sub.userId,
          itemId: item.id,
          submissionPublicId: sub.publicId,
          cardLabel: item.displayName,
        })
        .catch((e) => {
          this.logger.warn(
            `notifySellerPricePendingReminder failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
    }
  }
}
