import { ethers, network } from 'hardhat';
import type { Contract } from 'ethers';

/** On-chain ERC-721 metadata (constructor). Override via RWA_TOKEN_NAME / RWA_TOKEN_SYMBOL. */
const DEFAULT_TOKEN_NAME = 'Tokenable Collectibles';
const DEFAULT_TOKEN_SYMBOL = 'GEMS';

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
  polygon: {
    chainId: 137,
    nativeSymbol: 'POL',
    explorer: 'https://polygonscan.com',
    backendEnv: 'CHAIN_137_RWA_ADDRESS',
    frontendEnv: 'NEXT_PUBLIC_CHAIN_137_RWA',
  },
};

async function logRoleMembers(
  nft: Contract,
  roleLabel: string,
  roleId: string,
): Promise<void> {
  const count = await nft.getRoleMemberCount(roleId);
  const members: string[] = [];
  for (let i = 0n; i < count; i++) {
    members.push(await nft.getRoleMember(roleId, i));
  }
  console.log(
    `  ${roleLabel} members:`,
    members.length > 0 ? members.join(', ') : '(none)',
  );
}

/**
 * Deploy unmodified OpenZeppelin ERC721PresetMinterPauserAutoId (no proxy).
 *
 * Constructor: (name, symbol, baseTokenURI)
 * Token 0 is minted then burned so live inventory starts at 1 (orders.token_id=0
 * is the collection-bid sentinel).
 *
 * Changing the NFT means a new deploy + env address swap — no upgrades.
 */
async function main() {
  const meta = CHAIN_META[network.name];
  if (!meta) {
    throw new Error(
      `Unsupported network "${network.name}". Use mainnet, sepolia, or polygon.`,
    );
  }

  const [deployer] = await ethers.getSigners();
  const minterAddress =
    process.env.RWA_MINTER_ADDRESS?.trim() || deployer.address;
  const baseTokenURI = process.env.RWA_METADATA_BASE_URI?.trim() || '';
  const tokenName = process.env.RWA_TOKEN_NAME?.trim() || DEFAULT_TOKEN_NAME;
  const tokenSymbol = process.env.RWA_TOKEN_SYMBOL?.trim() || DEFAULT_TOKEN_SYMBOL;

  console.log(
    `Deploying OpenZeppelin ERC721PresetMinterPauserAutoId on ${network.name} (chain ${meta.chainId})`,
  );
  console.log('  deployer  :', deployer.address);
  console.log('  name      :', tokenName);
  console.log('  symbol    :', tokenSymbol);
  console.log(
    '  admin     :',
    deployer.address,
    '(DEFAULT_ADMIN_ROLE stays on deployer)',
  );
  console.log('  minter    :', minterAddress);
  console.log('  baseURI   :', baseTokenURI || '(empty — metadata stays off-chain)');

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('  balance   :', ethers.formatEther(balance), meta.nativeSymbol);

  if (balance === 0n) {
    const hint = meta.faucet ? ` Get ${meta.nativeSymbol} from ${meta.faucet}` : '';
    throw new Error(`Deployer has no ${meta.nativeSymbol}.${hint}`);
  }

  const Factory = await ethers.getContractFactory(
    'ERC721PresetMinterPauserAutoId',
  );
  const nft = await Factory.deploy(tokenName, tokenSymbol, baseTokenURI);
  await nft.waitForDeployment();
  const address = await nft.getAddress();

  const deployTx = nft.deploymentTransaction();
  const deployReceipt = deployTx ? await deployTx.wait() : null;
  const deployBlock = deployReceipt?.blockNumber;

  const mint0 = await nft.mint(deployer.address);
  await mint0.wait();
  const burn0 = await nft.burn(0);
  await burn0.wait();

  const MINTER_ROLE = await nft.MINTER_ROLE();
  const PAUSER_ROLE = await nft.PAUSER_ROLE();
  const DEFAULT_ADMIN_ROLE = await nft.DEFAULT_ADMIN_ROLE();

  if (minterAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    if (!(await nft.hasRole(MINTER_ROLE, minterAddress))) {
      await (await nft.grantRole(MINTER_ROLE, minterAddress)).wait();
    }
    if (!(await nft.hasRole(PAUSER_ROLE, minterAddress))) {
      await (await nft.grantRole(PAUSER_ROLE, minterAddress)).wait();
    }
    await (await nft.revokeRole(MINTER_ROLE, deployer.address)).wait();
    await (await nft.revokeRole(PAUSER_ROLE, deployer.address)).wait();
  }

  console.log('');
  console.log('✅  ERC721PresetMinterPauserAutoId deployed (immutable, no proxy)');
  console.log('   Deployer                 :', deployer.address);
  console.log('   Address (use in app env) :', address);
  console.log('   Token #0 burned; next mint is #1');
  console.log('');
  console.log('━━━ AccessControl (on-chain) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   DEFAULT_ADMIN_ROLE       :', DEFAULT_ADMIN_ROLE);
  await logRoleMembers(nft, 'DEFAULT_ADMIN_ROLE', DEFAULT_ADMIN_ROLE);
  await logRoleMembers(nft, 'MINTER_ROLE', MINTER_ROLE);
  await logRoleMembers(nft, 'PAUSER_ROLE', PAUSER_ROLE);
  console.log('');
  console.log('━━━ backend/.env ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`${meta.backendEnv}=${address}`);
  if (deployBlock != null) {
    console.log(`CHAIN_${meta.chainId}_RWA_DEPLOY_BLOCK=${deployBlock}`);
  }
  console.log('━━━ frontend/.env ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`${meta.frontendEnv}=${address}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Explorer: ${meta.explorer}/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
