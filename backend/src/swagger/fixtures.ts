/** Swagger / 로컬 테스트용 고정 값 (Ethereum Sepolia `.env` 와 맞춤). */
export const SWAGGER_FIXTURES = {
  wallet: '0xAc5EBB0573Ca515741D8986a1bA1CDC178F46539',
  walletAlt: '0xD5abDD307414718C59949Ac5465930a1F8a52691',
  usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  rwaContract: '0x11117C44584dE2912689b62ddEE85ACa3dA17c28',
  zero: '0x0000000000000000000000000000000000000000',
  zoneHash:
    '0x0000000000000000000000000000000000000000000000000000000000000000',
  conduitKey:
    '0x0000000000000000000000000000000000000000000000000000000000000000',
  collectionKey:
    'ab5f1f362c9a16151b10159d3d5ca465fe8e23b7ff20169d20bf92188e292bfa',
  collectionKeyAlt:
    '22028c1276253bbe8118fe2015d8d06bace4d30ed3664c2aacc9943b4ee8aaed',
  tokenId: 1,
  tokenIds: [1, 2, 3],
  certNumber: '83179580',
  psaSpecId: '284890',
  psaOrderNumber: '123456789',
  psaSubmissionNumber: '987654321',
  orderHash:
    '0x1111111111111111111111111111111111111111111111111111111111111111',
  orderHashBid:
    '0x2222222222222222222222222222222222222222222222222222222222222222',
  ipfsImage:
    'ipfs://bafybeibxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/image.png',
  coverUrl: 'https://gateway.pinata.cloud/ipfs/bafybeib/example/cover.png',
  signature: '0x' + 'ab'.repeat(32),
} as const;
