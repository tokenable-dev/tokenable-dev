import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH');

  const nftAddress = process.env.NFT_CONTRACT_ADDRESS;
  const usdcAddress = process.env.USDC_CONTRACT_ADDRESS;

  if (!nftAddress || !usdcAddress) {
    throw new Error(
      'NFT_CONTRACT_ADDRESS and USDC_CONTRACT_ADDRESS must be set in .env',
    );
  }

  console.log('Using NFT contract:', nftAddress);
  console.log('Using USDC contract:', usdcAddress);

  const SkyMarketplace = await ethers.getContractFactory('SkyMarketplace');
  const marketplace = await SkyMarketplace.deploy(nftAddress, usdcAddress);
  await marketplace.waitForDeployment();

  const address = await marketplace.getAddress();
  console.log('');
  console.log('SkyMarketplace deployed to:', address);
  console.log('');
  console.log('backend/.env 에 아래 값을 추가하세요:');
  console.log(`MARKETPLACE_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
