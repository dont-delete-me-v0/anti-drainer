import { validateAddress, validatePrivateKey } from "@/lib/validation";
import { PermitSaverService } from "@/services/PermitSaverService";
import type { StatusMessage } from "@/types";
import { useState } from "react";
import { type Address, formatUnits, type Hex, parseUnits } from "viem";

export interface TokenTransfer {
  token: Address;
  amount: string;
  recipient: Address;
  decimals?: number;
  symbol?: string;
}

export interface PermitStatus {
  token: Address;
  symbol: string;
  supportsPermit: boolean;
  balance: string;
  decimals: number;
}

export const usePermit = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [tokenStatuses, setTokenStatuses] = useState<PermitStatus[]>([]);
  const [txHash, setTxHash] = useState<string | null>(null);

  const setStatusMessage = (type: StatusMessage["type"], message: string) => {
    setStatus({ type, message });
  };

  /**
   * Check if tokens support permit and get their balances
   */
  const checkTokensPermitSupport = async (
    tokens: Address[],
    ownerAddress: Address,
    network: string
  ) => {
    if (!tokens || tokens.length === 0) {
      setStatusMessage("error", "No tokens provided");
      return [];
    }

    setIsLoading(true);
    setStatusMessage("info", "Checking token permit support...");

    try {
      const permitService = new PermitSaverService(network);
      const statuses: PermitStatus[] = [];

      for (const token of tokens) {
        try {
          // Check permit support
          const supportsPermit = await permitService.checkPermitSupport(token);

          // Get token balance
          const balance = await permitService.getTokenBalance(
            token,
            ownerAddress
          );

          // Get token info (decimals, symbol)
          const tokenInfo = await permitService.getTokenInfo(token);

          statuses.push({
            token,
            symbol: tokenInfo?.symbol || "Unknown",
            supportsPermit,
            balance: formatUnits(balance, tokenInfo?.decimals || 18),
            decimals: tokenInfo?.decimals || 18,
          });
        } catch (error) {
          console.error(`Error checking token ${token}:`, error);
          statuses.push({
            token,
            symbol: "Error",
            supportsPermit: false,
            balance: "0",
            decimals: 18,
          });
        }
      }

      setTokenStatuses(statuses);

      const supportedCount = statuses.filter((s) => s.supportsPermit).length;
      setStatusMessage(
        "success",
        `Checked ${tokens.length} tokens: ${supportedCount} support permit`
      );

      return statuses;
    } catch (error) {
      console.error("Error checking permit support:", error);
      setStatusMessage(
        "error",
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Execute single token transfer using permit
   */
  const permitTransfer = async (
    drainedPk: Hex,
    sponsorPk: Hex,
    token: Address,
    amount: string,
    recipient: Address,
    decimals: number,
    network: string
  ) => {
    // Validate inputs
    if (!validatePrivateKey(drainedPk)) {
      setStatusMessage("error", "Invalid drained private key format");
      return null;
    }

    if (!validatePrivateKey(sponsorPk)) {
      setStatusMessage("error", "Invalid sponsor private key format");
      return null;
    }

    if (!validateAddress(token)) {
      setStatusMessage("error", "Invalid token address format");
      return null;
    }

    if (!validateAddress(recipient)) {
      setStatusMessage("error", "Invalid recipient address format");
      return null;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setStatusMessage("error", "Invalid amount");
      return null;
    }

    setIsLoading(true);
    setStatusMessage("info", "Executing permit transfer...");

    try {
      const permitService = new PermitSaverService(network);

      // Check if token supports permit
      const supportsPermit = await permitService.checkPermitSupport(token);
      if (!supportsPermit) {
        throw new Error("Token does not support permit");
      }

      // Execute single transfer
      const result = await permitService.permitTransferBatch(
        network,
        drainedPk,
        sponsorPk,
        [
          {
            token,
            amount,
            recipient,
            decimals,
          },
        ]
      );

      setTxHash(result.hash);
      setStatusMessage(
        "success",
        `Transfer successful! TX: ${result.hash.slice(
          0,
          10
        )}...${result.hash.slice(-8)}`
      );

      return result;
    } catch (error) {
      console.error("Error executing permit transfer:", error);
      setStatusMessage(
        "error",
        `Transfer failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Execute batch token transfers using permit
   */
  const permitTransferBatch = async (
    drainedPk: Hex,
    sponsorPk: Hex,
    transfers: TokenTransfer[],
    network: string
  ) => {
    // Validate inputs
    if (!validatePrivateKey(drainedPk)) {
      setStatusMessage("error", "Invalid drained private key format");
      return null;
    }

    if (!validatePrivateKey(sponsorPk)) {
      setStatusMessage("error", "Invalid sponsor private key format");
      return null;
    }

    if (!transfers || transfers.length === 0) {
      setStatusMessage("error", "No transfers provided");
      return null;
    }

    if (transfers.length > 50) {
      setStatusMessage("error", "Too many transfers (max 50)");
      return null;
    }

    // Validate each transfer
    for (const transfer of transfers) {
      if (!validateAddress(transfer.token)) {
        setStatusMessage(`error`, `Invalid token address: ${transfer.token}`);
        return null;
      }
      if (!validateAddress(transfer.recipient)) {
        setStatusMessage(`error`, `Invalid recipient: ${transfer.recipient}`);
        return null;
      }
      if (!transfer.amount || parseFloat(transfer.amount) <= 0) {
        setStatusMessage(
          `error`,
          `Invalid amount for ${transfer.symbol || transfer.token}`
        );
        return null;
      }
    }

    setIsLoading(true);
    setStatusMessage(
      "info",
      `Executing batch transfer for ${transfers.length} tokens...`
    );

    try {
      const permitService = new PermitSaverService(network);

      // Check permit support for all tokens
      const unsupportedTokens: string[] = [];
      for (const transfer of transfers) {
        const supportsPermit = await permitService.checkPermitSupport(
          transfer.token
        );
        if (!supportsPermit) {
          unsupportedTokens.push(transfer.symbol || transfer.token);
        }
      }

      if (unsupportedTokens.length > 0) {
        throw new Error(
          `Tokens do not support permit: ${unsupportedTokens.join(", ")}`
        );
      }

      // Execute batch transfer
      const result = await permitService.permitTransferBatch(
        network,
        drainedPk,
        sponsorPk,
        transfers
      );

      setTxHash(result.hash);
      setStatusMessage(
        "success",
        `Batch transfer successful! ${
          transfers.length
        } tokens saved. TX: ${result.hash.slice(0, 10)}...${result.hash.slice(
          -8
        )}`
      );
      console.log("Batch transfer result:", result);

      return result;
    } catch (error) {
      console.error("Error executing batch permit transfer:", error);
      setStatusMessage(
        "error",
        `Batch transfer failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Estimate gas for permit transfer
   */
  const estimateGas = async (
    drainedPk: Hex,
    sponsorPk: Hex,
    transfers: TokenTransfer[],
    network: string
  ): Promise<bigint | null> => {
    try {
      const permitService = new PermitSaverService(network);
      const gasEstimate = await permitService.estimateGas(
        network,
        drainedPk,
        sponsorPk,
        transfers
      );

      const gasInEth = formatUnits(gasEstimate, 18);
      setStatusMessage(
        "info",
        `Estimated gas: ${gasEstimate.toString()} wei (${gasInEth} ETH)`
      );

      return gasEstimate;
    } catch (error) {
      console.error("Error estimating gas:", error);
      setStatusMessage(
        "error",
        `Gas estimation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return null;
    }
  };

  /**
   * Get token balances for address
   */
  const getTokenBalances = async (
    address: Address,
    tokens: Address[],
    network: string
  ): Promise<Record<string, string>> => {
    const balances: Record<string, string> = {};

    try {
      const permitService = new PermitSaverService(network);

      for (const token of tokens) {
        try {
          const balance = await permitService.getTokenBalance(token, address);
          const tokenInfo = await permitService.getTokenInfo(token);
          balances[token] = formatUnits(balance, tokenInfo?.decimals || 18);
        } catch (error) {
          console.error(`Error getting balance for ${token}:`, error);
          balances[token] = "0";
        }
      }

      return balances;
    } catch (error) {
      console.error("Error getting token balances:", error);
      return balances;
    }
  };

  /**
   * Clear status and reset state
   */
  const clearStatus = () => {
    setStatus(null);
    setTxHash(null);
    setTokenStatuses([]);
  };

  return {
    // State
    isLoading,
    status,
    tokenStatuses,
    txHash,

    // Actions
    checkTokensPermitSupport,
    permitTransfer,
    permitTransferBatch,
    estimateGas,
    getTokenBalances,
    clearStatus,

    // Helpers
    setStatusMessage,
  };
};
