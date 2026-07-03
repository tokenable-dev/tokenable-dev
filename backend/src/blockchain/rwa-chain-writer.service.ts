import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, Wallet, ZeroHash } from 'ethers';
import { TOKENABLE_RWA_ABI } from './abis/tokenable-rwa.abi';
import { ChainConfigService } from './chain-config.service';

const ADDR = /^0x[a-fA-F0-9]{40}$/;

/**
 * Backend signer service for TokenableRWA write operations.
 *
 * Uses RWA_OWNER_PRIVATE_KEY for mint/mintBatch (MINTER_ROLE) and adminBurn
 * (BURNER_ROLE). In V1 both roles are granted to the same deployer EOA at
 * initialize() time; they can be split across separate services/keys later
 * without a contract change since they are distinct AccessControl roles.
 */
@Injectable()
export class RwaChainWriterService {
  private readonly logger = new Logger(RwaChainWriterService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly chainConfig: ChainConfigService,
  ) {}

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
  // vaultRef is computed by VaultService.computeVaultRef() from the PSA cert
  // number (the permanent physical-asset identity) — never from tokenURI,
  // which changes on every mint cycle and would defeat the contract's
  // anti-double-claim check across vault re-deposits.

  async mintTo(
    to: string,
    tokenURI: string,
    vaultRef: string,
    chainId = this.chainConfig.getDefaultChainId(),
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

    const contract = this.signedContract(chainId);
    const tx = await contract.mint(recipient, uri, vaultRef);
    this.logger.log(`mint tx submitted: ${tx.hash} → ${recipient}`);
    const receipt = await tx.wait();
    if (!receipt?.hash) {
      throw new InternalServerErrorException('Mint transaction failed');
    }

    let tokenId = -1;
    for (const log of receipt.logs ?? []) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed?.name === 'Minted') {
          tokenId = Number(parsed.args.tokenId);
          break;
        }
      } catch {
        /* skip unrelated logs */
      }
    }
    if (!Number.isFinite(tokenId) || tokenId < 0) {
      const totalMinted = Number(await contract.totalMinted());
      tokenId = totalMinted; // last minted
    }

    return { tokenId, txHash: receipt.hash };
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

    try {
      const tx = await contract['safeTransferFrom'](custody, recipient, tid);
      this.logger.log(
        `custody transfer tx submitted: ${tx.hash} token #${tid} → ${recipient}`,
      );
      const receipt = await tx.wait();
      if (!receipt?.hash) {
        throw new InternalServerErrorException('Transfer transaction failed');
      }
      return { txHash: receipt.hash };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new InternalServerErrorException(`Transfer transaction reverted: ${msg}`);
    }
  }

  // ─── Admin burn ────────────────────────────────────────────────────────────

  /**
   * @param expectedOwner  Pass address(0x0) / null to skip ownership check.
   *                       Recommended: pass the known owner to prevent race-condition burns.
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

    const contract = this.signedContract(chainId);
    const signer = contract.runner;
    if (!signer || !('getAddress' in signer)) {
      throw new InternalServerErrorException('Burn signer unavailable');
    }
    const signerAddress = await (signer as Wallet).getAddress();
    const burnerRole = await contract.BURNER_ROLE();
    const hasBurner = await contract.hasRole(burnerRole, signerAddress);
    if (!hasBurner) {
      throw new InternalServerErrorException(
        'Backend wallet lacks BURNER_ROLE on TokenableRWA. From contracts/: pnpm grant-burner:amoy (or grant-burner:polygon).',
      );
    }

    // Normalise: use address(0) to skip the on-chain ownership assertion when no
    // expected owner is known, rather than sending a random/invalid address.
    const ownerArg =
      expectedOwner && ADDR.test(expectedOwner.trim())
        ? expectedOwner.trim()
        : '0x0000000000000000000000000000000000000000';

    try {
      const tx = await contract.adminBurn(tid, ownerArg);
      this.logger.log(`adminBurn tx submitted: ${tx.hash} token #${tid}`);
      const receipt = await tx.wait();
      if (!receipt?.hash) {
        throw new InternalServerErrorException('Burn transaction failed');
      }
      return { txHash: receipt.hash };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/OwnerMismatch/i.test(msg)) {
        throw new BadRequestException(
          'On-chain owner changed before burn — refresh the page and retry.',
        );
      }
      if (/ERC721: invalid token ID|nonexistent token/i.test(msg)) {
        throw new BadRequestException(
          `Token #${tid} is not minted on chain (may already be burned).`,
        );
      }
      throw new InternalServerErrorException(`Burn transaction reverted: ${msg}`);
    }
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
    role: 'default_admin' | 'minter' | 'burner' | 'pauser',
  ): Promise<string> {
    switch (role) {
      case 'default_admin':
        return String(await contract.DEFAULT_ADMIN_ROLE());
      case 'minter':
        return String(await contract.MINTER_ROLE());
      case 'burner':
        return String(await contract.BURNER_ROLE());
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
    roles: Record<'default_admin' | 'minter' | 'burner' | 'pauser', boolean>;
  }> {
    const wallet = walletAddress.trim().toLowerCase();
    if (!ADDR.test(wallet)) {
      throw new BadRequestException('Invalid wallet address');
    }

    const contract = this.readContract(chainId);
    const [defaultAdmin, minter, burner, pauser] = await Promise.all([
      contract.hasRole(await contract.DEFAULT_ADMIN_ROLE(), wallet),
      contract.hasRole(await contract.MINTER_ROLE(), wallet),
      contract.hasRole(await contract.BURNER_ROLE(), wallet),
      contract.hasRole(await contract.PAUSER_ROLE(), wallet),
    ]);

    return {
      walletAddress: wallet,
      roles: {
        default_admin: Boolean(defaultAdmin),
        minter: Boolean(minter),
        burner: Boolean(burner),
        pauser: Boolean(pauser),
      },
    };
  }

  async grantAccessRole(
    walletAddress: string,
    role: 'default_admin' | 'minter' | 'burner' | 'pauser',
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

    try {
      const tx = await contract.grantRole(roleHash, wallet);
      this.logger.log(`grantRole tx submitted: ${tx.hash} role=${role} → ${wallet}`);
      const receipt = await tx.wait();
      if (!receipt?.hash) {
        throw new InternalServerErrorException('grantRole transaction failed');
      }
      return { txHash: receipt.hash, role, walletAddress: wallet };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new InternalServerErrorException(`grantRole reverted: ${msg}`);
    }
  }

  async revokeAccessRole(
    walletAddress: string,
    role: 'default_admin' | 'minter' | 'burner' | 'pauser',
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

    try {
      const tx = await contract.revokeRole(roleHash, wallet);
      this.logger.log(`revokeRole tx submitted: ${tx.hash} role=${role} ← ${wallet}`);
      const receipt = await tx.wait();
      if (!receipt?.hash) {
        throw new InternalServerErrorException('revokeRole transaction failed');
      }
      return { txHash: receipt.hash, role, walletAddress: wallet };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new InternalServerErrorException(`revokeRole reverted: ${msg}`);
    }
  }
}
