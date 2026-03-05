// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SkyMarketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 price; // in USDC (6 decimals)
        bool active;
    }

    IERC721 public immutable nftContract;
    IERC20 public immutable usdcToken;

    mapping(uint256 => Listing) public listings;
    uint256[] private _listingIds;
    mapping(uint256 => uint256) private _listingIdIndex;

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event Sold(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event Cancelled(uint256 indexed tokenId);

    error NotOwner();
    error AlreadyListed();
    error NotListed();
    error NotApproved();
    error InsufficientAllowance();
    error PriceMustBeAboveZero();

    constructor(address _nftContract, address _usdcToken) {
        nftContract = IERC721(_nftContract);
        usdcToken = IERC20(_usdcToken);
    }

    /// @notice List an NFT for sale. Seller must have approved this contract via nftContract.approve().
    function listItem(uint256 tokenId, uint256 price) external {
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotOwner();
        if (listings[tokenId].active) revert AlreadyListed();
        if (price == 0) revert PriceMustBeAboveZero();
        if (
            nftContract.getApproved(tokenId) != address(this) &&
            !nftContract.isApprovedForAll(msg.sender, address(this))
        ) revert NotApproved();

        listings[tokenId] = Listing({ seller: msg.sender, price: price, active: true });
        _listingIdIndex[tokenId] = _listingIds.length;
        _listingIds.push(tokenId);

        emit Listed(tokenId, msg.sender, price);
    }

    /// @notice Cancel an active listing.
    function cancelListing(uint256 tokenId) external {
        if (!listings[tokenId].active) revert NotListed();
        if (listings[tokenId].seller != msg.sender) revert NotOwner();

        _removeListing(tokenId);
        emit Cancelled(tokenId);
    }

    /// @notice Buy a listed NFT. Buyer must have approved USDC to this contract.
    function buyItem(uint256 tokenId) external nonReentrant {
        Listing memory listing = listings[tokenId];
        if (!listing.active) revert NotListed();
        if (usdcToken.allowance(msg.sender, address(this)) < listing.price)
            revert InsufficientAllowance();

        _removeListing(tokenId);

        usdcToken.transferFrom(msg.sender, listing.seller, listing.price);
        nftContract.transferFrom(listing.seller, msg.sender, tokenId);

        emit Sold(tokenId, msg.sender, listing.price);
    }

    /// @notice Returns all active listing tokenIds.
    function getActiveListings() external view returns (uint256[] memory) {
        return _listingIds;
    }

    /// @notice Returns count of active listings.
    function activeListingCount() external view returns (uint256) {
        return _listingIds.length;
    }

    function _removeListing(uint256 tokenId) private {
        listings[tokenId].active = false;

        uint256 idx = _listingIdIndex[tokenId];
        uint256 lastId = _listingIds[_listingIds.length - 1];

        _listingIds[idx] = lastId;
        _listingIdIndex[lastId] = idx;
        _listingIds.pop();

        delete _listingIdIndex[tokenId];
    }
}
