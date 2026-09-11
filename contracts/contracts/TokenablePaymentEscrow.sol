// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TokenablePaymentEscrow
 * @notice Holds buyer USDC until confirm / timeout release / arbiter refund.
 *         Pattern inspired by Cyfrin Escrow (confirmReceipt) + multi-order marketplace escrows.
 *         Does NOT custody NFTs — RWA stays in the platform custody wallet.
 */
contract TokenablePaymentEscrow is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    uint16 public constant FEE_BPS = 500; // 5%
    uint16 public constant BPS_DENOM = 10_000;

    IERC20 public immutable usdc;
    address public treasury;

    enum State {
        None,
        Funded,
        Released,
        Refunded
    }

    struct Escrow {
        address buyer;
        address seller;
        uint256 amount;
        uint64 autoReleaseAt;
        State state;
    }

    /// @dev orderId is a bytes32 chosen by the backend (e.g. keccak256 of DB uuid).
    mapping(bytes32 => Escrow) public escrows;

    event EscrowCreated(
        bytes32 indexed orderId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint64 autoReleaseAt
    );
    event EscrowReleased(
        bytes32 indexed orderId,
        address indexed seller,
        uint256 sellerAmount,
        uint256 feeAmount
    );
    event EscrowRefunded(bytes32 indexed orderId, address indexed buyer, uint256 amount);
    event TreasuryUpdated(address indexed treasury);

    error ZeroAddress();
    error InvalidAmount();
    error InvalidDeadline();
    error OrderExists();
    error WrongState(State current);
    error NotBuyer();
    error TimeoutNotReached();

    constructor(address usdc_, address treasury_, address admin_, address arbiter_) {
        if (usdc_ == address(0) || treasury_ == address(0) || admin_ == address(0) || arbiter_ == address(0)) {
            revert ZeroAddress();
        }
        usdc = IERC20(usdc_);
        treasury = treasury_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ARBITER_ROLE, arbiter_);
    }

    function setTreasury(address treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    /**
     * @notice Buyer deposits `amount` USDC for `seller`. `autoReleaseAt` must be in the future.
     */
    function createAndDeposit(
        bytes32 orderId,
        address seller,
        uint256 amount,
        uint64 autoReleaseAt
    ) external nonReentrant {
        if (seller == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (autoReleaseAt <= block.timestamp) revert InvalidDeadline();
        if (escrows[orderId].state != State.None) revert OrderExists();

        escrows[orderId] = Escrow({
            buyer: msg.sender,
            seller: seller,
            amount: amount,
            autoReleaseAt: autoReleaseAt,
            state: State.Funded
        });

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit EscrowCreated(orderId, msg.sender, seller, amount, autoReleaseAt);
    }

    /// @notice Buyer confirms receipt — release USDC to seller (minus 5% fee).
    function confirmReceipt(bytes32 orderId) external nonReentrant {
        Escrow storage e = escrows[orderId];
        if (e.state != State.Funded) revert WrongState(e.state);
        if (msg.sender != e.buyer) revert NotBuyer();
        _release(orderId, e);
    }

    /// @notice Anyone after autoReleaseAt — same payout as confirm (liveness).
    function settleAfterTimeout(bytes32 orderId) external nonReentrant {
        Escrow storage e = escrows[orderId];
        if (e.state != State.Funded) revert WrongState(e.state);
        if (block.timestamp < e.autoReleaseAt) revert TimeoutNotReached();
        _release(orderId, e);
    }

    /// @notice Arbiter refunds buyer (no-ship / accepted dispute).
    function refund(bytes32 orderId) external nonReentrant onlyRole(ARBITER_ROLE) {
        Escrow storage e = escrows[orderId];
        if (e.state != State.Funded) revert WrongState(e.state);

        e.state = State.Refunded;
        uint256 amount = e.amount;
        usdc.safeTransfer(e.buyer, amount);
        emit EscrowRefunded(orderId, e.buyer, amount);
    }

    function _release(bytes32 orderId, Escrow storage e) internal {
        e.state = State.Released;
        uint256 fee = (e.amount * FEE_BPS) / BPS_DENOM;
        uint256 toSeller = e.amount - fee;
        usdc.safeTransfer(e.seller, toSeller);
        if (fee > 0) {
            usdc.safeTransfer(treasury, fee);
        }
        emit EscrowReleased(orderId, e.seller, toSeller, fee);
    }
}
