import { parseAbi } from "viem";

// EIP7702Saver contract ABI
export const batchAbi = parseAbi([
  "function execute((address to,uint256 value,bytes data)[] calls,bytes signature) payable",
  "function execute((address to,uint256 value,bytes data)[] calls) payable",
  "function nonce() view returns (uint256)",
  "function calculateETHNeeded((address to,uint256 value,bytes data)[] calls) view returns (uint256)",
]);

// Standard ERC20 ABI
export const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);

// ERC20 Permit extension ABI
export const erc20PermitAbi = parseAbi([
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
  "function nonces(address owner) view returns (uint256)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  "function PERMIT_TYPEHASH() view returns (bytes32)",
  "function name() view returns (string)",
  "function version() view returns (string)",
]);

// PermitSaver contract ABI
export const permitSaverAbi = parseAbi([
  // Single transfer with signature (sponsored)
  "function permitTransferWithSignature((address token, address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) permitData, (address token, address to, uint256 amount) transferData, bytes signature) external",

  // Batch transfer with signature (sponsored)
  "function permitTransferBatchWithSignature((address token, address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)[] permitDataArray, (address token, address to, uint256 amount)[] transferDataArray, bytes signature) external",

  // View functions
  "function getContractInfo() view returns (uint256 currentNonce, uint256 maxBatchSize)",
  "function nonce() view returns (uint256)",
  "function MAX_BATCH_SIZE() view returns (uint256)",

  // Events
  "event TokenSaved(address indexed token, address indexed from, address indexed to, uint256 amount)",
  "event BatchExecuted(uint256 indexed nonce, uint256 transfersCount, address indexed executor)",

  // Errors
  "error InvalidSignature()",
  "error PermitFailed(address token, string reason)",
  "error TransferFailed(address token, string reason)",
  "error BatchTooLarge()",
  "error InvalidToken()",
  "error PermitExpired()",
  "error ArrayLengthMismatch()",
  "error InvalidSpender()",

  // Emergency functions (should be restricted in production)
  "function recoverToken(address token, address to, uint256 amount) external",

  // Receive ETH
  "receive() external payable",
]);
