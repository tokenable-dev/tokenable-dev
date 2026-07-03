import { ethers, network } from 'hardhat';

const CHAIN_META: Record<
  string,
  { chainId: number; explorer: string; envVar: string }
> = {
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
 * UUPS upgrades do not re-run initialize(), so proxies deployed before BURNER_ROLE
 * existed may grant MINTER but not BURNER to the backend hot wallet. This script
 * grants BURNER_ROLE to the grantee (default: hardhat deployer / RWA_OWNER wallet).
 *
 *   pnpm grant-burner:amoy
 *   RWA_BURNER_GRANTEE=0x... pnpm grant-burner:amoy
 */
async function main() {
  const meta = CHAIN_META[network.name];
  if (!meta) {
    throw new Error(
      `Unsupported network "${network.name}". Use polygon or polygonAmoy.`,
    );
  }

  const proxyAddress = process.env[meta.envVar];
  if (!proxyAddress) {
    throw new Error(`${meta.envVar} is not set in contracts/.env`);
  }

  const [deployer] = await ethers.getSigners();
  const grantee = process.env.RWA_BURNER_GRANTEE?.trim() || deployer.address;

  console.log(`Grant BURNER_ROLE on ${network.name} (chain ${meta.chainId})`);
  console.log('  proxy   :', proxyAddress);
  console.log('  admin   :', deployer.address);
  console.log('  grantee :', grantee);

  const contract = await ethers.getContractAt('TokenableRWA', proxyAddress);
  const BURNER_ROLE = await contract.BURNER_ROLE();
  const already = await contract.hasRole(BURNER_ROLE, grantee);
  if (already) {
    console.log('✅  Grantee already has BURNER_ROLE — nothing to do.');
    return;
  }

  const tx = await contract.grantRole(BURNER_ROLE, grantee);
  console.log('  tx      :', tx.hash);
  await tx.wait();
  console.log('✅  BURNER_ROLE granted.');
  console.log(`Explorer: ${meta.explorer}/address/${proxyAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
