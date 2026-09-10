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
  };
  const p2pListings = {};

  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(
      orderRepo as never,
      p2pListings as never,
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
});
