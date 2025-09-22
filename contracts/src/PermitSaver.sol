// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title PermitSaver
 * @notice Contract for saving tokens using permit functionality
 * @dev Allows users to transfer tokens using permit signatures without requiring ETH for gas
 */
contract PermitSaver is ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    struct PermitData {
        address token;
        address owner;
        address spender;
        uint256 value;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct TransferData {
        address token;
        address to;
        uint256 amount;
    }

    // Nonce for replay protection
    uint256 public nonce;

    // Security limits
    uint256 public constant MAX_BATCH_SIZE = 50;

    event TokenSaved(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 amount
    );
    event BatchExecuted(
        uint256 indexed nonce,
        uint256 transfersCount,
        address indexed executor
    );

    error InvalidSignature();
    error PermitFailed(address token, string reason);
    error TransferFailed(address token, string reason);
    error BatchTooLarge();
    error InvalidToken();
    error PermitExpired();
    error ArrayLengthMismatch();
    error InvalidSpender();

    /**
     * @notice Permit transfer with sponsored execution using signature
     * @param permitData Permit signature data for token approval
     * @param transferData Transfer data for moving tokens
     * @param signature Signature from token owner
     */
    function permitTransferWithSignature(
        PermitData calldata permitData,
        TransferData calldata transferData,
        bytes calldata signature
    ) external nonReentrant {
        _validatePermitData(permitData);
        _validateTransferData(transferData);

        // Verify that spender is this contract
        if (permitData.spender != address(this)) revert InvalidSpender();

        // Verify signature from owner
        _verifySignature(permitData, transferData, signature);

        // Execute permit
        _executePermit(permitData);

        // Execute transfer from owner to recipient
        _executeTransferFromOwner(permitData.owner, transferData);

        emit TokenSaved(
            transferData.token,
            permitData.owner,
            transferData.to,
            transferData.amount
        );
    }

    /**
     * @notice Permit transfer batch with sponsored execution using signature
     * @param permitDataArray Array of permit data
     * @param transferDataArray Array of transfer data
     * @param signature Signature from token owner
     */
    function permitTransferBatchWithSignature(
        PermitData[] calldata permitDataArray,
        TransferData[] calldata transferDataArray,
        bytes calldata signature
    ) external nonReentrant {
        if (
            permitDataArray.length > MAX_BATCH_SIZE ||
            transferDataArray.length > MAX_BATCH_SIZE
        ) {
            revert BatchTooLarge();
        }

        if (permitDataArray.length != transferDataArray.length) {
            revert ArrayLengthMismatch();
        }

        // Verify signature for the entire batch
        _verifyBatchSignature(permitDataArray, transferDataArray, signature);

        uint256 currentNonce = nonce;
        nonce++;

        for (uint256 i = 0; i < permitDataArray.length; i++) {
            _validatePermitData(permitDataArray[i]);
            _validateTransferData(transferDataArray[i]);

            // Verify that spender is this contract
            if (permitDataArray[i].spender != address(this))
                revert InvalidSpender();

            // Execute permit for this token
            _executePermit(permitDataArray[i]);

            // Execute transfer from owner to recipient
            _executeTransferFromOwner(
                permitDataArray[i].owner,
                transferDataArray[i]
            );

            emit TokenSaved(
                transferDataArray[i].token,
                permitDataArray[i].owner,
                transferDataArray[i].to,
                transferDataArray[i].amount
            );
        }

        emit BatchExecuted(currentNonce, permitDataArray.length, msg.sender);
    }

    /**
     * @notice Validate permit data
     */
    function _validatePermitData(PermitData calldata permitData) internal view {
        if (permitData.token == address(0)) revert InvalidToken();
        if (permitData.owner == address(0)) revert InvalidToken();
        if (permitData.deadline < block.timestamp) revert PermitExpired();
    }

    /**
     * @notice Validate transfer data
     */
    function _validateTransferData(
        TransferData calldata transferData
    ) internal pure {
        if (transferData.token == address(0)) revert InvalidToken();
        if (transferData.to == address(0)) revert InvalidToken();
        if (transferData.amount == 0) revert InvalidToken();
    }

    /**
     * @notice Execute permit
     */
    function _executePermit(PermitData calldata permitData) internal {
        IERC20Permit token = IERC20Permit(permitData.token);

        try
            token.permit(
                permitData.owner,
                permitData.spender,
                permitData.value,
                permitData.deadline,
                permitData.v,
                permitData.r,
                permitData.s
            )
        {
            // Permit successful
        } catch Error(string memory reason) {
            // Check if permit was already used (some tokens don't revert on duplicate permit)
            uint256 currentAllowance = IERC20(permitData.token).allowance(
                permitData.owner,
                address(this)
            );

            if (currentAllowance < permitData.value) {
                revert PermitFailed(permitData.token, reason);
            }
            // If allowance is sufficient, continue (permit might have been used already)
        } catch {
            // Check allowance as fallback
            uint256 currentAllowance = IERC20(permitData.token).allowance(
                permitData.owner,
                address(this)
            );

            if (currentAllowance < permitData.value) {
                revert PermitFailed(permitData.token, "Unknown error");
            }
        }
    }

    /**
     * @notice Execute transfer from owner to recipient
     */
    function _executeTransferFromOwner(
        address from,
        TransferData calldata transferData
    ) internal {
        IERC20 token = IERC20(transferData.token);

        // Transfer tokens from owner to recipient
        bool success = token.transferFrom(
            from,
            transferData.to,
            transferData.amount
        );

        if (!success) {
            revert TransferFailed(transferData.token, "Transfer failed");
        }
    }

    /**
     * @notice Verify signature for single transfer
     */
    function _verifySignature(
        PermitData calldata permitData,
        TransferData calldata transferData,
        bytes calldata signature
    ) internal view {
        // Create message hash
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                permitData.token,
                permitData.owner,
                permitData.spender,
                permitData.value,
                permitData.deadline,
                transferData.token,
                transferData.to,
                transferData.amount,
                nonce
            )
        );

        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            messageHash
        );

        // Recover signer
        address recovered = ECDSA.recover(ethSignedMessageHash, signature);

        // Verify that the owner signed
        if (recovered != permitData.owner) revert InvalidSignature();
    }

    /**
     * @notice Verify signature for batch transfer
     */
    function _verifyBatchSignature(
        PermitData[] calldata permitDataArray,
        TransferData[] calldata transferDataArray,
        bytes calldata signature
    ) internal view {
        // Create message hash for batch
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                permitDataArray.length,
                transferDataArray.length,
                nonce
            )
        );

        // Add each permit and transfer data to hash
        for (uint256 i = 0; i < permitDataArray.length; i++) {
            messageHash = keccak256(
                abi.encodePacked(
                    messageHash,
                    permitDataArray[i].token,
                    permitDataArray[i].owner,
                    permitDataArray[i].spender,
                    permitDataArray[i].value,
                    permitDataArray[i].deadline,
                    transferDataArray[i].token,
                    transferDataArray[i].to,
                    transferDataArray[i].amount
                )
            );
        }

        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            messageHash
        );

        // Recover signer
        address recovered = ECDSA.recover(ethSignedMessageHash, signature);

        // Verify that all permits are from the same owner
        if (permitDataArray.length > 0) {
            address expectedOwner = permitDataArray[0].owner;

            // Check that all permits are from the same owner
            for (uint256 i = 0; i < permitDataArray.length; i++) {
                if (permitDataArray[i].owner != expectedOwner) {
                    revert InvalidSignature();
                }
            }

            // Verify signature is from the owner
            if (recovered != expectedOwner) {
                revert InvalidSignature();
            }
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
     * @notice Emergency function to recover accidentally sent tokens
     * @dev Only recovers tokens sent directly to contract, not user funds
     */
    function recoverToken(address token, address to, uint256 amount) external {
        // This should be restricted to owner/admin in production
        // Add access control like Ownable
        require(msg.sender == address(0x123), "Unauthorized"); // Replace with proper admin

        if (token == address(0)) {
            payable(to).transfer(amount);
        } else {
            IERC20(token).transfer(to, amount);
        }
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}
