import { ethers, network, upgrades } from 'hardhat';

const CHAIN_META: Record<string, { chainId: number; explorer: string; envVar: string }> = {
  mainnet: {
    chainId: 1,
    explorer: 'https://etherscan.io',
    envVar: 'CHAIN_1_RWA_ADDRESS',
  },
  sepolia: {
    chainId: 11155111,
    explorer: 'https://sepolia.etherscan.io',
    envVar: 'CHAIN_11155111_RWA_ADDRESS',
  },
  polygon: {
    chainId: 137,
    explorer: 'https://polygonscan.com',
    envVar: 'CHAIN_137_RWA_ADDRESS',
  },
};

/**
 * Upgrade the existing TokenableRWA UUPS proxy to the current implementation
 * in contracts/contracts/TokenableRWA.sol. The proxy ADDRESS does not change —
 * backend/.env and frontend/.env do NOT need to be updated after this runs.
 *
 * Examples:
 *   pnpm upgrade:rwa:sepolia
 *   pnpm upgrade:rwa:polygon
 *   pnpm upgrade:rwa:mainnet
 */
async function main() {
  const meta = CHAIN_META[network.name];
  if (!meta) {
    throw new Error(
      `Unsupported network "${network.name}". Use mainnet, sepolia, or polygon.`,
    );
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

  console.log('');
  console.log('✅  Upgrade complete (proxy address unchanged)');
  console.log(`Explorer: ${meta.explorer}/address/${proxyAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
