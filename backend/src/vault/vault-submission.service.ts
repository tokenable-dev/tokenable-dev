import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
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
    private readonly notifications: NotificationsService,
  ) {}

  private static normalizeCert(cert: string): string {
    return cert.trim().toUpperCase();
  }

  static createPublicId(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const seq = String(Math.floor(Math.random() * 90000) + 10000);
    return `SUB-${y}${m}${day}-${seq}`;
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
      shippedAt: sub.shippedAt?.toISOString() ?? null,
      packingSlipDownloadedAt: sub.packingSlipDownloadedAt?.toISOString() ?? null,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
      items: items.map((it) => ({
        id: it.id,
        cert: it.certNumber,
        name: it.displayName,
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

  async upsertDraft(userId: string, dto: UpsertVaultSubmissionDraftDto) {
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
        // Prefer continuing the latest open draft if present.
        sub = await em
          .createQueryBuilder(VaultSubmission, 's')
          .setLock('pessimistic_write')
          .where('s.user_id = :userId', { userId })
          .andWhere("s.status IN ('draft', 'awaiting_shipment')")
          .orderBy('s.updated_at', 'DESC')
          .getOne();
      }

      if (!sub) {
        sub = em.create(VaultSubmission, {
          publicId: VaultSubmissionService.createPublicId(),
          userId,
          status: 'draft',
        });
        sub = await em.save(sub);
      }

      await em.delete(VaultSubmissionItem, { submissionId: sub.id });

      const cards = dto.cards ?? [];
      const nextItems: VaultSubmissionItem[] = cards.map((c, i) =>
        em.create(VaultSubmissionItem, this.cardToItem(sub!.id, c, i)),
      );
      if (nextItems.length) await em.save(nextItems);

      // Update status via QueryBuilder — never em.save(sub) here.
      // OneToMany cascade:true would try to null submission_id on items when
      // the in-memory relation is stale/empty (Postgres NOT NULL → 500).
      if (sub.status === 'draft' || sub.status === 'awaiting_shipment') {
        const allConfirmed =
          nextItems.length > 0 && nextItems.every((it) => it.status === 'confirmed');
        const nextStatus: VaultSubmissionStatus = allConfirmed
          ? 'awaiting_shipment'
          : 'draft';
        await em.update(VaultSubmission, { id: sub.id }, { status: nextStatus });
        sub.status = nextStatus;
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
   * Queue an Items Received mail for admin review (no auto Ship→PSA).
   * Idempotent on gmailMessageId.
   */
  async enqueuePsaArrivalReview(input: {
    gmailMessageId: string;
    subject: string | null;
    fromAddress: string | null;
    certs: string[];
    /** Set when parse did not fully match (e.g. no_certs) so ops can still see the mail. */
    ingestNote?: string | null;
  }): Promise<VaultPsaArrivalReview> {
    const existing = await this.arrivalReviews.findOne({
      where: { gmailMessageId: input.gmailMessageId },
    });
    if (existing) return existing;

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
    return this.arrivalReviews.save(row);
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
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      packages: (r.matchedPublicIds ?? [])
        .map((pid) => packageByPublic.get(pid))
        .filter(Boolean),
    }));
  }

  /** Admin confirms mail match → mark matched open packages arrived. */
  async confirmPsaArrivalReview(reviewId: string) {
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
          `confirmPsaArrivalReview skip ${pkg.publicId}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    review.status = 'confirmed';
    review.reviewedAt = new Date();
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
    const list = await this.listPsaArrivalReviews();
    const row = list.find((r) => r.id === id);
    if (!row) throw new NotFoundException('Arrival review not found');
    return row;
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
