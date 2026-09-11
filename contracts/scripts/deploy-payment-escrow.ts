/**
 * Deploy TokenablePaymentEscrow (non-upgradeable).
 *
 * Env:
 *   CHAIN_USDC_ADDRESS or SEPOLIA_USDC_ADDRESS
 *   PLATFORM_FEE_RECIPIENT (treasury)
 *   PAYMENT_ESCROW_ADMIN (optional — defaults to deployer)
 *   PAYMENT_ESCROW_ARBITER (optional — defaults to deployer)
 */
import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  const usdc =
    process.env.CHAIN_USDC_ADDRESS?.trim() ||
    process.env.SEPOLIA_USDC_ADDRESS?.trim() ||
    process.env.CHAIN_11155111_USDC_ADDRESS?.trim() ||
    // Circle USDC on Sepolia (matches backend/.env default)
    '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
  const treasury =
    process.env.PLATFORM_FEE_RECIPIENT?.trim() || deployer.address;
  const admin =
    process.env.PAYMENT_ESCROW_ADMIN?.trim() || deployer.address;
  const arbiter =
    process.env.PAYMENT_ESCROW_ARBITER?.trim() || deployer.address;

  if (!usdc) {
    throw new Error('Set CHAIN_USDC_ADDRESS or SEPOLIA_USDC_ADDRESS');
  }

  console.log('Deployer:', deployer.address);
  console.log('USDC:', usdc);
  console.log('Treasury:', treasury);
  console.log('Admin:', admin);
  console.log('Arbiter:', arbiter);

  const Factory = await ethers.getContractFactory('TokenablePaymentEscrow');
  const escrow = await Factory.deploy(usdc, treasury, admin, arbiter);
  await escrow.waitForDeployment();
  const address = await escrow.getAddress();
  console.log('TokenablePaymentEscrow:', address);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
