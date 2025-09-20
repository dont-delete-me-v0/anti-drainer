// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EIP7702Saver
 * @notice EIP-7702 compatible contract for batch execution without commissions
 * @dev Supports both self-execution and sponsored execution via signatures
 */
contract EIP7702Saver is ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    struct Call {
        address to;
        uint256 value;
        bytes data;
    }

    // Nonce for replay protection
    uint256 public nonce;

    // Security limits
    uint256 public constant MAX_BATCH_SIZE = 50;

    event CallExecuted(
        address indexed sender,
        address indexed to,
        uint256 value,
        bytes data
    );
    event BatchExecuted(
        uint256 indexed nonce,
        uint256 callsCount,
        address indexed executor
    );

    error InvalidAuthority();
    error InvalidSignature();
    error CallFailed(uint256 callIndex, bytes returnData);
    error BatchTooLarge();
    error InsufficientETH();

    /**
     * @notice Self execution - when authorized account sends transaction itself
     * @dev Only works when msg.sender == address(this) (via EIP-7702 delegation)
     */
    function execute(Call[] calldata calls) external payable nonReentrant {
        if (msg.sender != address(this)) revert InvalidAuthority();
        _executeBatch(calls);
    }

    /**
     * @notice Sponsored execution - when sponsor sends for authorized account
     * @param calls Array of calls to execute
     * @param signature Signature from authorized account
     */
    function execute(
        Call[] calldata calls,
        bytes calldata signature
    ) external payable nonReentrant {
        if (calls.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        // Encode all calls for signature verification
        bytes memory encodedCalls = _encodeCalls(calls);

        // Create digest for signature
        bytes32 digest = keccak256(abi.encodePacked(nonce, encodedCalls));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            digest
        );

        // Recover signer
        address recovered = ECDSA.recover(ethSignedMessageHash, signature);

        // Verify that authorized account (address(this)) signed
        if (recovered != address(this)) revert InvalidSignature();

        _executeBatch(calls);
    }

    /**
     * @notice Execute batch of calls
     */
    function _executeBatch(Call[] calldata calls) internal {
        uint256 currentNonce = nonce;
        nonce++; // Increment nonce for replay protection

        // Check if enough ETH provided
        uint256 totalValueNeeded = 0;
        for (uint256 i = 0; i < calls.length; i++) {
            totalValueNeeded += calls[i].value;
        }

        if (msg.value < totalValueNeeded) {
            revert InsufficientETH();
        }

        // Execute all calls
        for (uint256 i = 0; i < calls.length; i++) {
            _executeCall(calls[i], i);
        }

        emit BatchExecuted(currentNonce, calls.length, msg.sender);

        // Return excess ETH if any
        if (msg.value > totalValueNeeded) {
            uint256 excess = msg.value - totalValueNeeded;
            (bool success, ) = msg.sender.call{value: excess}("");
            // Don't revert if refund fails - just continue
        }
    }

    /**
     * @notice Execute single call
     */
    function _executeCall(Call memory call, uint256 callIndex) internal {
        (bool success, bytes memory returnData) = call.to.call{
            value: call.value
        }(call.data);

        if (!success) {
            revert CallFailed(callIndex, returnData);
        }

        emit CallExecuted(msg.sender, call.to, call.value, call.data);
    }

    /**
     * @notice Encode calls for signature verification
     */
    function _encodeCalls(
        Call[] calldata calls
    ) internal pure returns (bytes memory) {
        bytes memory encoded;
        for (uint256 i = 0; i < calls.length; i++) {
            encoded = abi.encodePacked(
                encoded,
                calls[i].to,
                calls[i].value,
                calls[i].data
            );
        }
        return encoded;
    }

    /**
     * @notice Calculate total ETH needed for a batch (helper for frontend)
     */
    function calculateETHNeeded(
        Call[] calldata calls
    ) external pure returns (uint256 totalETH) {
        for (uint256 i = 0; i < calls.length; i++) {
            totalETH += calls[i].value;
        }
    }

    /**
     * @notice Get contract info
     */
    function getContractInfo()
        external
        view
        returns (uint256 currentNonce, uint256 maxBatchSize)
    {
        return (nonce, MAX_BATCH_SIZE);
    }

    /**
     * @notice Emergency withdraw function (only works if called via EIP-7702)
     */
    function emergencyWithdraw(address token, uint256 amount) external {
        require(msg.sender == address(this), "Only via delegation");

        if (token == address(0)) {
            payable(address(this)).transfer(amount);
        } else {
            // Simple token transfer
            (bool success, ) = token.call(
                abi.encodeWithSelector(0xa9059cbb, address(this), amount)
            );
            require(success, "Token transfer failed");
        }
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}
