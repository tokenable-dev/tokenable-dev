import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, Wallet, ZeroAddress, ZeroHash } from 'ethers';
import { TOKENABLE_RWA_ABI } from './abis/tokenable-rwa.abi';
import { ChainConfigService } from './chain-config.service';
import { BlockchainService } from './blockchain.service';
import { RwaTokenOwnerIndexService } from './rwa-token-owner-index.service';
import { toMintRpcHttpException } from './mint-rpc-error.util';
import { withRpcProviderCall } from './rpc-retry.util';

const ADDR = /^0x[a-fA-F0-9]{40}$/;

function parseMintedTokenIds(
  contract: Contract,
  logs: readonly { topics: readonly string[]; data: string }[],
): number[] {
  const ids: number[] = [];
  for (const log of logs) {
    try {
      const parsed = contract.interface.parseLog({
        topics: [...log.topics],
        data: log.data,
      });
      if (
        parsed?.name === 'Transfer' &&
        String(parsed.args.from).toLowerCase() === ZeroAddress.toLowerCase()
      ) {
        ids.push(Number(parsed.args.tokenId));
      }
    } catch {
      /* skip unrelated logs */
    }
  }
  return ids;
}

/**
 * Backend signer for the unmodified OpenZeppelin ERC721PresetMinterPauserAutoId.
 *
 * RWA_OWNER_PRIVATE_KEY must hold MINTER_ROLE for mint(to). Burn uses
 * ERC721Burnable.burn — the signer must currently own (or be approved for)
 * the token, typically the custody wallet after redeem intake.
 */
@Injectable()
export class RwaChainWriterService {
  private readonly logger = new Logger(RwaChainWriterService.name);

