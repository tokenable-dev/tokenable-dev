/** Minimal Privy app settings fields used for funding readiness (from `apps().getSettings()`). */
export type PrivyAppSettingsForFunding = {
  fiat_on_ramp_enabled: boolean;
  funding_config?: {
    methods: string[];
    options: Array<{ method: string; provider: string }>;
    default_recommended_amount: string;
    default_recommended_currency?: {
      chain: string;
      asset?: string;
    };
  };
};

export type PrivyFundingReadiness = {
  /** Client `useFiatOnramp` / legacy `fundWallet` can open a MoonPay flow end-to-end. */
  ready: boolean;
  fiatOnRampEnabled: boolean;
  methods: string[];
  providers: string[];
  defaultRecommendedAmount: string | null;
  defaultRecommendedChain: string | null;
  defaultRecommendedAsset: string | null;
  /** Dashboard default chain matches an accepted Tokenable funding network. */
  chainAligned: boolean;
  /** MoonPay card on-ramp is enabled in Dashboard funding options. */
  moonpayEnabled: boolean;
  /** App-side on-ramp destination CAIP-2 (from env or Sepolia default). */
  targetFundingCaip2: string;
  /** Action items when `ready` is false. */
  dashboardChecklist: string[];
  dashboardUrl: string;
};

const DASHBOARD_FUNDING_URL = 'https://dashboard.privy.io/apps?page=funding';

export const PRODUCTION_FUNDING_CAIP2 = 'eip155:1';
export const SEPOLIA_FUNDING_CAIP2 = 'eip155:11155111';
export const ETHEREUM_FUNDING_CAIP2 = 'eip155:1';
export const POLYGON_FUNDING_CAIP2 = 'eip155:137';
export const TOKENABLE_FUNDING_ASSET = 'USDC';

/** @deprecated Prefer {@link POLYGON_FUNDING_CAIP2}. */
export const TOKENABLE_FUNDING_CAIP2 = POLYGON_FUNDING_CAIP2;

export function resolveFundingTargetCaip2(): string {
  const fromEnv = process.env.PRIVY_FUNDING_TARGET_CAIP2?.trim();
  if (fromEnv?.startsWith('eip155:')) return fromEnv;
  // Sepolia-first deploy default — set PRIVY_FUNDING_TARGET_CAIP2=eip155:137 for Polygon live.
  return SEPOLIA_FUNDING_CAIP2;
}

/** Dashboard chains accepted for MoonPay readiness (mainnets + Sepolia sandbox QA). */
export function getAlignedFundingCaip2Chains(): string[] {
  const target = resolveFundingTargetCaip2();
  const chains = new Set<string>([
    target,
    POLYGON_FUNDING_CAIP2,
    SEPOLIA_FUNDING_CAIP2,
    PRODUCTION_FUNDING_CAIP2,
    ETHEREUM_FUNDING_CAIP2,
  ]);
  return [...chains];
}

export function parseCaip2EvmChainId(
  caip2: string | null | undefined,
): number | null {
  if (!caip2?.startsWith('eip155:')) return null;
  const id = Number.parseInt(caip2.slice('eip155:'.length), 10);
  return Number.isFinite(id) ? id : null;
}

export function isTokenableFundingChainAligned(
  defaultChain: string | null | undefined,
): boolean {
  if (!defaultChain) return false;
  return getAlignedFundingCaip2Chains().includes(defaultChain);
}

