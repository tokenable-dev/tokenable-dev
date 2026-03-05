import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH');

  const MockUSDC = await ethers.getContractFactory('MockUSDC');
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const address = await usdc.getAddress();
  const totalSupply = await usdc.totalSupply();

  console.log('');
  console.log('MockUSDC deployed to:', address);
  console.log('Total supply:', ethers.formatUnits(totalSupply, 6), 'USDC');
  console.log('');
  console.log('backend/.env 에 아래 값을 추가하세요:');
  console.log(`USDC_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