  /**
   * Tail of the pending-write chain per (chainId, signer address).
   * Concurrent sends from one EOA race the account nonce and fail with
   * "nonce already used" / "replacement underpriced" — serialize them instead.
   */
  private readonly writeLocks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly config: ConfigService,
    private readonly chainConfig: ChainConfigService,
    private readonly ownerIndex: RwaTokenOwnerIndexService,
    private readonly blockchain: BlockchainService,
  ) {}

  private withSignerLock<T>(
    chainId: number,
    privateKey: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const key = `${chainId}:${new Wallet(privateKey).address.toLowerCase()}`;
    const prev = this.writeLocks.get(key) ?? Promise.resolve();
    // Run after the previous write settles, whether it succeeded or failed.
    const run = prev.then(fn, fn);
    this.writeLocks.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  // ─── Key resolution ────────────────────────────────────────────────────────

  private normalizePrivateKey(raw: string, label: string): string {
    const key = raw.trim();
    if (!key) {
      throw new InternalServerErrorException(`${label} is not configured`);
    }
    return key.startsWith('0x') ? key : `0x${key}`;
  }

  private ownerPrivateKey(): string {
    const key =
      this.config.get<string>('RWA_OWNER_PRIVATE_KEY')?.trim() ||
      this.config.get<string>('DEPLOYER_PRIVATE_KEY')?.trim() ||
      '';
    return this.normalizePrivateKey(key, 'RWA_OWNER_PRIVATE_KEY');
  }

  /** Signs grantRole/revokeRole — must hold DEFAULT_ADMIN_ROLE on-chain. */
  private adminPrivateKey(): string {
    const key =
      this.config.get<string>('RWA_ADMIN_PRIVATE_KEY')?.trim() ||
      this.config.get<string>('DEPLOYER_PRIVATE_KEY')?.trim() ||
      this.config.get<string>('RWA_OWNER_PRIVATE_KEY')?.trim() ||
      '';
    return this.normalizePrivateKey(key, 'RWA_ADMIN_PRIVATE_KEY');
  }

  /** Signs custody NFT deliveries — defaults to the owner/minter key in dev. */
  private custodyPrivateKey(): string {
    const key =
      this.config.get<string>('RWA_CUSTODY_PRIVATE_KEY')?.trim() ||
      this.ownerPrivateKey();
    return this.normalizePrivateKey(key, 'RWA_CUSTODY_PRIVATE_KEY');
  }

  /**
   * Platform custody wallet — vault mints land here until admin delivers to the
   * depositor's linked account wallet. Set RWA_CUSTODY_WALLET_ADDRESS explicitly
   * in prod; when omitted, derived from RWA_CUSTODY_PRIVATE_KEY / owner key.
   */
  async getCustodyWalletAddress(
    chainId = this.chainConfig.getDefaultChainId(),
  ): Promise<string> {
    const fromEnv = this.config
      .get<string>('RWA_CUSTODY_WALLET_ADDRESS')
      ?.trim()
      .toLowerCase();
    if (fromEnv && ADDR.test(fromEnv)) return fromEnv;

    const provider = this.chainConfig.createJsonRpcProvider(chainId);
    const wallet = new Wallet(this.custodyPrivateKey(), provider);
    return (await wallet.getAddress()).toLowerCase();
  }

  private signedContract(chainId = this.chainConfig.getDefaultChainId()): Contract {
    const provider = this.chainConfig.createJsonRpcProvider(chainId);
    const wallet = new Wallet(this.ownerPrivateKey(), provider);
    const address = this.chainConfig.getRwaAddress(chainId);
    return new Contract(address, TOKENABLE_RWA_ABI, wallet);
  }

  private readContract(chainId = this.chainConfig.getDefaultChainId()): Contract {
    const provider = this.chainConfig.createJsonRpcProvider(chainId);
    const address = this.chainConfig.getRwaAddress(chainId);
    return new Contract(address, TOKENABLE_RWA_ABI, provider);
  }

  private signedAdminContract(
    chainId = this.chainConfig.getDefaultChainId(),
  ): Contract {
    const provider = this.chainConfig.createJsonRpcProvider(chainId);
    const wallet = new Wallet(this.adminPrivateKey(), provider);
    const address = this.chainConfig.getRwaAddress(chainId);
    return new Contract(address, TOKENABLE_RWA_ABI, wallet);
  }

  async getAdminSignerAddress(
    chainId = this.chainConfig.getDefaultChainId(),
  ): Promise<string> {
    const provider = this.chainConfig.createJsonRpcProvider(chainId);
    const wallet = new Wallet(this.adminPrivateKey(), provider);
    return (await wallet.getAddress()).toLowerCase();
  }

  private signedCustodyContract(
    chainId = this.chainConfig.getDefaultChainId(),
  ): Contract {
    const provider = this.chainConfig.createJsonRpcProvider(chainId);
    const wallet = new Wallet(this.custodyPrivateKey(), provider);
    const address = this.chainConfig.getRwaAddress(chainId);
    return new Contract(address, TOKENABLE_RWA_ABI, wallet);
  }

  // ─── Mint ──────────────────────────────────────────────────────────────────
  // On-chain mint is OpenZeppelin `mint(to)` only. tokenURI / vaultRef stay in
  // Postgres (Pinata CID + keccak256 cert). Duplicate-cert checks are DB-only.

  async mintTo(
    to: string,
    tokenURI: string,
    vaultRef: string,
    chainId = this.chainConfig.getDefaultChainId(),
    hooks?: { onSubmitted?: (txHash: string) => Promise<void> },
  ): Promise<{ tokenId: number; txHash: string }> {
    const recipient = to.trim().toLowerCase();
    if (!ADDR.test(recipient)) {
      throw new BadRequestException('Invalid recipient wallet address');
    }
    const uri = tokenURI?.trim();
    if (!uri) {
      throw new BadRequestException('tokenURI is required');
    }
    if (!vaultRef || vaultRef === ZeroHash) {
      throw new BadRequestException('vaultRef is required');
    }

    try {
      return await this.withSignerLock(chainId, this.ownerPrivateKey(), () =>
        withRpcProviderCall(async () => {
          const contract = this.signedContract(chainId);
          const tx = await contract.mint(recipient);
          this.logger.log(`mint tx submitted: ${tx.hash} → ${recipient}`);
          await hooks?.onSubmitted?.(tx.hash);
          const receipt = await tx.wait();
          if (!receipt?.hash) {
            throw new InternalServerErrorException(
              'Mint transaction was mined but returned no receipt hash',
            );
          }

          const minted = parseMintedTokenIds(contract, receipt.logs ?? []);
          const tokenId = minted[0] ?? -1;
          if (!Number.isFinite(tokenId) || tokenId < 0) {
            throw new InternalServerErrorException(
              'Mint receipt had no ERC-721 Transfer from address(0) — check contract events',
            );
          }

          await this.ownerIndex.recordOwner(
            this.chainConfig.getRwaAddress(chainId),
            tokenId,
            recipient,
          );
          this.blockchain.invalidateTokensByOwnerCache(recipient, chainId);

          return { tokenId, txHash: receipt.hash };
        }, { label: 'mintTo' }),
      );
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw toMintRpcHttpException(e);
    }
  }

  /**
   * Sequential `mint(to)` calls (preset has no mintBatch). Same signer lock
   * so nonces stay ordered. Prefer per-item `mintTo` when partial failure
   * must not unwind already-mined tokens.
   */
  async mintBatchTo(
    items: Array<{ to: string; tokenURI: string; vaultRef: string }>,
    chainId = this.chainConfig.getDefaultChainId(),
  ): Promise<{ tokenIds: number[]; txHash: string }> {
    if (!items.length) {
      throw new BadRequestException('mintBatch requires at least one item');
    }

    const tokenIds: number[] = [];
    let lastHash = '';
    for (const it of items) {
      const { tokenId, txHash } = await this.mintTo(
        it.to,
        it.tokenURI,
        it.vaultRef,
        chainId,
      );
      tokenIds.push(tokenId);
      lastHash = txHash;
    }
    return { tokenIds, txHash: lastHash };
  }

  // ─── Custody delivery ──────────────────────────────────────────────────────

  async safeTransferFromCustody(
    tokenId: number,
    to: string,
    chainId = this.chainConfig.getDefaultChainId(),
  ): Promise<{ txHash: string }> {
    const tid = Math.floor(Number(tokenId));
    if (!Number.isFinite(tid) || tid < 0) {
      throw new BadRequestException('Invalid tokenId');
    }

    const recipient = to.trim().toLowerCase();
    if (!ADDR.test(recipient)) {
      throw new BadRequestException('Invalid recipient wallet address');
    }

    const custody = await this.getCustodyWalletAddress(chainId);
    const contract = this.signedCustodyContract(chainId);
    const signer = contract.runner;
    if (!signer || !('getAddress' in signer)) {
      throw new InternalServerErrorException('Custody signer unavailable');
    }
    const signerAddress = (await (signer as Wallet).getAddress()).toLowerCase();
    if (signerAddress !== custody) {
      throw new InternalServerErrorException(
        `Custody signer (${signerAddress}) does not match RWA_CUSTODY_WALLET_ADDRESS (${custody})`,
      );
    }

    let owner: string;
    try {
      owner = String(await contract.ownerOf(tid)).trim().toLowerCase();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(
        msg.includes('invalid token') || msg.includes('nonexistent')
          ? `Token #${tid} is not minted on chain`
          : `Could not resolve owner for token #${tid}: ${msg}`,
      );
    }
    if (owner !== custody) {
      throw new BadRequestException(
        `Token #${tid} is not held in custody (owner=${owner})`,
      );
    }

    return this.withSignerLock(chainId, this.custodyPrivateKey(), async () => {
      try {
        const tx = await contract['safeTransferFrom'](custody, recipient, tid);
        this.logger.log(
          `custody transfer tx submitted: ${tx.hash} token #${tid} → ${recipient}`,
        );
        const receipt = await tx.wait();
        if (!receipt?.hash) {
          throw new InternalServerErrorException('Transfer transaction failed');
        }
        await this.ownerIndex.recordOwner(
          this.chainConfig.getRwaAddress(chainId),
          tid,
          recipient,
        );
        this.blockchain.invalidateTokensByOwnerCache(recipient, chainId);
        return { txHash: receipt.hash };
      } catch (e) {
        if (e instanceof InternalServerErrorException) throw e;
        const msg = e instanceof Error ? e.message : String(e);
        throw new InternalServerErrorException(`Transfer transaction reverted: ${msg}`);
      }
    });
  }

  // ─── Burn (ERC721Burnable) ─────────────────────────────────────────────────

  /**
   * Burn via OpenZeppelin `burn(tokenId)`. The signer must own the token
   * (or be approved). Prefer custody after redeem intake.
   */
  async adminBurn(
    tokenId: number,
    chainId = this.chainConfig.getDefaultChainId(),
    expectedOwner?: string | null,
  ): Promise<{ txHash: string }> {
    const tid = Math.floor(Number(tokenId));
    if (!Number.isFinite(tid) || tid < 0) {
      throw new BadRequestException('Invalid tokenId');
    }

    const read = this.readContract(chainId);
    let owner: string;
    try {
      owner = String(await read.ownerOf(tid)).trim().toLowerCase();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/ERC721: invalid token ID|nonexistent token/i.test(msg)) {
        throw new BadRequestException(
          `Token #${tid} is not minted on chain (may already be burned).`,
        );
      }
      throw new InternalServerErrorException(
        `Could not resolve owner for token #${tid}: ${msg}`,
      );
    }

    if (expectedOwner && ADDR.test(expectedOwner.trim())) {
      const expected = expectedOwner.trim().toLowerCase();
      if (expected !== owner) {
        throw new BadRequestException(
          'On-chain owner changed before burn — refresh the page and retry.',
        );
      }
    }

    const custody = await this.getCustodyWalletAddress(chainId);
    const minterProvider = this.chainConfig.createJsonRpcProvider(chainId);
    const minterWallet = new Wallet(this.ownerPrivateKey(), minterProvider);
    const minterAddress = (await minterWallet.getAddress()).toLowerCase();

    let signerKey: string;
    if (owner === custody) {
      signerKey = this.custodyPrivateKey();
    } else if (owner === minterAddress) {
      signerKey = this.ownerPrivateKey();
    } else {
      throw new BadRequestException(
        `Token #${tid} must be in platform custody to burn (owner=${owner}). Transfer it to custody first.`,
      );
    }

    const provider = this.chainConfig.createJsonRpcProvider(chainId);
    const wallet = new Wallet(signerKey, provider);
    const contract = new Contract(
      this.chainConfig.getRwaAddress(chainId),
      TOKENABLE_RWA_ABI,
      wallet,
    );

    return this.withSignerLock(chainId, signerKey, async () => {
      try {
        const tx = await contract.burn(tid);
        this.logger.log(`burn tx submitted: ${tx.hash} token #${tid}`);
        const receipt = await tx.wait();
        if (!receipt?.hash) {
          throw new InternalServerErrorException('Burn transaction failed');
        }
        await this.ownerIndex.recordBurn(
          this.chainConfig.getRwaAddress(chainId),
          tid,
        );
        return { txHash: receipt.hash };
      } catch (e) {
        if (e instanceof InternalServerErrorException) throw e;
        const msg = e instanceof Error ? e.message : String(e);
        if (/ERC721: invalid token ID|nonexistent token/i.test(msg)) {
          throw new BadRequestException(
            `Token #${tid} is not minted on chain (may already be burned).`,
          );
        }
        if (/not token owner or approved/i.test(msg)) {
          throw new BadRequestException(
            `Token #${tid} is not owned or approved by the platform burn wallet.`,
          );
        }
        throw new InternalServerErrorException(`Burn transaction reverted: ${msg}`);
      }
    });
  }

  // ─── AccessControl role management (DEFAULT_ADMIN_ROLE signer) ─────────────

  private async assertAdminRoleSigner(
    contract: Contract,
    signerAddress: string,
  ): Promise<void> {
    const adminRole = await contract.DEFAULT_ADMIN_ROLE();
    const ok = await contract.hasRole(adminRole, signerAddress);
    if (!ok) {
      throw new InternalServerErrorException(
        `RWA_ADMIN_PRIVATE_KEY wallet (${signerAddress}) lacks DEFAULT_ADMIN_ROLE — cannot grant or revoke roles on-chain.`,
      );
    }
  }

  private async resolveRoleHash(
    contract: Contract,
    role: 'default_admin' | 'minter' | 'pauser',
  ): Promise<string> {
    switch (role) {
      case 'default_admin':
        return String(await contract.DEFAULT_ADMIN_ROLE());
      case 'minter':
        return String(await contract.MINTER_ROLE());
      case 'pauser':
        return String(await contract.PAUSER_ROLE());
      default:
        throw new BadRequestException('Invalid role');
    }
  }

  async getWalletRoleStatus(
    walletAddress: string,
    chainId = this.chainConfig.getDefaultChainId(),
  ): Promise<{
    walletAddress: string;
    roles: Record<'default_admin' | 'minter' | 'pauser', boolean>;
  }> {
    const wallet = walletAddress.trim().toLowerCase();
    if (!ADDR.test(wallet)) {
      throw new BadRequestException('Invalid wallet address');
    }

    const contract = this.readContract(chainId);
    const [defaultAdmin, minter, pauser] = await Promise.all([
      contract.hasRole(await contract.DEFAULT_ADMIN_ROLE(), wallet),
      contract.hasRole(await contract.MINTER_ROLE(), wallet),
      contract.hasRole(await contract.PAUSER_ROLE(), wallet),
    ]);

    return {
      walletAddress: wallet,
      roles: {
        default_admin: Boolean(defaultAdmin),
        minter: Boolean(minter),
        pauser: Boolean(pauser),
      },
    };
  }

  async grantAccessRole(
    walletAddress: string,
    role: 'default_admin' | 'minter' | 'pauser',
    chainId = this.chainConfig.getDefaultChainId(),
  ): Promise<{ txHash: string; role: string; walletAddress: string }> {
    const wallet = walletAddress.trim().toLowerCase();
    if (!ADDR.test(wallet)) {
      throw new BadRequestException('Invalid wallet address');
    }

    const contract = this.signedAdminContract(chainId);
    const signer = contract.runner;
    if (!signer || !('getAddress' in signer)) {
      throw new InternalServerErrorException('Admin signer unavailable');
    }
    const signerAddress = (await (signer as Wallet).getAddress()).toLowerCase();
    await this.assertAdminRoleSigner(contract, signerAddress);

    const roleHash = await this.resolveRoleHash(contract, role);
    const already = await contract.hasRole(roleHash, wallet);
    if (already) {
      throw new BadRequestException(`Wallet already has role "${role}"`);
    }

    return this.withSignerLock(chainId, this.adminPrivateKey(), async () => {
      try {
        const tx = await contract.grantRole(roleHash, wallet);
        this.logger.log(`grantRole tx submitted: ${tx.hash} role=${role} → ${wallet}`);
        const receipt = await tx.wait();
        if (!receipt?.hash) {
          throw new InternalServerErrorException('grantRole transaction failed');
        }
        return { txHash: receipt.hash, role, walletAddress: wallet };
      } catch (e) {
        if (e instanceof BadRequestException || e instanceof InternalServerErrorException) throw e;
        const msg = e instanceof Error ? e.message : String(e);
        throw new InternalServerErrorException(`grantRole reverted: ${msg}`);
      }
    });
  }

  async revokeAccessRole(
    walletAddress: string,
    role: 'default_admin' | 'minter' | 'pauser',
    chainId = this.chainConfig.getDefaultChainId(),
  ): Promise<{ txHash: string; role: string; walletAddress: string }> {
    const wallet = walletAddress.trim().toLowerCase();
    if (!ADDR.test(wallet)) {
      throw new BadRequestException('Invalid wallet address');
    }

    const contract = this.signedAdminContract(chainId);
    const signer = contract.runner;
    if (!signer || !('getAddress' in signer)) {
      throw new InternalServerErrorException('Admin signer unavailable');
    }
    const signerAddress = (await (signer as Wallet).getAddress()).toLowerCase();
    await this.assertAdminRoleSigner(contract, signerAddress);

    const roleHash = await this.resolveRoleHash(contract, role);
    const has = await contract.hasRole(roleHash, wallet);
    if (!has) {
      throw new BadRequestException(`Wallet does not have role "${role}"`);
    }

    return this.withSignerLock(chainId, this.adminPrivateKey(), async () => {
      try {
        const tx = await contract.revokeRole(roleHash, wallet);
        this.logger.log(`revokeRole tx submitted: ${tx.hash} role=${role} ← ${wallet}`);
        const receipt = await tx.wait();
        if (!receipt?.hash) {
          throw new InternalServerErrorException('revokeRole transaction failed');
        }
        return { txHash: receipt.hash, role, walletAddress: wallet };
      } catch (e) {
        if (e instanceof BadRequestException || e instanceof InternalServerErrorException) throw e;
        const msg = e instanceof Error ? e.message : String(e);
        throw new InternalServerErrorException(`revokeRole reverted: ${msg}`);
      }
    });
  }
}
