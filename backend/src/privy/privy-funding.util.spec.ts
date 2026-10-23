import {
  SEPOLIA_FUNDING_CAIP2,
  POLYGON_FUNDING_CAIP2,
  assessPrivyFundingReadiness,
  ETHEREUM_FUNDING_CAIP2,
  isTokenableFundingChainAligned,
  parseCaip2EvmChainId,
  PRODUCTION_FUNDING_CAIP2,
  resolveFundingTargetCaip2,
  type PrivyAppSettingsForFunding,
} from './privy-funding.util';

function baseSettings(
  overrides: Partial<PrivyAppSettingsForFunding> = {},
): PrivyAppSettingsForFunding {
  return {
    fiat_on_ramp_enabled: false,
    funding_config: undefined,
    ...overrides,
  };
}

describe('parseCaip2EvmChainId', () => {
  it('parses eip155 chain ids', () => {
    expect(parseCaip2EvmChainId('eip155:1')).toBe(1);
    expect(parseCaip2EvmChainId('eip155:11155111')).toBe(11155111);
    expect(parseCaip2EvmChainId('eip155:137')).toBe(137);
  });

  it('returns null for invalid values', () => {
    expect(parseCaip2EvmChainId(undefined)).toBeNull();
    expect(parseCaip2EvmChainId('solana:mainnet')).toBeNull();
  });
});

describe('resolveFundingTargetCaip2', () => {
  const prevTarget = process.env.PRIVY_FUNDING_TARGET_CAIP2;

  afterEach(() => {
    if (prevTarget === undefined) {
      delete process.env.PRIVY_FUNDING_TARGET_CAIP2;
    } else {
      process.env.PRIVY_FUNDING_TARGET_CAIP2 = prevTarget;
    }
  });

  it('defaults to Sepolia when env is unset (Sepolia-first deploy)', () => {
    delete process.env.PRIVY_FUNDING_TARGET_CAIP2;
    expect(resolveFundingTargetCaip2()).toBe(SEPOLIA_FUNDING_CAIP2);
  });

  it('honors PRIVY_FUNDING_TARGET_CAIP2', () => {
    process.env.PRIVY_FUNDING_TARGET_CAIP2 = POLYGON_FUNDING_CAIP2;
    expect(resolveFundingTargetCaip2()).toBe(POLYGON_FUNDING_CAIP2);
  });
});

describe('isTokenableFundingChainAligned', () => {
  it('accepts Polygon, Sepolia, and Ethereum mainnet', () => {
    expect(isTokenableFundingChainAligned(POLYGON_FUNDING_CAIP2)).toBe(true);
    expect(isTokenableFundingChainAligned(SEPOLIA_FUNDING_CAIP2)).toBe(true);
    expect(isTokenableFundingChainAligned(ETHEREUM_FUNDING_CAIP2)).toBe(true);
    expect(isTokenableFundingChainAligned(PRODUCTION_FUNDING_CAIP2)).toBe(true);
    expect(isTokenableFundingChainAligned('eip155:42161')).toBe(false);
  });
});

