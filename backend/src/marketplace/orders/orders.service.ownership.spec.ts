import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderSide, OrderStatus } from '../entities/order.entity';

describe('OrdersService ownership after settle', () => {
  const orderRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 0 }),
  };
  const ownerIndex = {
    recordOwner: jest.fn().mockResolvedValue(undefined),
  };
  const portfolioHoldings = {
    seedMarketplaceBuyCostBasis: jest.fn().mockResolvedValue(undefined),
  };
  const portfolioSnapshots = {
    refreshCurrentSlotSnapshot: jest.fn().mockResolvedValue(undefined),
    refreshCurrentSlotSnapshots: jest.fn().mockResolvedValue(undefined),
  };
  const notifications = {
    notifyTradeSettled: jest.fn().mockResolvedValue(undefined),
  };
  const partners = {
    resolveDisplayNamesByWallets: jest
      .fn()
      .mockResolvedValue(new Map<string, string>()),
  };
  const vault = {
    getSettlementPolicy: jest.fn().mockResolvedValue('standard'),
    getVaultDisplayByTokenIds: jest.fn().mockResolvedValue(new Map()),
  };
  const selfVaultSettlements = {
    createFromFulfilledAsk: jest.fn().mockResolvedValue(undefined),
    isFullPlatformTakeAsk: jest.fn().mockReturnValue(false),
  };
  const collectionService = {};
  const buyerListingAlerts = {};
  const config = { get: jest.fn() };
  const chainConfig = {
    getDefaultChainId: jest.fn().mockReturnValue(84532),
    getRwaAddress: jest.fn().mockReturnValue('0xrwa'),
    createJsonRpcProvider: jest.fn(),
  };
  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(
      orderRepo as never,
      config as never,
      collectionService as never,
      chainConfig as never,
      portfolioHoldings as never,
      portfolioSnapshots as never,
      partners as never,
      notifications as never,
      buyerListingAlerts as never,
      vault as never,
      selfVaultSettlements as never,
      ownerIndex as never,
    );
    (
      service as unknown as {
        assertSeaportOrderFilledOnChain: () => Promise<void>;
      }
    ).assertSeaportOrderFilledOnChain = jest.fn().mockResolvedValue(undefined);
  });

  it('fulfillOrder ask writes owner_wallet for buyer immediately', async () => {
    const ask = {
      id: '1',
      orderHash: '0xask',
      status: OrderStatus.ACTIVE,
      side: OrderSide.ASK,
      tokenContract: '0xRwa',
      tokenId: '42',
      considerationAmount: '1000000',
      offerer: '0xSeller00000000000000000000000000000001',
      parameters: {
        offer: [{ itemType: 2, identifier: '42' }],
        consideration: [{ itemType: 1, startAmount: '1000000' }],
      },
      updatedAt: new Date(),
    };
    orderRepo.findOne.mockResolvedValue({ ...ask });
    orderRepo.save.mockImplementation(async (o: typeof ask) => o);

    await service.fulfillOrder(
      '0xask',
      '0xBuyer000000000000000000000000000000001',
      11155111,
    );

    expect(ownerIndex.recordOwner).toHaveBeenCalledWith(
      '0xRwa',
      '42',
      '0xbuyer000000000000000000000000000000001',
    );
    expect(portfolioHoldings.seedMarketplaceBuyCostBasis).toHaveBeenCalled();
  });

  it('fulfillMatchedPair writes owner_wallet to bid.offerer', async () => {
    const ask = {
      id: '1',
      orderHash: '0xask',
      status: OrderStatus.ACTIVE,
      side: OrderSide.ASK,
      tokenContract: '0xrwa',
      tokenId: '7',
      considerationAmount: '2000000',
      offerer: '0xSeller00000000000000000000000000000001',
      collectionKey: 'abc',
      parameters: {
        offer: [{ itemType: 2, identifier: '7' }],
        consideration: [{ itemType: 1, startAmount: '2000000' }],
      },
      updatedAt: new Date(),
    };
    const bid = {
      id: '2',
      orderHash: '0xbid',
      status: OrderStatus.ACTIVE,
      side: OrderSide.BID,
      tokenContract: '0xrwa',
      tokenId: '7',
      considerationAmount: '2000000',
      offerer: '0xBuyer000000000000000000000000000000002',
      collectionKey: 'abc',
      parameters: {
        offer: [{ itemType: 1, startAmount: '2000000' }],
        consideration: [{ itemType: 2, identifier: '7' }],
      },
    };
    orderRepo.findOne
      .mockResolvedValueOnce({ ...ask })
      .mockResolvedValueOnce({ ...bid });
    orderRepo.save.mockResolvedValue([ask, bid]);

    await service.fulfillMatchedPair('0xask', '0xbid', 11155111);

    expect(ownerIndex.recordOwner).toHaveBeenCalledWith(
      '0xrwa',
      '7',
      '0xbuyer000000000000000000000000000000002',
    );
  });

  it('fulfillOrder ask settles when ownerOf is the buyer after a Seaport status miss', async () => {
    const ask = {
      id: '1',
      orderHash: '0xask',
      status: OrderStatus.ACTIVE,
      side: OrderSide.ASK,
      tokenContract: '0xRwa',
      tokenId: '42',
      considerationAmount: '1000000',
      offerer: '0xSeller00000000000000000000000000000001',
      parameters: {
        offer: [{ itemType: 2, identifier: '42' }],
        consideration: [{ itemType: 1, startAmount: '1000000' }],
      },
      updatedAt: new Date(),
    };
    orderRepo.findOne.mockResolvedValue({ ...ask });
    orderRepo.save.mockImplementation(async (o: typeof ask) => o);
    (
      service as unknown as { assertSeaportOrderFilledOnChain: jest.Mock }
    ).assertSeaportOrderFilledOnChain.mockRejectedValue(
      new BadRequestException('On-chain Seaport fill was not found'),
    );
    (
      service as unknown as {
        readOnChainRwaOwner: () => Promise<string>;
      }
    ).readOnChainRwaOwner = jest
      .fn()
      .mockResolvedValue('0xbuyer000000000000000000000000000000001');

    await service.fulfillOrder(
      '0xask',
      '0xBuyer000000000000000000000000000000001',
      11155111,
    );

    expect(ownerIndex.recordOwner).toHaveBeenCalledWith(
      '0xRwa',
      '42',
      '0xbuyer000000000000000000000000000000001',
    );
  });

  it('fulfillOrder does not write owner_wallet when Seaport did not fill', async () => {
    const ask = {
      id: '1',
      orderHash: '0xask',
      status: OrderStatus.ACTIVE,
      side: OrderSide.ASK,
      tokenContract: '0xRwa',
      tokenId: '42',
      considerationAmount: '1000000',
      offerer: '0xSeller00000000000000000000000000000001',
      parameters: {
        offer: [{ itemType: 2, identifier: '42' }],
      },
    };
    orderRepo.findOne.mockResolvedValue({ ...ask });
    (
      service as unknown as { assertSeaportOrderFilledOnChain: jest.Mock }
    ).assertSeaportOrderFilledOnChain.mockRejectedValue(
      new Error('On-chain Seaport fill was not found'),
    );

    await expect(
      service.fulfillOrder(
        '0xask',
        '0xBuyer000000000000000000000000000000001',
        11155111,
      ),
    ).rejects.toThrow(/not found/);

    expect(ownerIndex.recordOwner).not.toHaveBeenCalled();
    expect(orderRepo.save).not.toHaveBeenCalled();
  });

  it('cancels a leftover ask when the listing wallet is not the on-chain owner', async () => {
    const leftover = {
      orderHash: '0xstale',
      status: OrderStatus.ACTIVE,
      side: OrderSide.ASK,
      offerer: '0x2925a6fa34c2cf44b3d2857777d7a301077211f7',
      tokenId: '3',
      tokenContract: '0xrwa',
      parameters: {},
    };
    orderRepo.findOne.mockResolvedValue(leftover);
    orderRepo.save.mockImplementation(async (o: typeof leftover) => o);
    (
      service as unknown as {
        readOnChainRwaOwner: (c: string, t: string, chain: number) => Promise<string>;
      }
    ).readOnChainRwaOwner = jest
      .fn()
      .mockResolvedValue('0xc85b1530f8e272647c15f4100582d14a2d452256');

    await (
      service as unknown as {
        cancelActiveAskIfOffererUnowned: (
          c: string,
          t: string,
          chain: number,
        ) => Promise<void>;
      }
    ).cancelActiveAskIfOffererUnowned('0xrwa', '3', 11155111);

    expect(leftover.status).toBe(OrderStatus.CANCELLED);
    expect(orderRepo.save).toHaveBeenCalled();
  });
});
