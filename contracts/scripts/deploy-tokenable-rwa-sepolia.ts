import { ethers } from 'hardhat';

/**
 * TokenableRWA 를 Ethereum Sepolia 에 배포합니다.
 *
 * 실행:
 *   pnpm exec hardhat run scripts/deploy-tokenable-rwa-sepolia.ts --network sepolia
 *
 * 필요한 .env 값:
 *   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<YOUR_KEY>
 *   DEPLOYER_PRIVATE_KEY=0x...
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying TokenableRWA to Sepolia');
  console.log('Deployer:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');

  if (balance === 0n) {
    throw new Error(
      'Deployer has no Sepolia ETH. Get some from https://sepoliafaucet.com',
    );
  }

  const TokenableRWA = await ethers.getContractFactory('TokenableRWA');
  const rwa = await TokenableRWA.deploy();
  await rwa.waitForDeployment();

  const address = await rwa.getAddress();
  console.log('');
  console.log('✅  TokenableRWA deployed to:', address);
  console.log('');
  console.log('━━━ backend/.env (또는 .env.production) 에 추가 ━━━━━━━━━━━━');
  console.log(`RWA_CONTRACT_ADDRESS=${address}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Sepolia Etherscan:');
  console.log(`  https://sepolia.etherscan.io/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
