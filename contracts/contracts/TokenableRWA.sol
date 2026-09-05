// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title  Tokenable
 * @notice Upgradeable ERC-721 representing a redeemable claim on a physical
 *         asset held in the Tokenable/PSA vault. UUPS proxy.
 *
 * Asset lifecycle
 * ───────────────
 * A physical card and an NFT are NOT permanently linked. The NFT represents
 * "the right to redeem whatever is currently in the vault under vaultRef".
 * One vault deposit → one new tokenId. One redemption → that tokenId is
 * burned forever. The SAME physical card re-deposited later gets a brand
 * new tokenId under the SAME vaultRef — this contract enforces that at most
 * one *active* (non-redeemed) token can exist per vaultRef at any time,
 * which is the core anti-double-claim invariant of the whole platform.
 *
 * Architecture decisions
 * ──────────────────────
 * • AccessControl — four roles: DEFAULT_ADMIN_ROLE (multisig/governance —
 *   upgrades, role management, royalty/contractURI config), MINTER_ROLE
 *   (backend hot wallet — mint on verified vault deposit), BURNER_ROLE
 *   (backend hot wallet — execute redemption burns), PAUSER_ROLE (operational
 *   guardian). Burn is split from DEFAULT_ADMIN_ROLE because redemption is a
 *   routine, frequent, backend-orchestrated operation (not a rare governance
 *   action) — requiring a multisig signature per user redemption would not
 *   scale. In V1 minter/burner/pauser all point at the same backend EOA;
 *   they can be split across services later without a contract change.
 *
 * • Token IDs start at 1 — ID 0 is universally treated as "unset" by tooling
 *   (Seaport, OpenSea, etc.) and avoids ambiguity in mappings/default values.
 *   IDs are NEVER reused, even across vault re-deposits of the same asset.
 *
 * • bytes32 vaultRef — keccak256 of the physical-asset identifier (PSA cert
 *   number). Immutable per-token metadata, kept FOREVER (including after
 *   burn) as an on-chain historical audit trail: "tokenId #101 was minted
 *   against this exact physical card". Duplicate vaultRef values across
 *   DIFFERENT tokenIds are expected and allowed — that is precisely how a
 *   re-vaulted card's history looks (cert X → token #101 [burned] → token
 *   #245 [active]).
 *
 * • _activeTokenIdByVaultRef — the actual uniqueness enforcement. Maps a
 *   vaultRef to the tokenId of its currently active (non-redeemed) claim, or
 *   0 if none. mint()/mintBatch() revert if a claim is already active for
 *   that vaultRef; adminBurn() clears the slot on redemption. This makes the
 *   "only one physical card can back one live NFT at a time" rule a
 *   contract-level guarantee instead of relying solely on backend discipline.
 *
 * • ERC2981 — marketplace royalty standard. Receiver and BPS are configurable
 *   by DEFAULT_ADMIN_ROLE so they can be pointed at a treasury contract later.
 *
 * • adminBurn(tokenId, expectedOwner) — the expectedOwner check prevents
 *   accidental burns during race conditions (e.g. token transferred between
 *   the time the backend queried ownership and submitted the tx). Pass
 *   address(0) to skip the check when the caller has verified ownership
 *   through an alternative mechanism. There is deliberately NO permissionless
 *   self-burn: redemption requires the platform to coordinate physical vault
 *   release (KYC, shipping) BEFORE the claim is destroyed, so burn stays
 *   backend-gated rather than callable directly by the token owner.
 *
 * • adminBurn is NOT gated by whenNotPaused — emergency burns must remain
 *   possible even when the contract is paused.
 *
 * • batchMint — operational efficiency for bulk vault entries; capped at
 *   MAX_BATCH_SIZE to stay within block gas limits on Polygon.
 *
 * • contractURI() — EIP-7572 collection-level metadata consumed by OpenSea,
 *   Blur, and other marketplaces; settable by DEFAULT_ADMIN_ROLE.
 *
 * Storage layout
 * ──────────────
 * All OZ base contracts carry their own __gap; this contract's __gap covers
 * only its own declared storage variables. Current slots used: 4 (see below).
 * Future variables must be added BEFORE __gap and the gap size decreased.
 */
