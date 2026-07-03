import { ethers, network, upgrades } from 'hardhat';

const CHAIN_META: Record<string, { chainId: number; explorer: string; envVar: string }> = {
  polygon: {
    chainId: 137,
    explorer: 'https://polygonscan.com',
    envVar: 'CHAIN_137_RWA_ADDRESS',
  },
  polygonAmoy: {
    chainId: 80002,
    explorer: 'https://amoy.polygonscan.com',
    envVar: 'CHAIN_80002_RWA_ADDRESS',
  },
};

/**
 * Upgrade the existing TokenableRWA UUPS proxy to the current implementation
 * in contracts/contracts/TokenableRWA.sol. The proxy ADDRESS does not change —
 * backend/.env and frontend/.env do NOT need to be updated after this runs.
 *
 * Examples:
 *   pnpm upgrade:rwa:amoy
 *   pnpm upgrade:rwa:polygon
 */
async function main() {
  const meta = CHAIN_META[network.name];
  if (!meta) {
    throw new Error(`Unsupported network "${network.name}". Use polygon or polygonAmoy.`);
  }

  const proxyAddress = process.env[meta.envVar];
  if (!proxyAddress) {
    throw new Error(`${meta.envVar} is not set in contracts/.env — nothing to upgrade.`);
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Upgrading TokenableRWA proxy on ${network.name} (chain ${meta.chainId})`);
  console.log('  proxy    :', proxyAddress);
  console.log('  deployer :', deployer.address);

  const oldImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log('  old impl :', oldImpl);

  const TokenableRWA = await ethers.getContractFactory('TokenableRWA');
  const upgraded = await upgrades.upgradeProxy(proxyAddress, TokenableRWA);
  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log('  new impl :', newImpl);

  // UUPS re-deploys implementation only — initialize() is not re-run. Ensure
  // BURNER_ROLE exists on the hot wallet after upgrades that introduced it.
  const BURNER_ROLE = await upgraded.BURNER_ROLE();
  const hasBurner = await upgraded.hasRole(BURNER_ROLE, deployer.address);
  if (!hasBurner) {
    console.log('  granting BURNER_ROLE to deployer…');
    const grantTx = await upgraded.grantRole(BURNER_ROLE, deployer.address);
    await grantTx.wait();
    console.log('  BURNER_ROLE granted:', grantTx.hash);
  }

  console.log('');
  console.log('✅  Upgrade complete — proxy address unchanged, no .env updates needed.');
  console.log(`Explorer: ${meta.explorer}/address/${proxyAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
