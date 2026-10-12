import {
  buildSeaportOrderComponents,
  seaportHashableParameters,
} from './seaport-order-hash.util';

describe('seaport-order-hash.util', () => {
  it('strips server-only keys before hashing', () => {
    const params = {
      offerer: '0x0000000000000000000000000000000000000001',
      zone: '0x0000000000000000000000000000000000000000',
      offer: [],
      consideration: [],
      orderType: 0,
      startTime: '1',
      endTime: '2',
      zoneHash:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      salt: '3',
      conduitKey:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      counter: '0',
      _settlementPolicy: 'self_vault_hold',
      _filledByBuyer: '0xabc',
    };
    const hashable = seaportHashableParameters(params);
    expect(hashable).not.toHaveProperty('_settlementPolicy');
    expect(hashable).not.toHaveProperty('_filledByBuyer');
    expect(buildSeaportOrderComponents(hashable).counter).toBe(0n);
  });
});
