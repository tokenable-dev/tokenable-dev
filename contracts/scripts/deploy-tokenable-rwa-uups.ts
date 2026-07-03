import { ethers, network } from 'hardhat';
import { upgrades } from 'hardhat';

const CHAIN_META: Record<
  string,
  {
    chainId: number;
    nativeSymbol: string;
    explorer: string;
    faucet?: string;
    backendEnv: string;
    frontendEnv: string;
  }
> = {
  polygon: {
    chainId: 137,
    nativeSymbol: 'POL',
    explorer: 'https://polygonscan.com',
    backendEnv: 'CHAIN_137_RWA_ADDRESS',
    frontendEnv: 'NEXT_PUBLIC_CHAIN_137_RWA',
  },
  polygonAmoy: {
    chainId: 80002,
    nativeSymbol: 'POL',
    explorer: 'https://amoy.polygonscan.com',
    faucet: 'https://faucet.polygon.technology/',
    backendEnv: 'CHAIN_80002_RWA_ADDRESS',
    frontendEnv: 'NEXT_PUBLIC_CHAIN_80002_RWA',
  },
};

/**
 * Deploy TokenableRWA as a UUPS upgradeable proxy.
 *
 * Examples:
 *   pnpm deploy:rwa              # Polygon Amoy (default dev)
 *   pnpm deploy:rwa:amoy
 *   pnpm deploy:rwa:polygon
 */
async function main() {
  const meta = CHAIN_META[network.name];
  if (!meta) {
    throw new Error(
      `Unsupported network "${network.name}". Use polygon or polygonAmoy.`,
    );
  }

  const [deployer] = await ethers.getSigners();

  // In production: admin should be a multisig (Gnosis Safe).
  // Minter is the backend hot wallet (same key used for RWA_OWNER_PRIVATE_KEY).
  // For dev/Amoy: deployer fills both roles for simplicity.
  const adminAddress  = process.env.RWA_ADMIN_ADDRESS  ?? deployer.address;
  const minterAddress = process.env.RWA_MINTER_ADDRESS ?? deployer.address;
  // Platform fee wallet receives royalties. Defaults to deployer if not set.
  const royaltyReceiver = process.env.PLATFORM_FEE_RECIPIENT ?? deployer.address;
  const royaltyBps = 500; // 5 % default — adjustable post-deploy via setDefaultRoyalty()

  console.log(`Deploying TokenableRWA (UUPS v2) to ${network.name} (chain ${meta.chainId})`);
  console.log('  deployer  :', deployer.address);
  console.log('  admin     :', adminAddress);
  console.log('  minter    :', minterAddress);
  console.log('  royalty   :', royaltyReceiver, `(${royaltyBps} bps)`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('  balance   :', ethers.formatEther(balance), meta.nativeSymbol);

  if (balance === 0n) {
    const hint = meta.faucet ? ` Get ${meta.nativeSymbol} from ${meta.faucet}` : '';
    throw new Error(`Deployer has no ${meta.nativeSymbol}.${hint}`);
  }

  const TokenableRWA = await ethers.getContractFactory('TokenableRWA');
  const proxy = await upgrades.deployProxy(
    TokenableRWA,
    [adminAddress, minterAddress, royaltyReceiver, royaltyBps],
    {
      kind: 'uups',
      initializer: 'initialize',
    },
  );
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log('');
  console.log('✅  TokenableRWA UUPS proxy deployed');
  console.log('   Proxy (use in app env) :', proxyAddress);
  console.log('   Implementation         :', implAddress);
  console.log('');
  console.log('━━━ backend/.env ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`${meta.backendEnv}=${proxyAddress}`);
  console.log('RWA_OWNER_PRIVATE_KEY=<DEPLOYER_PRIVATE_KEY / hot wallet key>');
  console.log('━━━ frontend/.env ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`${meta.frontendEnv}=${proxyAddress}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Explorer:');
  console.log(`  ${meta.explorer}/address/${proxyAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
