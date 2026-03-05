import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH');

  const SkyNFT = await ethers.getContractFactory('SkyNFT');
  const nft = await SkyNFT.deploy();
  await nft.waitForDeployment();

  const address = await nft.getAddress();
  console.log('');
  console.log('SkyNFT (with ERC721Enumerable) deployed to:', address);
  console.log('');
  console.log('backend/.env 에 아래 값을 추가하세요:');
  console.log(`NFT_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
