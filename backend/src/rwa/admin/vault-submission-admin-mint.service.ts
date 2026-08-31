import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SupportedChainId } from '../../blockchain/chain-config.service';
import { KycService } from '../../kyc/kyc.service';
import { CollectionCoverService } from '../../marketplace/collections/collection-cover.service';
import { NotificationsService } from '../../marketplace/notifications/notifications.service';
import { PsaService } from '../../psa/psa.service';
import { UserService } from '../../user/user.service';
import { VaultSubmissionItem } from '../../vault/entities/vault-submission-item.entity';
import { VaultService } from '../../vault/vault.service';
import { VaultSubmissionService } from '../../vault/vault-submission.service';
import { RwaMintService } from '../rwa-mint.service';
import { RwaService } from '../rwa.service';
import {
  buildVaultAdminMintUploadFromAnalyze,
} from './vault-admin-mint-metadata.util';

@Injectable()
export class VaultSubmissionAdminMintService {
  private readonly logger = new Logger(VaultSubmissionAdminMintService.name);

  constructor(
    private readonly submissions: VaultSubmissionService,
    @InjectRepository(VaultSubmissionItem)
    private readonly items: Repository<VaultSubmissionItem>,
    private readonly users: UserService,
    private readonly psa: PsaService,
    private readonly rwa: RwaService,
    private readonly rwaMint: RwaMintService,
    private readonly vault: VaultService,
    private readonly notifications: NotificationsService,
    private readonly collectionCover: CollectionCoverService,
    private readonly kyc: KycService,
  ) {}

  /**
   * PSA analyze → IPFS upload → custody mint → deliver to depositor wallet.
   * If the cert already has a minted cycle on this chain, adopt + deliver instead
   * of 409 Conflict (common when a prior mint left the sell-flow item unlinked).
   */
  async mintAndDeliverItem(
    idOrPublicId: string,
    itemId: string,
    chainId: SupportedChainId,
  ) {
    const detail = await this.submissions.adminGet(idOrPublicId);
    if (detail.status !== 'psa_reviewing') {
      throw new BadRequestException(
        `Package must be psa_reviewing (now ${detail.status})`,
      );
    }
    const itemRow = (detail.items ?? []).find((i) => i.id === itemId);
    if (!itemRow) throw new NotFoundException('Item not found');
    if (itemRow.status !== 'reviewing' && itemRow.status !== 'approved') {
      throw new BadRequestException(
        `Item must be reviewing or approved (now ${itemRow.status})`,
      );
    }
    if (itemRow.vaultCycleId) {
      throw new BadRequestException(
        'Item already linked to a vault cycle — check custody / submissions',
      );
    }

    const item = await this.items.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item not found');
    const priorStatus = item.status;
    const cert = item.certNumber.trim();

    const user = await this.users.findByIdOrFail(detail.userId);
    await this.kyc.assertApprovedForCustody(user);

    const wallets = await this.users.listWalletsForUser(user.id);
    const primary =
      wallets.find((w) => w.isPrimary)?.walletAddress ??
      wallets[0]?.walletAddress;
    if (!primary?.trim()) {
      throw new BadRequestException(
        'Depositor has no linked wallet — user must connect Privy first',
      );
    }
    const recipientAddress = primary.trim().toLowerCase();

    try {
      const existing = await this.vault.findOpenMintedTokenForCert(
        cert,
        chainId,
      );
      if (existing) {
        this.logger.log(
          `Mint queue adopt: cert=${cert} already minted token #${existing.tokenId} cycle=${existing.cycle.id}`,
        );
        const adopted = await this.rwaMint.adoptExistingMintedAndDeliverForUser(
          user,
          {
            recipientAddress,
            certNumber: cert,
            tokenId: existing.tokenId,
            tokenURI: existing.token.tokenUri ?? '',
            vaultRef: existing.vaultRef,
            cycleId: existing.cycle.id,
          },
          chainId,
        );

        const cardLabel = item.displayName?.trim() || `PSA #${cert}`;
        void this.notifications
          .notifySellerVerifyDoneSetPrice({
            userId: user.id,
            submissionPublicId: detail.publicId,
            itemId: item.id,
            cardLabel,
            tokenId: String(adopted.tokenId),
          })
          .catch((e) => {
            this.logger.warn(
              `notifySellerVerifyDoneSetPrice failed: ${
                e instanceof Error ? e.message : String(e)
              }`,
            );
          });

        return {
          submissionId: detail.id,
          publicId: detail.publicId,
          itemId: item.id,
          cert,
          tokenId: adopted.tokenId,
          tokenURI: adopted.tokenURI,
          vaultRef: adopted.vaultRef,
          mintTxHash: adopted.txHash,
          deliverTxHash: adopted.deliverTxHash,
          recipientAddress: adopted.mintedTo,
          chainId: adopted.chainId,
          adoptedExisting: true as const,
          alreadyWithUser: adopted.alreadyWithUser,
        };
      }

      const analyze = await this.psa.analyzeByCertNumber(cert);
      let { dto } = buildVaultAdminMintUploadFromAnalyze({
        certNumber: cert,
        analyze,
        fallbackName: item.displayName,
        fallbackImageUrl: item.imageUrl,
      });

      const upload = await this.rwa.uploadToIpfs(dto, chainId);

      const mint = await this.rwaMint.mintCustodyThenDeliverForUser(
        user,
        {
          recipientAddress,
          tokenURI: upload.tokenURI,
          certNumber: cert,
          displayImageUrl: upload.displayImageUrl ?? undefined,
          displayImageBackUrl: upload.displayImageBackUrl ?? undefined,
        },
        chainId,
      );

      const cardLabel = item.displayName?.trim() || `PSA #${cert}`;
      void this.notifications
        .notifySellerVerifyDoneSetPrice({
          userId: user.id,
          submissionPublicId: detail.publicId,
          itemId: item.id,
          cardLabel,
          tokenId: String(mint.tokenId),
        })
        .catch((e) => {
          this.logger.warn(
            `notifySellerVerifyDoneSetPrice failed: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        });

      return {
        submissionId: detail.id,
        publicId: detail.publicId,
        itemId: item.id,
        cert,
        tokenId: mint.tokenId,
        tokenURI: mint.tokenURI,
        vaultRef: mint.vaultRef,
        mintTxHash: mint.txHash,
        deliverTxHash: mint.deliverTxHash,
        recipientAddress: mint.mintedTo,
        chainId: mint.chainId,
        adoptedExisting: false as const,
        alreadyWithUser: false,
      };
    } catch (err) {
      const refreshed = await this.items.findOne({ where: { id: itemId } });
      if (refreshed && refreshed.status === 'minting') {
        refreshed.status =
          priorStatus === 'approved' ? 'approved' : 'reviewing';
        refreshed.vaultCycleId = null;
        await this.items.save(refreshed);
      }
      throw err;
    }
  }
}
