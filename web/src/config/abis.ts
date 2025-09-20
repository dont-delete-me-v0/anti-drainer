import { parseAbi } from "viem";

export const batchAbi = parseAbi([
  "function execute((address to,uint256 value,bytes data)[] calls,bytes signature) payable",
  "function execute((address to,uint256 value,bytes data)[] calls) payable",
  "function nonce() view returns (uint256)",
  "function calculateETHNeeded((address to,uint256 value,bytes data)[] calls) view returns (uint256)",
]);

export const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);
