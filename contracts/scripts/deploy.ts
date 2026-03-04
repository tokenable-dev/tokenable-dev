import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH');

  const SkyToken = await ethers.getContractFactory('SkyToken');
  const token = await SkyToken.deploy();
  await token.waitForDeployment();

  const address = await token.getAddress();
  const totalSupply = await token.totalSupply();

  console.log('');
  console.log('SkyToken deployed to:', address);
  console.log('Total supply:', ethers.formatEther(totalSupply), 'SKY');
  console.log('');
  console.log('backend/.env 에 아래 값을 추가하세요:');
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