contract TokenableRWA is
    Initializable,
    ERC721URIStorageUpgradeable,
    ERC2981Upgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // ─── Roles ────────────────────────────────────────────────────────────────

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ─── Batch cap ────────────────────────────────────────────────────────────

    uint256 public constant MAX_BATCH_SIZE = 50;

    // ─── Own storage (slots 1–4; update __gap when adding here) ───────────────

    /// @dev Next token ID to issue; starts at 1 after initialize.
    uint256 private _nextTokenId;

    /// @dev EIP-7572 collection-level metadata URI.
    string private _contractURI;

    /// @dev Immutable, permanent per-token reference to the real-world asset
    ///      (see vaultRef()). Never cleared, even after burn — historical record.
    mapping(uint256 => bytes32) private _vaultRefs;

    /// @dev vaultRef => tokenId of the currently active (non-redeemed) claim,
    ///      or 0 if no live claim exists for that physical asset right now.
    ///      This is the anti-double-claim invariant (see activeTokenIdOf()).
    mapping(bytes32 => uint256) private _activeTokenIdByVaultRef;

    /// @dev Reserved upgrade gap. Slots used above: _nextTokenId(1) + _contractURI(1)
    ///      + _vaultRefs(1) + _activeTokenIdByVaultRef(1) = 4. Gap = 46, total = 50.
    uint256[46] private __gap;

    // ─── Events ───────────────────────────────────────────────────────────────

    /**
     * @param vaultRef  keccak256 of the off-chain vault/cert identifier.
     *                  Immutable link between the token and the physical asset.
     */
    event Minted(
        address indexed to,
        uint256 indexed tokenId,
        bytes32 indexed vaultRef,
        string tokenURI
    );
    event Burned(uint256 indexed tokenId, address indexed burnedBy, bytes32 vaultRef);
    event ContractURIUpdated(string newURI);
    event RoyaltyUpdated(address indexed receiver, uint96 feeBps);

    // ─── Custom errors ────────────────────────────────────────────────────────

    error ZeroAddress();
    error EmptyTokenURI();
    error EmptyVaultRef();
    /// @param expected  The expectedOwner argument passed by the caller.
    /// @param actual    The real current owner of the token.
    error OwnerMismatch(uint256 tokenId, address expected, address actual);
    error ArrayLengthMismatch();
    error BatchTooLarge(uint256 length, uint256 max);
    /// @notice A live (non-redeemed) claim already exists for this vaultRef.
    error VaultRefAlreadyActive(bytes32 vaultRef, uint256 activeTokenId);

    // ─── Constructor / Initializer ────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @param admin            Address granted DEFAULT_ADMIN_ROLE (use a multisig in production).
     * @param minter           Address granted MINTER_ROLE, BURNER_ROLE and PAUSER_ROLE
     *                         (backend hot wallet). Split into distinct role IDs so they
     *                         can be granted to separate services later without a redeploy.
     * @param royaltyReceiver  ERC2981 default royalty recipient (platform fee wallet); pass
     *                         address(0) to skip royalty setup.
     * @param royaltyBps       Royalty in basis points (e.g. 500 = 5 %); ignored if receiver is 0.
     */
    function initialize(
        address admin,
        address minter,
        address royaltyReceiver,
        uint96 royaltyBps
    ) external initializer {
        if (admin == address(0) || minter == address(0)) revert ZeroAddress();

        __ERC721_init("Tokenable", "TRWA");
        __ERC721URIStorage_init();
        __ERC2981_init();
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(BURNER_ROLE, minter);
        _grantRole(PAUSER_ROLE, minter);

        // Token IDs start at 1; ID 0 is reserved as "unset" sentinel.
        _nextTokenId = 1;

        if (royaltyReceiver != address(0) && royaltyBps > 0) {
            _setDefaultRoyalty(royaltyReceiver, royaltyBps);
        }
    }

    // ─── Mint ─────────────────────────────────────────────────────────────────

    /**
     * @notice Mint a single RWA token representing a freshly verified vault deposit.
     * @param to        Recipient wallet (must be linked to a Tokenable account).
     * @param tokenURI_ IPFS metadata URI (ipfs://CID/...).
     * @param vaultRef_ keccak256 of the physical-asset identifier (PSA cert number).
     *                  Reverts with VaultRefAlreadyActive if a prior token minted
     *                  against this vaultRef has not yet been redeemed (burned) —
     *                  a physical asset can only back one live NFT at a time.
     */
    function mint(
        address to,
        string calldata tokenURI_,
        bytes32 vaultRef_
    ) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256 tokenId) {
        if (to == address(0)) revert ZeroAddress();
        if (bytes(tokenURI_).length == 0) revert EmptyTokenURI();
        if (vaultRef_ == bytes32(0)) revert EmptyVaultRef();

        uint256 activeId = _activeTokenIdByVaultRef[vaultRef_];
        if (activeId != 0) revert VaultRefAlreadyActive(vaultRef_, activeId);

        tokenId = _nextTokenId++;
        _vaultRefs[tokenId] = vaultRef_;
        _activeTokenIdByVaultRef[vaultRef_] = tokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);
        emit Minted(to, tokenId, vaultRef_, tokenURI_);
    }

    /**
     * @notice Mint multiple RWA tokens in a single transaction (max MAX_BATCH_SIZE).
     *         Arrays must be equal length; each entry follows the same rules as mint(),
     *         including the active-vaultRef check (also catches duplicate vaultRefs
     *         submitted twice within the same batch).
     */
    function mintBatch(
        address[] calldata to,
        string[] calldata tokenURIs,
        bytes32[] calldata vaultRefs
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        uint256 len = to.length;
        if (len != tokenURIs.length || len != vaultRefs.length) revert ArrayLengthMismatch();
        if (len > MAX_BATCH_SIZE) revert BatchTooLarge(len, MAX_BATCH_SIZE);

        for (uint256 i = 0; i < len; ) {
            if (to[i] == address(0)) revert ZeroAddress();
            if (bytes(tokenURIs[i]).length == 0) revert EmptyTokenURI();
            if (vaultRefs[i] == bytes32(0)) revert EmptyVaultRef();

            uint256 activeId = _activeTokenIdByVaultRef[vaultRefs[i]];
            if (activeId != 0) revert VaultRefAlreadyActive(vaultRefs[i], activeId);

            uint256 tokenId = _nextTokenId++;
            _vaultRefs[tokenId] = vaultRefs[i];
            _activeTokenIdByVaultRef[vaultRefs[i]] = tokenId;
            _safeMint(to[i], tokenId);
            _setTokenURI(tokenId, tokenURIs[i]);
            emit Minted(to[i], tokenId, vaultRefs[i], tokenURIs[i]);

            unchecked { ++i; }
        }
    }

    // ─── Burn ─────────────────────────────────────────────────────────────────

    /**
     * @notice Permanently destroy a token — executed by the backend once a
     *         redemption request has been verified (physical asset release
     *         follows). Releases the active-claim slot for this vaultRef so
     *         the same physical asset can be re-vaulted and re-minted later
     *         under a brand-new tokenId. The token's vaultRef itself is kept
     *         forever as historical metadata (see vaultRef()).
     *
     *         Not gated by whenNotPaused — redemptions/emergency burns must
     *         remain possible even when the contract is paused.
     *
     * @param tokenId       The token to destroy.
     * @param expectedOwner Current owner check to prevent race-condition burns.
     *                      Pass address(0) to skip the ownership assertion.
     */
    function adminBurn(
        uint256 tokenId,
        address expectedOwner
    ) external onlyRole(BURNER_ROLE) {
        if (expectedOwner != address(0)) {
            address actual = ownerOf(tokenId);
            if (actual != expectedOwner) revert OwnerMismatch(tokenId, expectedOwner, actual);
        }
        bytes32 ref = _vaultRefs[tokenId];
        if (_activeTokenIdByVaultRef[ref] == tokenId) {
            delete _activeTokenIdByVaultRef[ref];
        }
        _burn(tokenId);
        emit Burned(tokenId, _msgSender(), ref);
    }

    // ─── Pause ────────────────────────────────────────────────────────────────

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // ─── Royalty (ERC2981) ────────────────────────────────────────────────────

    /**
     * @notice Update the default royalty (all tokens). Use per-token overrides
     *         via _setTokenRoyalty in a future upgrade if needed.
     */
    function setDefaultRoyalty(
        address receiver,
        uint96 feeBps
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setDefaultRoyalty(receiver, feeBps);
        emit RoyaltyUpdated(receiver, feeBps);
    }

    // ─── Contract URI (EIP-7572) ──────────────────────────────────────────────

    /// @notice Collection-level metadata URI consumed by marketplaces (OpenSea, Blur, etc.).
    function contractURI() external view returns (string memory) {
        return _contractURI;
    }

    function setContractURI(
        string calldata uri
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _contractURI = uri;
        emit ContractURIUpdated(uri);
    }

    // ─── Vault Reference ──────────────────────────────────────────────────────

    /**
     * @notice Returns the vault reference a given tokenId was minted against.
     *         This is keccak256 of the physical-asset identifier (PSA cert
     *         number) provided at mint time. Kept FOREVER — including after
     *         burn/redemption — as an immutable historical audit record.
     *         Returns bytes32(0) only for tokenIds that were never minted.
     */
    function vaultRef(uint256 tokenId) external view returns (bytes32) {
        return _vaultRefs[tokenId];
    }

    /**
     * @notice Returns the tokenId of the currently active (non-redeemed) claim
     *         for a given vaultRef, or 0 if the physical asset is not
     *         currently backing any live NFT (never minted, or previously
     *         redeemed and not yet re-vaulted).
     */
    function activeTokenIdOf(bytes32 vaultRef_) external view returns (uint256) {
        return _activeTokenIdByVaultRef[vaultRef_];
    }

    /// @notice Convenience wrapper over activeTokenIdOf() for boolean checks.
    function isVaultRefActive(bytes32 vaultRef_) external view returns (bool) {
        return _activeTokenIdByVaultRef[vaultRef_] != 0;
    }

    // ─── View helpers ─────────────────────────────────────────────────────────

    /// @notice Total number of tokens ever minted (includes burned tokens).
    function totalMinted() external view returns (uint256) {
        // _nextTokenId starts at 1 and increments before mint, so subtract 1.
        return _nextTokenId - 1;
    }

    // ─── Upgrade authorization ────────────────────────────────────────────────

    /// @dev Only DEFAULT_ADMIN_ROLE (multisig) may authorize implementation upgrades.
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ─── Internal overrides ───────────────────────────────────────────────────

    /**
     * @dev Blocks mints and transfers when paused, but allows burns (to == address(0))
     *      so that adminBurn remains usable during emergency pauses.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override {
        if (to != address(0)) {
            _requireNotPaused();
        }
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721URIStorageUpgradeable) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721URIStorageUpgradeable, ERC2981Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
