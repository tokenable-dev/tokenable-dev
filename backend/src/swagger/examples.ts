import { SWAGGER_FIXTURES as F } from './fixtures';

const seaportTimes = {
  startTime: '1711000000',
  endTime: '1713592000',
};

const askParameters = {
  offerer: F.wallet,
  zone: F.zero,
  offer: [
    {
      itemType: 2,
      token: F.rwaContract,
      identifierOrCriteria: '1',
      startAmount: '1',
      endAmount: '1',
    },
  ],
  consideration: [
    {
      itemType: 1,
      token: F.usdc,
      identifierOrCriteria: '0',
      startAmount: '150000000',
      endAmount: '150000000',
      recipient: F.wallet,
    },
  ],
  orderType: 0,
  ...seaportTimes,
  zoneHash: F.zoneHash,
  salt: '1234567890123',
  conduitKey: F.conduitKey,
  totalOriginalConsiderationItems: 1,
  counter: '0',
};

/** `POST /marketplace/orders` — ask listing */
export const createAskOrderExample = {
  side: 'ask' as const,
  tokenContract: F.rwaContract,
  tokenId: '1',
  considerationToken: F.usdc,
  considerationAmount: '150000000',
  parameters: askParameters,
  signature: F.signature,
};

/** `POST /marketplace/orders` — collection criteria bid */
export const createCollectionBidExample = {
  side: 'bid' as const,
  collectionKey: F.collectionKey,
  tokenContract: F.rwaContract,
  tokenId: '0',
  considerationToken: F.usdc,
  considerationAmount: '150000000',
  parameters: {
    offerer: F.wallet,
    zone: F.zero,
    offer: [
      {
        itemType: 1,
        token: F.usdc,
        identifierOrCriteria: '0',
        startAmount: '150000000',
        endAmount: '150000000',
      },
    ],
    consideration: [
      {
        itemType: 4,
        token: F.rwaContract,
        identifierOrCriteria:
          '0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        startAmount: '1',
        endAmount: '1',
        recipient: F.wallet,
      },
    ],
    orderType: 2,
    ...seaportTimes,
    zoneHash: F.zoneHash,
    salt: '2234567890123',
    conduitKey: F.conduitKey,
    totalOriginalConsiderationItems: 1,
    counter: '0',
  },
  signature: F.signature,
};

export const replaceListingExample = {
  oldOrderHash: F.orderHash,
  callerAddress: F.wallet,
  order: {
    ...createAskOrderExample,
    considerationAmount: '145000000',
    parameters: {
      ...askParameters,
      salt: '3234567890123',
      consideration: [
        {
          ...askParameters.consideration[0],
          startAmount: '145000000',
          endAmount: '145000000',
        },
      ],
    },
  },
};

export const replaceBidExample = {
  oldOrderHash: F.orderHashBid,
  callerAddress: F.wallet,
  order: {
    ...createCollectionBidExample,
    considerationAmount: '160000000',
    parameters: {
      ...createCollectionBidExample.parameters,
      salt: '4234567890123',
      offer: [
        {
          ...createCollectionBidExample.parameters.offer[0],
          startAmount: '160000000',
          endAmount: '160000000',
        },
      ],
    },
  },
};

export const SWAGGER_BODY_EXAMPLES = {
  linkWallet: { address: F.wallet },
  ordersBatchByToken: { tokenIds: F.tokenIds },
  fulfillMatchedPair: {
    askOrderHash: F.orderHash,
    bidOrderHash: F.orderHashBid,
  },
  batchMarketSnapshots: {
    collectionKeys: [F.collectionKey, F.collectionKeyAlt],
    priceHistoryDuration: '90d',
  },
  portfolioMarketBatch: {
    collectionKeys: [F.collectionKey],
    priceHistoryDuration: '365d',
  },
  tokenCollectionKeys: { tokenIds: F.tokenIds },
  mintPreviews: { tokenIds: [101, 102, 103] },
  rwaMetadataBatch: { tokenIds: F.tokenIds },
  mediaResolve: { uris: [F.ipfsImage, F.coverUrl] },
  portfolioHide: { walletAddress: F.wallet, tokenId: F.tokenId },
  certMarketTrace: {
    certNumber: F.certNumber,
    historyMaxCalendarDays: 90,
    scrapePsaSpecImage: false,
  },
  adminSetCover: {
    adminWallet: F.walletAlt,
    coverImageUrl: F.coverUrl,
  },
  adminCoverFromToken: {
    adminWallet: F.walletAlt,
    tokenId: '1',
    save: false,
  },
  adminDeleteCollection: {
    adminWallet: F.walletAlt,
    confirmCollectionKey: F.collectionKey,
  },
  psaAnalyzeByCert: { certNumber: F.certNumber },
  psaOrderProgress: { orderNumber: F.psaOrderNumber },
  psaSubmissionProgress: { submissionNumber: F.psaSubmissionNumber },
  uploadRwa: {
    name: 'PSA 10 Sample Card',
    description: '로컬 Swagger 테스트용 메타데이터',
    attributes: [{ trait_type: 'Grade', value: '10' }],
  },
} as const;
