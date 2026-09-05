import { expect } from "chai";
import { ethers } from "hardhat";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type { TokenablePaymentEscrow } from "../typechain-types";
import type { IERC20 } from "../typechain-types";

describe("TokenablePaymentEscrow", function () {
  let escrow: TokenablePaymentEscrow;
  let usdc: IERC20;
  let admin: SignerWithAddress;
  let arbiter: SignerWithAddress;
  let treasury: SignerWithAddress;
  let buyer: SignerWithAddress;
  let seller: SignerWithAddress;
  let stranger: SignerWithAddress;

  const ORDER_ID = ethers.id("p2p-order-1");
  const AMOUNT = 100_000_000n; // 100 USDC (6 decimals)
  const FEE = 5_000_000n; // 5%
  const TO_SELLER = 95_000_000n;

  async function deployMockUsdc() {
    const Mock = await ethers.getContractFactory("MockERC20");
    return Mock.deploy("USD Coin", "USDC", 6);
  }

  beforeEach(async function () {
    [admin, arbiter, treasury, buyer, seller, stranger] =
      await ethers.getSigners();

    const mock = await deployMockUsdc();
    usdc = mock as unknown as IERC20;

    await (mock as any).mint(buyer.address, AMOUNT * 10n);

    const Factory = await ethers.getContractFactory("TokenablePaymentEscrow");
    escrow = (await Factory.deploy(
      await mock.getAddress(),
      treasury.address,
      admin.address,
      arbiter.address
    )) as unknown as TokenablePaymentEscrow;

    await (mock as any)
      .connect(buyer)
      .approve(await escrow.getAddress(), ethers.MaxUint256);
  });

  async function fund(autoReleaseAt?: number) {
    const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
    const deadline = autoReleaseAt ?? ts + 7 * 24 * 60 * 60;
    await escrow
      .connect(buyer)
      .createAndDeposit(ORDER_ID, seller.address, AMOUNT, deadline);
    return deadline;
  }

  it("locks USDC on createAndDeposit", async function () {
    await fund();
    const e = await escrow.escrows(ORDER_ID);
    expect(e.buyer).to.equal(buyer.address);
    expect(e.seller).to.equal(seller.address);
    expect(e.amount).to.equal(AMOUNT);
    expect(e.state).to.equal(1); // Funded
    expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(AMOUNT);
  });

  it("confirmReceipt pays seller minus 5% fee", async function () {
    await fund();
    await escrow.connect(buyer).confirmReceipt(ORDER_ID);
    expect(await usdc.balanceOf(seller.address)).to.equal(TO_SELLER);
    expect(await usdc.balanceOf(treasury.address)).to.equal(FEE);
    const e = await escrow.escrows(ORDER_ID);
    expect(e.state).to.equal(2); // Released
  });

  it("rejects confirm from non-buyer", async function () {
    await fund();
    await expect(
      escrow.connect(stranger).confirmReceipt(ORDER_ID)
    ).to.be.revertedWithCustomError(escrow, "NotBuyer");
  });

  it("arbiter refund returns full amount to buyer", async function () {
    await fund();
    const before = await usdc.balanceOf(buyer.address);
    await escrow.connect(arbiter).refund(ORDER_ID);
    expect(await usdc.balanceOf(buyer.address)).to.equal(before + AMOUNT);
    const e = await escrow.escrows(ORDER_ID);
    expect(e.state).to.equal(3); // Refunded
  });

  it("rejects refund from non-arbiter", async function () {
    await fund();
    await expect(
      escrow.connect(stranger).refund(ORDER_ID)
    ).to.be.revertedWith(/AccessControl/);
  });

  it("settleAfterTimeout releases after deadline", async function () {
    const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
    await fund(ts + 100);
    await expect(
      escrow.connect(stranger).settleAfterTimeout(ORDER_ID)
    ).to.be.revertedWithCustomError(escrow, "TimeoutNotReached");

    await ethers.provider.send("evm_increaseTime", [101]);
    await ethers.provider.send("evm_mine", []);

    await escrow.connect(stranger).settleAfterTimeout(ORDER_ID);
    expect(await usdc.balanceOf(seller.address)).to.equal(TO_SELLER);
    expect(await usdc.balanceOf(treasury.address)).to.equal(FEE);
  });

  it("rejects duplicate orderId", async function () {
    await fund();
    const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
    await expect(
      escrow
        .connect(buyer)
        .createAndDeposit(ORDER_ID, seller.address, AMOUNT, ts + 1000)
    ).to.be.revertedWithCustomError(escrow, "OrderExists");
  });
});
