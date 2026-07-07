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
  mainnet: {
    chainId: 1,
    nativeSymbol: 'ETH',
    explorer: 'https://etherscan.io',
    backendEnv: 'CHAIN_1_RWA_ADDRESS',
    frontendEnv: 'NEXT_PUBLIC_CHAIN_1_RWA',
  },
  sepolia: {
    chainId: 11155111,
    nativeSymbol: 'ETH',
    explorer: 'https://sepolia.etherscan.io',
    faucet: 'https://sepoliafaucet.com/',
    backendEnv: 'CHAIN_11155111_RWA_ADDRESS',
    frontendEnv: 'NEXT_PUBLIC_CHAIN_11155111_RWA',
  },
};

/**
 * Deploy TokenableRWA as a UUPS upgradeable proxy.
 *
 * Examples:
 *   pnpm deploy:rwa              # Sepolia (default dev)
 *   pnpm deploy:rwa:sepolia
 *   pnpm deploy:rwa:mainnet
 */
async function main() {
  const meta = CHAIN_META[network.name];
  if (!meta) {
    throw new Error(
      `Unsupported network "${network.name}". Use mainnet or sepolia.`,
    );
  }

  const [deployer] = await ethers.getSigners();

  // In production: admin should be a multisig (Gnosis Safe).
  // Minter is the backend hot wallet (same key used for RWA_OWNER_PRIVATE_KEY).
  // For dev/Sepolia: deployer fills both roles for simplicity.
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
