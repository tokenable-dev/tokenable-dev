import { MerkleTree } from "merkletreejs";
import { hexToBytes, keccak256, pad, toHex, type Hex } from "viem";

/**
 * Keccak-256 over 32-byte big-endian `identifier` — matches OpenSea `seaport-js`
 * `hashIdentifier` / Seaport criteria Merkle leaves.
 */
export function hashSeaportIdentifier(identifier: bigint): Hex {
  return keccak256(pad(toHex(identifier), { size: 32 }));
}

function keccak256Buffer(data: Buffer): Buffer {
  return Buffer.from(keccak256(new Uint8Array(data)));
}

/**
 * Merkle tree over token ids (or any uint256 identifiers) using Seaport’s leaf hash.
 * Uses sorted pairs (`sort: true` in merkletreejs) like `seaport-js` `MerkleTree`.
 */
export class SeaportMerkleTree {
  private readonly tree: MerkleTree;

  constructor(identifiers: bigint[]) {
    if (identifiers.length === 0) {
      throw new Error("SeaportMerkleTree: at least one identifier is required");
    }
    const leaves = identifiers.map((id) =>
      Buffer.from(hexToBytes(hashSeaportIdentifier(id))),
    );
    this.tree = new MerkleTree(leaves, keccak256Buffer, { sort: true });
  }

  /** Hex root `0x…` suitable for `OfferItem.identifierOrCriteria` (cast to bigint when building structs). */
  getHexRoot(): Hex {
    const root = this.tree.getHexRoot();
    if (!root || root === "0x") {
      return "0x0000000000000000000000000000000000000000000000000000000000000000";
    }
    return root as Hex;
  }

  /** Proof as `bytes32[]` for `CriteriaResolver.criteriaProof` */
  getCriteriaProof(identifier: bigint): Hex[] {
    const leaf = Buffer.from(hexToBytes(hashSeaportIdentifier(identifier)));
    return this.tree.getHexProof(leaf) as Hex[];
  }
}