describe('assessPrivyFundingReadiness', () => {
  const prevTarget = process.env.PRIVY_FUNDING_TARGET_CAIP2;

  afterEach(() => {
    if (prevTarget === undefined) {
      delete process.env.PRIVY_FUNDING_TARGET_CAIP2;
    } else {
      process.env.PRIVY_FUNDING_TARGET_CAIP2 = prevTarget;
    }
  });

  it('marks funding as not ready when dashboard has no methods', () => {
    process.env.PRIVY_FUNDING_TARGET_CAIP2 = POLYGON_FUNDING_CAIP2;
    const result = assessPrivyFundingReadiness(baseSettings());
    expect(result.ready).toBe(false);
    expect(result.moonpayEnabled).toBe(false);
    expect(result.dashboardChecklist.length).toBeGreaterThan(0);
    expect(result.targetFundingCaip2).toBe(POLYGON_FUNDING_CAIP2);
  });

  it('marks funding ready when MoonPay + Polygon USDC are configured', () => {
    process.env.PRIVY_FUNDING_TARGET_CAIP2 = POLYGON_FUNDING_CAIP2;
    const result = assessPrivyFundingReadiness(
      baseSettings({
        funding_config: {
          methods: ['moonpay'],
          options: [{ method: 'card', provider: 'moonpay' }],
          default_recommended_amount: '50',
          default_recommended_currency: {
            chain: POLYGON_FUNDING_CAIP2,
            asset: 'USDC',
          },
        },
        fiat_on_ramp_enabled: true,
      }),
    );
    expect(result.ready).toBe(true);
    expect(result.chainAligned).toBe(true);
    expect(result.moonpayEnabled).toBe(true);
    expect(result.methods).toEqual(['moonpay']);
    expect(result.providers).toEqual(['card:moonpay']);
  });

  it('marks funding ready when MoonPay + Sepolia USDC are configured', () => {
    process.env.PRIVY_FUNDING_TARGET_CAIP2 = SEPOLIA_FUNDING_CAIP2;
    const result = assessPrivyFundingReadiness(
      baseSettings({
        funding_config: {
          methods: ['moonpay'],
          options: [{ method: 'card', provider: 'moonpay' }],
          default_recommended_amount: '50',
          default_recommended_currency: {
            chain: SEPOLIA_FUNDING_CAIP2,
            asset: 'USDC',
          },
        },
        fiat_on_ramp_enabled: true,
      }),
    );
    expect(result.ready).toBe(true);
    expect(result.chainAligned).toBe(true);
    expect(result.moonpayEnabled).toBe(true);
  });

  it('marks funding ready when Dashboard default is Ethereum mainnet + USDC', () => {
    process.env.PRIVY_FUNDING_TARGET_CAIP2 = POLYGON_FUNDING_CAIP2;
    const result = assessPrivyFundingReadiness(
      baseSettings({
        funding_config: {
          methods: ['moonpay'],
          options: [{ method: 'card', provider: 'moonpay' }],
          default_recommended_amount: '50',
          default_recommended_currency: {
            chain: ETHEREUM_FUNDING_CAIP2,
            asset: 'USDC',
          },
        },
        fiat_on_ramp_enabled: true,
      }),
    );
    expect(result.ready).toBe(true);
    expect(result.chainAligned).toBe(true);
  });

  it('stays not ready when default asset is ETH on Ethereum mainnet', () => {
    const result = assessPrivyFundingReadiness(
      baseSettings({
        funding_config: {
          methods: ['moonpay'],
          options: [{ method: 'card', provider: 'moonpay' }],
          default_recommended_amount: '50',
          default_recommended_currency: {
            chain: ETHEREUM_FUNDING_CAIP2,
            asset: 'ETH',
          },
        },
        fiat_on_ramp_enabled: true,
      }),
    );
    expect(result.ready).toBe(false);
    expect(result.chainAligned).toBe(true);
    expect(result.moonpayEnabled).toBe(true);
    expect(
      result.dashboardChecklist.some((item) => item.includes('USDC')),
    ).toBe(true);
  });

  it('marks funding ready when MoonPay is configured even if master toggle is off', () => {
    process.env.PRIVY_FUNDING_TARGET_CAIP2 = POLYGON_FUNDING_CAIP2;
    const result = assessPrivyFundingReadiness(
      baseSettings({
        funding_config: {
          methods: ['moonpay'],
          options: [{ method: 'card', provider: 'moonpay' }],
          default_recommended_amount: '50',
          default_recommended_currency: {
            chain: POLYGON_FUNDING_CAIP2,
            asset: 'USDC',
          },
        },
        fiat_on_ramp_enabled: false,
      }),
    );
    expect(result.ready).toBe(true);
    expect(result.moonpayEnabled).toBe(true);
    expect(result.fiatOnRampEnabled).toBe(true);
  });

  it('stays not ready when only fiat_on_ramp_enabled is true without methods', () => {
    const result = assessPrivyFundingReadiness(
      baseSettings({ fiat_on_ramp_enabled: true }),
    );
    expect(result.ready).toBe(false);
    expect(result.fiatOnRampEnabled).toBe(true);
  });
});