export function assessPrivyFundingReadiness(
  settings: PrivyAppSettingsForFunding,
): PrivyFundingReadiness {
  const fc = settings.funding_config;
  const methods = fc?.methods ?? [];
  const options = fc?.options ?? [];
  const providers = options.map((o) => `${o.method}:${o.provider}`);
  const defaultRecommendedChain =
    fc?.default_recommended_currency?.chain ?? null;
  const defaultRecommendedAsset =
    fc?.default_recommended_currency?.asset ?? null;
  const targetFundingCaip2 = resolveFundingTargetCaip2();

  const hasFundingConfig =
    Boolean(fc) && (methods.length > 0 || options.length > 0);
  const masterToggleOn = settings.fiat_on_ramp_enabled === true;
  const moonpayEnabled =
    methods.includes('moonpay') ||
    options.some((o) => o.provider === 'moonpay');
  // Privy sometimes leaves `fiat_on_ramp_enabled=false` even after MoonPay is
  // configured under Account Funding. Treat MoonPay methods as the source of truth.
  const fiatOnRampEnabled = masterToggleOn || moonpayEnabled;
  const chainAligned = isTokenableFundingChainAligned(defaultRecommendedChain);
  const assetAligned =
    !defaultRecommendedAsset ||
    defaultRecommendedAsset.toUpperCase() === TOKENABLE_FUNDING_ASSET;

  const ready =
    fiatOnRampEnabled &&
    hasFundingConfig &&
    moonpayEnabled &&
    chainAligned &&
    assetAligned;

  const checklist: string[] = [];
  if (!ready) {
    if (!fiatOnRampEnabled) {
      checklist.push(
        'Turn ON the "Fiat onramps" master toggle (Payment methods section).',
      );
    }
    if (!hasFundingConfig) {
      checklist.push(
        'Open Privy Dashboard → Account Funding and enable MoonPay (Card on-ramp).',
      );
    }
    if (masterToggleOn && !hasFundingConfig) {
      checklist.push(
        '`fiat_on_ramp_enabled` is true but no funding methods are returned — enter MoonPay API keys and save Account Funding.',
      );
    }
    if (hasFundingConfig && !moonpayEnabled) {
      checklist.push(
        'Enable MoonPay under Account Funding → Providers (Stripe / Coinbase / Meld / Bridge not required).',
      );
    }
    if (hasFundingConfig && moonpayEnabled && !chainAligned) {
      checklist.push(
        defaultRecommendedChain
          ? `Change Funding token setup from ${defaultRecommendedChain} to Polygon + USDC (${POLYGON_FUNDING_CAIP2}) or Ethereum + USDC (${ETHEREUM_FUNDING_CAIP2}). App target: ${targetFundingCaip2}.`
          : `Set Funding token setup to Polygon + USDC (${POLYGON_FUNDING_CAIP2}) or Ethereum + USDC (${ETHEREUM_FUNDING_CAIP2}).`,
      );
    }
    if (hasFundingConfig && moonpayEnabled && chainAligned && !assetAligned) {
      checklist.push(
        `Set default funding asset to ${TOKENABLE_FUNDING_ASSET} (not ${defaultRecommendedAsset}).`,
      );
    }
    if (!moonpayEnabled) {
      checklist.push(
        'Enter MoonPay publishable + secret API keys when prompted in the Dashboard (production keys for live Polygon).',
      );
    }
    checklist.push(
      'Add app domains under Settings → Allowed domains (e.g. `http://localhost:3000`, production URL).',
    );
    checklist.push(
      'Frontend: Polygon live → NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID=137 (environment auto-production on mainnet). Sepolia QA → sandbox + USE_ONRAMP_ON_TESTNET.',
    );
  } else {
    if (!masterToggleOn && moonpayEnabled) {
      checklist.push(
        'Optional: turn ON the Dashboard "Fiat onramps" master toggle — MoonPay is already configured and Add funds will proceed.',
      );
    }
    if (methods.length === 0 && options.length === 0) {
      checklist.push(
        'Funding config is present but empty — verify MoonPay keys and network/asset defaults in Account Funding.',
      );
    }
  }

  return {
    ready,
    fiatOnRampEnabled,
    methods: [...methods],
    providers,
    defaultRecommendedAmount: fc?.default_recommended_amount ?? null,
    defaultRecommendedChain,
    defaultRecommendedAsset,
    chainAligned,
    moonpayEnabled,
    targetFundingCaip2,
    dashboardChecklist: checklist,
    dashboardUrl: DASHBOARD_FUNDING_URL,
  };
}
