import { Contract, getAddress, type Provider } from 'ethers';

/** Seaport 1.5 — canonical address on EVM chains. */
export const SEAPORT_CANONICAL_ADDRESS =
  '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC';

const SEAPORT_GET_ORDER_HASH_ABI = [
  'function getOrderHash((address offerer, address zone, (uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount)[] offer, (uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount, address recipient)[] consideration, uint8 orderType, uint256 startTime, uint256 endTime, bytes32 zoneHash, uint256 salt, bytes32 conduitKey, uint256 counter) orderComponents) view returns (bytes32)',
] as const;

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

function bigIntish(v: unknown): bigint {
  if (typeof v === 'bigint') return v;
  const s = String(v ?? '').trim();
  if (!s) return 0n;
  return BigInt(s);
}

function ethAddress(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return getAddress(ZERO_ADDR);
  return getAddress(s);
}

function bytes32(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s || !/^0x[a-fA-F0-9]{64}$/.test(s)) return ZERO_BYTES32;
  return s;
}

/** Strip server-only keys before hashing / on-chain getOrderHash. */
export function seaportHashableParameters(
  parameters: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parameters)) {
    if (k.startsWith('_')) continue;
    out[k] = v;
  }
  return out;
}

export function buildSeaportOrderComponents(
  parameters: Record<string, unknown>,
): Record<string, unknown> {
  const offer = (parameters['offer'] as unknown[]) ?? [];
  const consideration = (parameters['consideration'] as unknown[]) ?? [];
  return {
    offerer: ethAddress(parameters['offerer']),
    zone: ethAddress(parameters['zone'] ?? ZERO_ADDR),
    offer: offer.map((item) => {
      const it = (item ?? {}) as Record<string, unknown>;
      return {
        itemType: Number(it['itemType'] ?? 0),
        token: ethAddress(it['token']),
        identifierOrCriteria: bigIntish(it['identifierOrCriteria']),
        startAmount: bigIntish(it['startAmount']),
        endAmount: bigIntish(it['endAmount']),
      };
    }),
    consideration: consideration.map((item) => {
      const it = (item ?? {}) as Record<string, unknown>;
      return {
        itemType: Number(it['itemType'] ?? 0),
        token: ethAddress(it['token']),
        identifierOrCriteria: bigIntish(it['identifierOrCriteria']),
        startAmount: bigIntish(it['startAmount']),
        endAmount: bigIntish(it['endAmount']),
        recipient: ethAddress(it['recipient']),
      };
    }),
    orderType: Number(parameters['orderType'] ?? 0),
    startTime: bigIntish(parameters['startTime']),
    endTime: bigIntish(parameters['endTime']),
    zoneHash: bytes32(parameters['zoneHash']),
    salt: bigIntish(parameters['salt']),
    conduitKey: bytes32(parameters['conduitKey']),
    counter: bigIntish(parameters['counter'] ?? 0),
  };
}

/** Canonical Seaport bytes32 order hash for getOrderStatus / getOrderHash. */
export async function seaportOrderHashFromParameters(
  parameters: Record<string, unknown>,
  provider: Provider,
): Promise<string> {
  const hashable = seaportHashableParameters(parameters);
  const seaport = new Contract(
    SEAPORT_CANONICAL_ADDRESS,
    SEAPORT_GET_ORDER_HASH_ABI,
    provider,
  );
  const components = buildSeaportOrderComponents(hashable);
  const hash: string = await seaport.getOrderHash(components);
  return hash.toLowerCase();
}
