import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Contract,
  Wallet,
  ZeroAddress,
  ZeroHash,
  getAddress,
  parseUnits,
} from 'ethers';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../../blockchain/chain-config.service';
import { OrdersService } from '../../marketplace/orders/orders.service';
import type { CreateOrderDto } from '../../marketplace/orders/dto/create-order.dto';
import type { Order } from '../../marketplace/entities/order.entity';

/** Seaport 1.5 — canonical address on EVM chains. */
export const SEAPORT_ADDRESS = '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC';

const ORDER_DURATION_SECONDS = 30 * 24 * 60 * 60;

const SEAPORT_COUNTER_ABI = [
  'function getCounter(address offerer) view returns (uint256)',
] as const;

const ERC721_APPROVAL_ABI = [
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved)',
] as const;

const SEAPORT_ORDER_TYPES: Record<
  string,
  Array<{ name: string; type: string }>
> = {
  OrderComponents: [
    { name: 'offerer', type: 'address' },
    { name: 'zone', type: 'address' },
    { name: 'offer', type: 'OfferItem[]' },
    { name: 'consideration', type: 'ConsiderationItem[]' },
    { name: 'orderType', type: 'uint8' },
    { name: 'startTime', type: 'uint256' },
    { name: 'endTime', type: 'uint256' },
    { name: 'zoneHash', type: 'bytes32' },
    { name: 'salt', type: 'uint256' },
    { name: 'conduitKey', type: 'bytes32' },
    { name: 'counter', type: 'uint256' },
  ],
  OfferItem: [
    { name: 'itemType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'identifierOrCriteria', type: 'uint256' },
    { name: 'startAmount', type: 'uint256' },
    { name: 'endAmount', type: 'uint256' },
  ],
  ConsiderationItem: [
    { name: 'itemType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'identifierOrCriteria', type: 'uint256' },
    { name: 'startAmount', type: 'uint256' },
    { name: 'endAmount', type: 'uint256' },
    { name: 'recipient', type: 'address' },
  ],
};

/**
 * Server-side Seaport ask: approve RWA → sign EIP-712 with partner key → persist via OrdersService.
 * Mirrors frontend submitAskListing + platformFee.
 */
@Injectable()
export class PartnerSeaportAskService {
  private readonly logger = new Logger(PartnerSeaportAskService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly chainConfig: ChainConfigService,
    private readonly orders: OrdersService,
  ) {}

  private platformFeeBps(): number {
    const recipient = (
      this.config.get<string>('PLATFORM_FEE_RECIPIENT') ?? ''
    )
      .trim()
      .toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) return 0;
    const raw = parseInt(
      this.config.get<string>('PLATFORM_FEE_BPS') ?? '250',
      10,
    );
    return Number.isFinite(raw) && raw >= 0 && raw <= 5000 ? raw : 250;
  }

  private platformFeeRecipient(): string | null {
    const recipient = (
      this.config.get<string>('PLATFORM_FEE_RECIPIENT') ?? ''
    )
      .trim()
      .toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) return null;
    if (this.platformFeeBps() <= 0) return null;
    return recipient;
  }

  buildConsiderationPayload(
    totalPriceUnits: bigint,
    sellerAddress: string,
    usdcAddress: string,
  ): Array<{
    itemType: number;
    token: string;
    identifierOrCriteria: string;
    startAmount: string;
    endAmount: string;
    recipient: string;
  }> {
    const feeRecipient = this.platformFeeRecipient();
    const bps = this.platformFeeBps();
    let sellerAmount = totalPriceUnits;
    let feeAmount = 0n;
    if (feeRecipient && bps > 0) {
      feeAmount = (totalPriceUnits * BigInt(bps)) / 10_000n;
      sellerAmount = totalPriceUnits - feeAmount;
    }
    const items = [
      {
        itemType: 1,
        token: usdcAddress,
        identifierOrCriteria: '0',
        startAmount: String(sellerAmount),
        endAmount: String(sellerAmount),
        recipient: getAddress(sellerAddress),
      },
    ];
    if (feeRecipient && feeAmount > 0n) {
      items.push({
        itemType: 1,
        token: usdcAddress,
        identifierOrCriteria: '0',
        startAmount: String(feeAmount),
        endAmount: String(feeAmount),
        recipient: getAddress(feeRecipient),
      });
    }
    return items;
  }

  async ensureSeaportApproval(
    privateKey: string,
    chainId: SupportedChainId,
  ): Promise<void> {
    const provider = this.chainConfig.createJsonRpcProvider(chainId);
    const wallet = new Wallet(privateKey, provider);
    const rwa = this.chainConfig.getRwaAddress(chainId);
    const nft = new Contract(rwa, ERC721_APPROVAL_ABI, wallet);
    const approved = await nft.isApprovedForAll(
      await wallet.getAddress(),
      SEAPORT_ADDRESS,
    );
    if (approved) return;
    const tx = await nft.setApprovalForAll(SEAPORT_ADDRESS, true);
    await tx.wait();
    this.logger.log(
      `setApprovalForAll(Seaport) for partner ${await wallet.getAddress()} chain=${chainId}`,
    );
  }

  async createAskListing(params: {
    privateKey: string;
    tokenId: string;
    priceUsdc: string;
    chainId: SupportedChainId;
  }): Promise<Order> {
    const priceRaw = String(params.priceUsdc ?? '').trim();
    const n = Number(priceRaw);
    if (!Number.isFinite(n) || n <= 0) {
      throw new BadRequestException(`Invalid list price: ${params.priceUsdc}`);
    }

    const chainId = params.chainId;
    const provider = this.chainConfig.createJsonRpcProvider(chainId);
    const wallet = new Wallet(params.privateKey, provider);
    const offerer = (await wallet.getAddress()).toLowerCase();
    const rwaAddress = this.chainConfig.getRwaAddress(chainId);
    const usdcAddress = this.chainConfig.getUsdcAddress(chainId);
    const tokenIdStr = String(params.tokenId).replace(/^0+/, '') || '0';

    await this.ensureSeaportApproval(params.privateKey, chainId);

    const seaport = new Contract(SEAPORT_ADDRESS, SEAPORT_COUNTER_ABI, provider);
    const counter: bigint = await seaport.getCounter(offerer);
    const block = await provider.getBlock('latest');
    const now = BigInt(block?.timestamp ?? Math.floor(Date.now() / 1000));
    const endTime = now + BigInt(ORDER_DURATION_SECONDS);
    const salt = BigInt(Math.floor(Math.random() * 1_000_000_000_000));
    const priceInUnits = parseUnits(priceRaw, 6);
    const considerationPayload = this.buildConsiderationPayload(
      priceInUnits,
      offerer,
      usdcAddress,
    );

    const typedMessage = {
      offerer: getAddress(offerer),
      zone: ZeroAddress,
      offer: [
        {
          itemType: 2,
          token: getAddress(rwaAddress),
          identifierOrCriteria: BigInt(tokenIdStr),
          startAmount: 1n,
          endAmount: 1n,
        },
      ],
      consideration: considerationPayload.map((c) => ({
        itemType: c.itemType,
        token: getAddress(c.token),
        identifierOrCriteria: BigInt(c.identifierOrCriteria),
        startAmount: BigInt(c.startAmount),
        endAmount: BigInt(c.endAmount),
        recipient: getAddress(c.recipient),
      })),
      orderType: 0,
      startTime: now,
      endTime,
      zoneHash: ZeroHash,
      salt,
      conduitKey: ZeroHash,
      counter,
    };

    const domain = {
      name: 'Seaport',
      version: '1.5',
      chainId,
      verifyingContract: SEAPORT_ADDRESS,
    };

    const signature = await wallet.signTypedData(
      domain,
      SEAPORT_ORDER_TYPES,
      typedMessage,
    );

    const dto: CreateOrderDto = {
      side: 'ask',
      parameters: {
        offerer: getAddress(offerer),
        zone: ZeroAddress,
        zoneHash: ZeroHash,
        startTime: String(now),
        endTime: String(endTime),
        orderType: 0,
        offer: [
          {
            itemType: 2,
            token: rwaAddress,
            identifierOrCriteria: tokenIdStr,
            startAmount: '1',
            endAmount: '1',
          },
        ],
        consideration: considerationPayload,
        totalOriginalConsiderationItems: considerationPayload.length,
        salt: String(salt),
        conduitKey: ZeroHash,
        counter: String(counter),
      },
      signature,
      tokenContract: rwaAddress,
      tokenId: tokenIdStr,
      considerationToken: usdcAddress,
      considerationAmount: String(priceInUnits),
    };

    return this.orders.createOrder(dto, chainId);
  }
}
