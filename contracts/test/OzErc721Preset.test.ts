import { expect } from "chai";
import { ethers } from "hardhat";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type { Contract } from "ethers";

const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
const BASE_URI = "https://example.com/metadata/";
const TOKEN_NAME = "Tokenable Collectibles";
const TOKEN_SYMBOL = "GEMS";

describe("ERC721PresetMinterPauserAutoId (unmodified OpenZeppelin)", function () {
  let nft: Contract;
  let deployer: SignerWithAddress;
  let minter: SignerWithAddress;
  let user1: SignerWithAddress;
  let stranger: SignerWithAddress;

  async function deployPreset(): Promise<Contract> {
    const Factory = await ethers.getContractFactory(
      "ERC721PresetMinterPauserAutoId",
    );
    const deployed = await Factory.connect(deployer).deploy(
      TOKEN_NAME,
      TOKEN_SYMBOL,
      BASE_URI,
    );
    await deployed.waitForDeployment();
    return deployed;
  }

  /** Match production deploy: consume token 0 so live inventory starts at 1. */
  async function consumeTokenZero(contract: Contract): Promise<void> {
    await (await contract.mint(deployer.address)).wait();
    await (await contract.burn(0)).wait();
  }

  beforeEach(async function () {
    [deployer, minter, user1, stranger] = await ethers.getSigners();
    nft = await deployPreset();
  });

  describe("constructor", function () {
    it("sets name, symbol, and roles on the deployer", async function () {
      expect(await nft.name()).to.equal(TOKEN_NAME);
      expect(await nft.symbol()).to.equal(TOKEN_SYMBOL);
      expect(await nft.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;
      expect(await nft.hasRole(MINTER_ROLE, deployer.address)).to.be.true;
      expect(await nft.hasRole(PAUSER_ROLE, deployer.address)).to.be.true;
    });

    it("has no BURNER_ROLE — burn is ERC721Burnable (owner/approved)", async function () {
      expect(nft.interface.hasFunction("BURNER_ROLE")).to.equal(false);
      expect(nft.interface.hasFunction("adminBurn")).to.equal(false);
      expect(nft.interface.hasFunction("vaultRef")).to.equal(false);
      expect(nft.interface.hasFunction("mintBatch")).to.equal(false);
    });
  });

  describe("mint", function () {
    it("mints sequential ids starting at 0 with baseURI tokenURI", async function () {
      await nft.mint(user1.address);
      expect(await nft.ownerOf(0)).to.equal(user1.address);
      expect(await nft.tokenURI(0)).to.equal(`${BASE_URI}0`);
      await nft.mint(user1.address);
      expect(await nft.ownerOf(1)).to.equal(user1.address);
      expect(await nft.tokenURI(1)).to.equal(`${BASE_URI}1`);
      expect(await nft.totalSupply()).to.equal(2n);
    });

    it("reverts when caller lacks MINTER_ROLE", async function () {
      await expect(nft.connect(stranger).mint(user1.address)).to.be.revertedWith(
        "ERC721PresetMinterPauserAutoId: must have minter role to mint",
      );
    });

    it("after consuming token 0, the next mint is token 1", async function () {
      await consumeTokenZero(nft);
      await nft.mint(user1.address);
      expect(await nft.ownerOf(1)).to.equal(user1.address);
      await expect(nft.ownerOf(0)).to.be.revertedWith("ERC721: invalid token ID");
      expect(await nft.totalSupply()).to.equal(1n);
    });
  });

  describe("burn", function () {
    it("lets the token owner burn", async function () {
      await nft.mint(user1.address);
      await nft.connect(user1).burn(0);
      await expect(nft.ownerOf(0)).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("reverts when a non-owner tries to burn", async function () {
      await nft.mint(user1.address);
      await expect(nft.connect(stranger).burn(0)).to.be.revertedWith(
        "ERC721: caller is not token owner or approved",
      );
    });
  });

  describe("pause", function () {
    it("blocks mint and transfer while paused", async function () {
      await nft.pause();
      await expect(nft.mint(user1.address)).to.be.revertedWith(
        "ERC721Pausable: token transfer while paused",
      );
      await nft.unpause();
      await nft.mint(user1.address);
      await nft.pause();
      await expect(
        nft.connect(user1).transferFrom(user1.address, stranger.address, 0),
      ).to.be.revertedWith("ERC721Pausable: token transfer while paused");
    });
  });

  describe("roles", function () {
    it("admin can grant MINTER_ROLE to another wallet", async function () {
      await nft.grantRole(MINTER_ROLE, minter.address);
      await nft.connect(minter).mint(user1.address);
      expect(await nft.ownerOf(0)).to.equal(user1.address);
    });
  });

  describe("ERC721Enumerable", function () {
    it("tokenByIndex lists live tokens after burns", async function () {
      await consumeTokenZero(nft);
      await nft.mint(user1.address);
      await nft.mint(user1.address);
      expect(await nft.totalSupply()).to.equal(2n);
      expect(await nft.tokenByIndex(0)).to.equal(1n);
      expect(await nft.tokenByIndex(1)).to.equal(2n);
      await nft.connect(user1).burn(1);
      expect(await nft.totalSupply()).to.equal(1n);
      expect(await nft.tokenByIndex(0)).to.equal(2n);
    });
  });

  describe("pause vs burn", function () {
    it("blocks burn while paused (transfer path)", async function () {
      await nft.mint(user1.address);
      await nft.pause();
      await expect(nft.connect(user1).burn(0)).to.be.revertedWith(
        "ERC721Pausable: token transfer while paused",
      );
    });
  });
});
