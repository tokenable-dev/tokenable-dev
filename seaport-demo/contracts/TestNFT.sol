// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title TestNFT
 * @notice Sepolia 테스트용 ERC-721. 누구나 무료로 mint 가능.
 * @dev 프로덕션에서는 이 컨트랙트 대신 TokenableRWA.sol 사용
 */
contract TestNFT is ERC721 {
    uint256 private _nextTokenId;

    event Minted(address indexed to, uint256 indexed tokenId);

    constructor() ERC721("TestNFT", "TNFT") {}

    /// @notice 누구나 호출 가능한 mint (테스트 전용)
    function mint(address to) external returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        emit Minted(to, tokenId);
    }

    /// @notice 현재까지 발행된 토큰 수
    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }
}
