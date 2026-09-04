import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type { TokenableRWA } from "../typechain-types";

// Vault refs derived from raw PSA cert numbers — matching VaultService.computeVaultRef()
// production format: keccak256(certNumber.trim().toUpperCase()).
const VAULT_REF_1 = ethers.keccak256(ethers.toUtf8Bytes("83179580"));
const VAULT_REF_2 = ethers.keccak256(ethers.toUtf8Bytes("12345678"));
const VAULT_REF_3 = ethers.keccak256(ethers.toUtf8Bytes("99999999"));
const TOKEN_URI_1 = "ipfs://bafybei0000000000000000000000000001/metadata.json";
const TOKEN_URI_2 = "ipfs://bafybei0000000000000000000000000002/metadata.json";
const TOKEN_URI_3 = "ipfs://bafybei0000000000000000000000000003/metadata.json";
const TOKEN_URI_1B = "ipfs://bafybei0000000000000000000000000011/metadata.json"; // re-vault of cert 1
const TOKEN_URI_1C = "ipfs://bafybei0000000000000000000000000021/metadata.json"; // 3rd vault of cert 1

const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
const BURNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));
const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

describe("TokenableRWA (UUPS v2)", function () {
  let contract: TokenableRWA;
  let admin: SignerWithAddress;
  let minter: SignerWithAddress;
  let royaltyRecipient: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let stranger: SignerWithAddress;

  beforeEach(async function () {
    [admin, minter, royaltyRecipient, user1, user2, stranger] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("TokenableRWA");
    contract = (await upgrades.deployProxy(
      Factory,
      [admin.address, minter.address, royaltyRecipient.address, 500],
      { initializer: "initialize", kind: "uups" }
    )) as unknown as TokenableRWA;
  });

  // ─── Initialization ────────────────────────────────────────────────────────

  describe("initialize", function () {
    it("sets name and symbol", async function () {
      expect(await contract.name()).to.equal("Tokenable");
      expect(await contract.symbol()).to.equal("TRWA");
    });

    it("grants DEFAULT_ADMIN_ROLE to admin", async function () {
      expect(await contract.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("grants MINTER_ROLE, BURNER_ROLE and PAUSER_ROLE to minter", async function () {
      expect(await contract.hasRole(MINTER_ROLE, minter.address)).to.be.true;
      expect(await contract.hasRole(BURNER_ROLE, minter.address)).to.be.true;
      expect(await contract.hasRole(PAUSER_ROLE, minter.address)).to.be.true;
    });

    it("admin does NOT have MINTER_ROLE by default", async function () {
      expect(await contract.hasRole(MINTER_ROLE, admin.address)).to.be.false;
    });

    it("sets default royalty (500 bps = 5 %)", async function () {
      const [receiver, amount] = await contract.royaltyInfo(1, 10_000n);
      expect(receiver).to.equal(royaltyRecipient.address);
      expect(amount).to.equal(500n);
    });

    it("totalMinted() starts at 0", async function () {
      expect(await contract.totalMinted()).to.equal(0n);
    });

    it("reverts on re-initialize", async function () {
      await expect(
        contract.initialize(admin.address, minter.address, ethers.ZeroAddress, 0)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  // ─── Token ID starts at 1 ─────────────────────────────────────────────────

  describe("token ID starts at 1", function () {
    it("first minted token has ID 1", async function () {
      const tx = await contract
        .connect(minter)
        .mint(user1.address, TOKEN_URI_1, VAULT_REF_1);
      const receipt = await tx.wait();
      const log = receipt!.logs
        .map((l) => {
          try {
            return contract.interface.parseLog(l);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "Minted");
      expect(log?.args.tokenId).to.equal(1n);
    });
  });

  // ─── Single mint ──────────────────────────────────────────────────────────

  describe("mint()", function () {
    it("minter can mint and token has correct URI and vaultRef", async function () {
      await contract.connect(minter).mint(user1.address, TOKEN_URI_1, VAULT_REF_1);
      expect(await contract.ownerOf(1)).to.equal(user1.address);
      expect(await contract.tokenURI(1)).to.equal(TOKEN_URI_1);
      expect(await contract.vaultRef(1)).to.equal(VAULT_REF_1);
      expect(await contract.totalMinted()).to.equal(1n);
    });

    it("emits Minted event with vaultRef", async function () {
      await expect(
        contract.connect(minter).mint(user1.address, TOKEN_URI_1, VAULT_REF_1)
      )
        .to.emit(contract, "Minted")
        .withArgs(user1.address, 1n, VAULT_REF_1, TOKEN_URI_1);
    });

    it("stranger cannot mint", async function () {
      await expect(
        contract.connect(stranger).mint(user1.address, TOKEN_URI_1, VAULT_REF_1)
      ).to.be.revertedWith(/AccessControl/);
    });

    it("reverts on zero-address recipient", async function () {
      await expect(
        contract.connect(minter).mint(ethers.ZeroAddress, TOKEN_URI_1, VAULT_REF_1)
      ).to.be.revertedWithCustomError(contract, "ZeroAddress");
    });

    it("reverts on empty tokenURI", async function () {
      await expect(
        contract.connect(minter).mint(user1.address, "", VAULT_REF_1)
      ).to.be.revertedWithCustomError(contract, "EmptyTokenURI");
    });

    it("reverts on zero vaultRef", async function () {
      await expect(
        contract.connect(minter).mint(user1.address, TOKEN_URI_1, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(contract, "EmptyVaultRef");
    });
  });

  // ─── Active vaultRef invariant (anti-double-claim) ──────────────────────────

  describe("active vaultRef invariant", function () {
    it("activeTokenIdOf() / isVaultRefActive() are unset before any mint", async function () {
      expect(await contract.activeTokenIdOf(VAULT_REF_1)).to.equal(0n);
      expect(await contract.isVaultRefActive(VAULT_REF_1)).to.be.false;
    });

    it("mint() sets the active claim for the vaultRef", async function () {
      await contract.connect(minter).mint(user1.address, TOKEN_URI_1, VAULT_REF_1);
      expect(await contract.activeTokenIdOf(VAULT_REF_1)).to.equal(1n);
      expect(await contract.isVaultRefActive(VAULT_REF_1)).to.be.true;
    });

    it("reverts minting a second token against a vaultRef that is still active", async function () {
      await contract.connect(minter).mint(user1.address, TOKEN_URI_1, VAULT_REF_1);
      await expect(
        contract.connect(minter).mint(user2.address, TOKEN_URI_2, VAULT_REF_1)
      )
        .to.be.revertedWithCustomError(contract, "VaultRefAlreadyActive")
        .withArgs(VAULT_REF_1, 1n);
    });

    it("reverts mintBatch() with a duplicate vaultRef within the same batch", async function () {
      await expect(
        contract
          .connect(minter)
          .mintBatch(
            [user1.address, user2.address],
            [TOKEN_URI_1, TOKEN_URI_2],
            [VAULT_REF_1, VAULT_REF_1]
          )
      ).to.be.revertedWithCustomError(contract, "VaultRefAlreadyActive");
    });

    it("burn releases the active claim, allowing re-mint under a new tokenId", async function () {
      await contract.connect(minter).mint(user1.address, TOKEN_URI_1, VAULT_REF_1);
      await contract.connect(minter).adminBurn(1, user1.address);
      expect(await contract.isVaultRefActive(VAULT_REF_1)).to.be.false;

      await expect(
        contract.connect(minter).mint(user2.address, TOKEN_URI_2, VAULT_REF_1)
      )
        .to.emit(contract, "Minted")
        .withArgs(user2.address, 2n, VAULT_REF_1, TOKEN_URI_2);

      expect(await contract.ownerOf(2)).to.equal(user2.address);
      expect(await contract.activeTokenIdOf(VAULT_REF_1)).to.equal(2n);
      // Historical record: both tokenIds permanently point back to the same vaultRef.
      expect(await contract.vaultRef(1)).to.equal(VAULT_REF_1);
      expect(await contract.vaultRef(2)).to.equal(VAULT_REF_1);
    });
  });

  // ─── Batch mint ───────────────────────────────────────────────────────────

  describe("mintBatch()", function () {
    it("mints multiple tokens in one tx", async function () {
      await contract
        .connect(minter)
        .mintBatch(
          [user1.address, user2.address],
          [TOKEN_URI_1, TOKEN_URI_2],
          [VAULT_REF_1, VAULT_REF_2]
        );
      expect(await contract.ownerOf(1)).to.equal(user1.address);
      expect(await contract.ownerOf(2)).to.equal(user2.address);
      expect(await contract.vaultRef(1)).to.equal(VAULT_REF_1);
      expect(await contract.vaultRef(2)).to.equal(VAULT_REF_2);
      expect(await contract.totalMinted()).to.equal(2n);
    });

    it("reverts on array length mismatch", async function () {
      await expect(
        contract
          .connect(minter)
          .mintBatch([user1.address], [TOKEN_URI_1, TOKEN_URI_2], [VAULT_REF_1, VAULT_REF_2])
      ).to.be.revertedWithCustomError(contract, "ArrayLengthMismatch");
    });

    it("reverts on batch too large (> 50)", async function () {
      const addrs = Array(51).fill(user1.address);
      const uris = Array(51).fill(TOKEN_URI_1);
      const refs = Array(51).fill(VAULT_REF_1);
      await expect(
        contract.connect(minter).mintBatch(addrs, uris, refs)
      ).to.be.revertedWithCustomError(contract, "BatchTooLarge");
    });
  });

  // ─── adminBurn ────────────────────────────────────────────────────────────

  describe("adminBurn()", function () {
    beforeEach(async function () {
      await contract.connect(minter).mint(user1.address, TOKEN_URI_1, VAULT_REF_1);
    });

    it("BURNER_ROLE can burn a token", async function () {
      await contract.connect(minter).adminBurn(1, user1.address);
      await expect(contract.ownerOf(1)).to.be.revertedWith(/invalid token/i);
    });

    it("emits Burned event with vaultRef", async function () {
      await expect(contract.connect(minter).adminBurn(1, user1.address))
        .to.emit(contract, "Burned")
        .withArgs(1n, minter.address, VAULT_REF_1);
    });

    it("vaultRef persists (historical record) after burn", async function () {
      await contract.connect(minter).adminBurn(1, user1.address);
      expect(await contract.vaultRef(1)).to.equal(VAULT_REF_1);
    });

    it("clears the active claim after burn", async function () {
      await contract.connect(minter).adminBurn(1, user1.address);
      expect(await contract.activeTokenIdOf(VAULT_REF_1)).to.equal(0n);
      expect(await contract.isVaultRefActive(VAULT_REF_1)).to.be.false;
    });

    it("reverts if expectedOwner does not match", async function () {
      await expect(
        contract.connect(minter).adminBurn(1, user2.address)
      ).to.be.revertedWithCustomError(contract, "OwnerMismatch");
    });

    it("succeeds when expectedOwner is address(0) (skip check)", async function () {
      await expect(contract.connect(minter).adminBurn(1, ethers.ZeroAddress)).not.to.be.reverted;
    });

    it("DEFAULT_ADMIN_ROLE alone (no BURNER_ROLE) cannot burn", async function () {
      await expect(
        contract.connect(admin).adminBurn(1, user1.address)
      ).to.be.revertedWith(/AccessControl/);
    });

    it("stranger cannot burn", async function () {
      await expect(
        contract.connect(stranger).adminBurn(1, user1.address)
      ).to.be.revertedWith(/AccessControl/);
    });

    it("adminBurn works even when paused", async function () {
      await contract.connect(minter).pause();
      await expect(contract.connect(minter).adminBurn(1, user1.address)).not.to.be.reverted;
    });
  });

  // ─── Pause ────────────────────────────────────────────────────────────────

  describe("pause / unpause", function () {
    it("PAUSER_ROLE can pause and block mint", async function () {
      await contract.connect(minter).pause();
      await expect(
        contract.connect(minter).mint(user1.address, TOKEN_URI_1, VAULT_REF_1)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("paused contract blocks transfers", async function () {
      await contract.connect(minter).mint(user1.address, TOKEN_URI_1, VAULT_REF_1);
      await contract.connect(minter).pause();
      await expect(
        contract.connect(user1).transferFrom(user1.address, user2.address, 1)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("stranger cannot pause", async function () {
      await expect(contract.connect(stranger).pause()).to.be.revertedWith(/AccessControl/);
    });

    it("unpause resumes minting", async function () {
      await contract.connect(minter).pause();
      await contract.connect(minter).unpause();
      await expect(
        contract.connect(minter).mint(user1.address, TOKEN_URI_1, VAULT_REF_1)
      ).not.to.be.reverted;
    });
  });

  // ─── Royalty (ERC2981) ────────────────────────────────────────────────────

  describe("ERC2981 royalty", function () {
    it("admin can update default royalty", async function () {
      await contract.connect(admin).setDefaultRoyalty(user2.address, 250);
      const [receiver, amount] = await contract.royaltyInfo(1, 10_000n);
      expect(receiver).to.equal(user2.address);
      expect(amount).to.equal(250n);
    });

    it("emits RoyaltyUpdated event", async function () {
      await expect(contract.connect(admin).setDefaultRoyalty(user2.address, 300))
        .to.emit(contract, "RoyaltyUpdated")
        .withArgs(user2.address, 300);
    });

    it("minter cannot update royalty", async function () {
      await expect(
        contract.connect(minter).setDefaultRoyalty(user2.address, 100)
      ).to.be.revertedWith(/AccessControl/);
    });
  });

  // ─── contractURI ──────────────────────────────────────────────────────────

  describe("contractURI()", function () {
    it("empty by default", async function () {
      expect(await contract.contractURI()).to.equal("");
    });

    it("admin can set contractURI", async function () {
      const uri = "ipfs://bafybeicontract0000000000000000000000000000000000/contract.json";
      await contract.connect(admin).setContractURI(uri);
      expect(await contract.contractURI()).to.equal(uri);
    });

    it("emits ContractURIUpdated", async function () {
      const uri = "ipfs://test";
      await expect(contract.connect(admin).setContractURI(uri))
        .to.emit(contract, "ContractURIUpdated")
        .withArgs(uri);
    });

    it("minter cannot set contractURI", async function () {
      await expect(
        contract.connect(minter).setContractURI("ipfs://x")
      ).to.be.revertedWith(/AccessControl/);
    });
  });

  // ─── supportsInterface ────────────────────────────────────────────────────

  describe("supportsInterface()", function () {
    it("supports ERC721", async function () {
      expect(await contract.supportsInterface("0x80ac58cd")).to.be.true;
    });
    it("supports ERC721Metadata", async function () {
      expect(await contract.supportsInterface("0x5b5e139f")).to.be.true;
    });
    it("supports ERC2981", async function () {
      expect(await contract.supportsInterface("0x2a55205a")).to.be.true;
    });
    it("supports AccessControl", async function () {
      expect(await contract.supportsInterface("0x7965db0b")).to.be.true;
    });
  });

  // ─── Upgrade ──────────────────────────────────────────────────────────────

  describe("upgrade (UUPS)", function () {
    it("preserves state after upgrade to same implementation", async function () {
      await contract.connect(minter).mint(user1.address, TOKEN_URI_1, VAULT_REF_1);

      const Factory = await ethers.getContractFactory("TokenableRWA");
      const upgraded = (await upgrades.upgradeProxy(
        await contract.getAddress(),
        Factory
      )) as unknown as TokenableRWA;

      expect(await upgraded.ownerOf(1)).to.equal(user1.address);
      expect(await upgraded.vaultRef(1)).to.equal(VAULT_REF_1);
      expect(await upgraded.totalMinted()).to.equal(1n);
    });

    it("minter cannot authorize upgrade", async function () {
      const Factory = await ethers.getContractFactory("TokenableRWA");
      const newImpl = await Factory.deploy();
      await expect(
        contract.connect(minter).upgradeToAndCall(await newImpl.getAddress(), "0x")
      ).to.be.revertedWith(/AccessControl/);
    });
  });

  // ─── Full asset lifecycle ─────────────────────────────────────────────────
  //
  // Tests the complete deposit → trade → redeem → re-deposit cycle to verify
  // that the anti-double-claim invariant holds through every state transition,
  // vaultRef persists permanently, and tokenId counter never resets.

  describe("full asset lifecycle", function () {
    it("cycle 1: Mint → Transfer → Burn tracks ownership correctly", async function () {
      // Vault deposit: mint token #1 to user1
      await contract.connect(minter).mint(user1.address, TOKEN_URI_1, VAULT_REF_1);
      expect(await contract.ownerOf(1)).to.equal(user1.address);
      expect(await contract.activeTokenIdOf(VAULT_REF_1)).to.equal(1n);

      // Marketplace trade: user1 transfers to user2
      await contract.connect(user1).transferFrom(user1.address, user2.address, 1);
      expect(await contract.ownerOf(1)).to.equal(user2.address);
      // Active claim doesn't change on transfer — still tokenId 1
      expect(await contract.activeTokenIdOf(VAULT_REF_1)).to.equal(1n);

      // Redemption: burn with expectedOwner = user2 (new owner after transfer)
      await expect(
        contract.connect(minter).adminBurn(1, user1.address)
      ).to.be.revertedWithCustomError(contract, "OwnerMismatch");

      await contract.connect(minter).adminBurn(1, user2.address);
      await expect(contract.ownerOf(1)).to.be.revertedWith(/invalid token/i);
      expect(await contract.isVaultRefActive(VAULT_REF_1)).to.be.false;
      expect(await contract.vaultRef(1)).to.equal(VAULT_REF_1); // permanent history
    });

    it("cycle 2: re-vault same cert → new tokenId, old vaultRef still maps to burnt id", async function () {
      // Cycle 1: mint #1 → burn
      await contract.connect(minter).mint(user1.address, TOKEN_URI_1, VAULT_REF_1);
      await contract.connect(minter).adminBurn(1, user1.address);

      // Cycle 2: mint #2 under same vaultRef, new IPFS URI (new deposit → new metadata)
      await contract.connect(minter).mint(user2.address, TOKEN_URI_1B, VAULT_REF_1);
      expect(await contract.ownerOf(2)).to.equal(user2.address);
      expect(await contract.tokenURI(2)).to.equal(TOKEN_URI_1B);
      expect(await contract.vaultRef(2)).to.equal(VAULT_REF_1);
      expect(await contract.activeTokenIdOf(VAULT_REF_1)).to.equal(2n);
      expect(await contract.totalMinted()).to.equal(2n);

      // Historical token #1 still records its vaultRef permanently
      expect(await contract.vaultRef(1)).to.equal(VAULT_REF_1);
    });

    it("cycle 3: third deposit of same cert still works, tokenId keeps incrementing", async function () {
      // Cycle 1
      await contract.connect(minter).mint(user1.address, TOKEN_URI_1, VAULT_REF_1);
      await contract.connect(minter).adminBurn(1, user1.address);
      // Cycle 2
      await contract.connect(minter).mint(user2.address, TOKEN_URI_1B, VAULT_REF_1);
      await contract.connect(minter).adminBurn(2, user2.address);
      // Cycle 3 — unrelated cert was minted in between, advancing counter
      await contract.connect(minter).mint(user1.address, TOKEN_URI_2, VAULT_REF_2);
      expect(await contract.totalMinted()).to.equal(3n);
      // Cert 1 can still be re-vaulted (cycle 3)
      await contract.connect(minter).mint(user1.address, TOKEN_URI_1C, VAULT_REF_1);
      expect(await contract.ownerOf(4)).to.equal(user1.address);
      expect(await contract.vaultRef(4)).to.equal(VAULT_REF_1);
      expect(await contract.activeTokenIdOf(VAULT_REF_1)).to.equal(4n);
      expect(await contract.totalMinted()).to.equal(4n);
      // vaultRef history: tokens 1, 2, and 4 all point to VAULT_REF_1; 3 to VAULT_REF_2
      expect(await contract.vaultRef(1)).to.equal(VAULT_REF_1);
      expect(await contract.vaultRef(2)).to.equal(VAULT_REF_1);
      expect(await contract.vaultRef(3)).to.equal(VAULT_REF_2);
      expect(await contract.vaultRef(4)).to.equal(VAULT_REF_1);
    });

    it("totalMinted() grows monotonically — burns do NOT decrease the counter", async function () {
      await contract.connect(minter).mint(user1.address, TOKEN_URI_1, VAULT_REF_1);
      expect(await contract.totalMinted()).to.equal(1n);
      await contract.connect(minter).adminBurn(1, user1.address);
      expect(await contract.totalMinted()).to.equal(1n); // still 1, not 0
      await contract.connect(minter).mint(user1.address, TOKEN_URI_1B, VAULT_REF_1);
      expect(await contract.totalMinted()).to.equal(2n);
      await contract.connect(minter).adminBurn(2, user1.address);
      expect(await contract.totalMinted()).to.equal(2n); // still 2, not 1
    });

    it("active-claim slot cannot be double-claimed between two different certs simultaneously", async function () {
      // Mint two different certs
      await contract.connect(minter).mintBatch(
        [user1.address, user2.address],
        [TOKEN_URI_1, TOKEN_URI_2],
        [VAULT_REF_1, VAULT_REF_2]
      );
      expect(await contract.activeTokenIdOf(VAULT_REF_1)).to.equal(1n);
      expect(await contract.activeTokenIdOf(VAULT_REF_2)).to.equal(2n);

      // Burn cert 1 → cert 2 remains active
      await contract.connect(minter).adminBurn(1, user1.address);
      expect(await contract.isVaultRefActive(VAULT_REF_1)).to.be.false;
      expect(await contract.activeTokenIdOf(VAULT_REF_2)).to.equal(2n);

      // Re-vault cert 1 → independent, doesn't affect cert 2
      await contract.connect(minter).mint(user1.address, TOKEN_URI_1B, VAULT_REF_1);
      expect(await contract.activeTokenIdOf(VAULT_REF_1)).to.equal(3n);
      expect(await contract.activeTokenIdOf(VAULT_REF_2)).to.equal(2n);

      // Trying to re-vault cert 2 while token #2 is still active → reverts
      await expect(
        contract.connect(minter).mint(user1.address, TOKEN_URI_3, VAULT_REF_2)
      )
        .to.be.revertedWithCustomError(contract, "VaultRefAlreadyActive")
        .withArgs(VAULT_REF_2, 2n);
    });

    it("full lifecycle: token burned while paused is a valid redemption", async function () {
      await contract.connect(minter).mint(user1.address, TOKEN_URI_1, VAULT_REF_1);
      await contract.connect(minter).pause();

      // Burn (redemption) still works while paused
      await contract.connect(minter).adminBurn(1, user1.address);
      expect(await contract.isVaultRefActive(VAULT_REF_1)).to.be.false;

      // Cannot mint new cycle while paused
      await expect(
        contract.connect(minter).mint(user2.address, TOKEN_URI_1B, VAULT_REF_1)
      ).to.be.revertedWith("Pausable: paused");

      // After unpause, re-vault succeeds
      await contract.connect(minter).unpause();
      await contract.connect(minter).mint(user2.address, TOKEN_URI_1B, VAULT_REF_1);
      expect(await contract.activeTokenIdOf(VAULT_REF_1)).to.equal(2n);
    });
  });
});
