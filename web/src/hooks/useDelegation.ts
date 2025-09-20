import { validateAddress, validatePrivateKey } from "@/lib/validation";
import { DelegationService } from "@/services/delegationService";
import { EIP7702SaverService } from "@/services/EIP7702SaverService";
import type { StatusMessage } from "@/types";
import { useState } from "react";
import { Address, type Hex } from "viem";

export const useDelegation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const setStatusMessage = (type: StatusMessage["type"], message: string) => {
    setStatus({ type, message });
  };

  const checkDelegation = async (drainedPk: Hex, network: string) => {
    if (!drainedPk || !validatePrivateKey(drainedPk)) {
      setStatusMessage("error", "Invalid drained private key format");
      return;
    }

    setIsLoading(true);
    setStatusMessage("info", "Checking delegation...");

    try {
      const delegationService = new DelegationService(network);
      const result = await delegationService.checkDelegation(drainedPk);
      if (result.hasDelegation) {
        setStatusMessage(
          "success",
          `Delegation found: ${result.delegatedAddress}`
        );
      } else {
        setStatusMessage("success", "No delegation found");
      }
      return result;
    } catch (error) {
      console.error("Error checking delegation:", error);
      setStatusMessage(
        "error",
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const setDelegation = async (
    drainedPk: Hex,
    delegateAddr: Address,
    network: string
  ) => {
    if (!drainedPk || !validatePrivateKey(drainedPk)) {
      setStatusMessage("error", "Invalid drained private key format");
      return;
    }

    if (!delegateAddr || !validateAddress(delegateAddr)) {
      setStatusMessage("error", "Invalid delegate address format");
      return;
    }

    setIsLoading(true);
    setStatusMessage("info", "Setting delegation...");

    try {
      const delegationService = new DelegationService(network);
      const hash = await delegationService.setDelegation(
        network,
        drainedPk,
        delegateAddr
      );

      setStatusMessage("success", `Authorization successful! TX hash: ${hash}`);
      return hash;
    } catch (error) {
      setStatusMessage(
        "error",
        error instanceof Error ? error.message : "Unknown error"
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const revokeDelegation = async (
    drainedPk: Hex,
    sponsorPk: Hex,
    network: string
  ) => {
    if (!drainedPk || !validatePrivateKey(drainedPk)) {
      setStatusMessage("error", "Invalid drained private key format");
      return;
    }

    if (!sponsorPk || !validatePrivateKey(sponsorPk)) {
      setStatusMessage("error", "Invalid sponsor private key format");
      return;
    }

    setIsLoading(true);
    setStatusMessage("info", "Revoking delegation...");

    try {
      const delegationService = new DelegationService(network);
      const hash = await delegationService.revokeDelegation(
        network,
        drainedPk,
        sponsorPk
      );

      setStatusMessage(
        "success",
        `Sponsored revocation successful! TX hash: ${hash}`
      );
      return hash;
    } catch (error) {
      setStatusMessage(
        "error",
        error instanceof Error ? error.message : "Unknown error"
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const saveTestTokens = async (
    drainedPk: Hex,
    sponsorPk: Hex,
    network: string
  ) => {
    if (!drainedPk || !validatePrivateKey(drainedPk)) {
      setStatusMessage("error", "Invalid drained private key format");
      return;
    }

    if (!sponsorPk || !validatePrivateKey(sponsorPk)) {
      setStatusMessage("error", "Invalid sponsor private key format");
      return;
    }

    setIsLoading(true);
    setStatusMessage("info", "Saving test tokens...");

    try {
      const tokenAmount = "1000";
      const tokenService = new EIP7702SaverService(network);
      const hash = await tokenService.executeBatch(
        network,
        drainedPk,
        sponsorPk,
        tokenAmount
      );

      setStatusMessage("success", `Execution successful! TX hash: ${hash}`);
      return hash;
    } catch (error) {
      setStatusMessage(
        "error",
        error instanceof Error ? error.message : "Unknown error"
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    status,
    checkDelegation,
    setDelegation,
    revokeDelegation,
    saveTestTokens,
  };
};
