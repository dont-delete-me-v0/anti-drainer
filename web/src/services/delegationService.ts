import type { DelegationResult } from "@/types";
import {
  createPublicClient,
  createWalletClient,
  http,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getChain } from "./networkService";

export class DelegationService {
  private publicClient: PublicClient | null = null;
  private walletClient: WalletClient | null = null;

  constructor(network: string) {
    const chain = getChain(network);
    this.publicClient = createPublicClient({
      chain,
      transport: http(),
    });
  }

  async checkDelegation(drainedPk: Hex): Promise<DelegationResult> {
    if (!this.publicClient) {
      throw new Error("Public client not initialized");
    }

    const drainedAccount = privateKeyToAccount(drainedPk);

    try {
      const bytecode = await this.publicClient.getCode({
        address: drainedAccount.address,
      });
      if (!bytecode) {
        return { hasDelegation: false };
      } else if (bytecode === "0x") {
        return { hasDelegation: false };
      } else if (bytecode.startsWith("0xef0100")) {
        const delegatedAddress = "0x" + bytecode.slice(8);
        return {
          hasDelegation: true,
          delegatedAddress: delegatedAddress as Address,
        };
      } else {
        throw new Error("Unknown bytecode");
      }
    } catch (error) {
      console.error("Error checking delegation:", error);
      throw new Error(
        `Failed to check delegation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // NOTE: dev method for testing, self execute.
  async setDelegation(
    network: string,
    drainedPk: Hex,
    delegateAddr: Address
  ): Promise<Hex> {
    const chain = getChain(network);
    const drainedAccount = privateKeyToAccount(drainedPk);
    const drainedWalletClient = createWalletClient({
      account: drainedAccount,
      chain: chain,
      transport: http(),
    });

    try {
      const auth = await drainedWalletClient.signAuthorization({
        contractAddress: delegateAddr,
        executor: "self",
      });

      const hash = await drainedWalletClient.sendTransaction({
        authorizationList: [auth],
        data: "0x",
        to: drainedWalletClient.account.address,
      });

      return hash;
    } catch (error) {
      console.error("Authorization failed:", error);
      throw new Error(
        `Failed to set delegation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async revokeDelegation(
    network: string,
    drainedPk: Hex,
    sponsorPk: Hex
  ): Promise<Hex> {
    const chain = getChain(network);
    const drainedAccount = privateKeyToAccount(drainedPk);
    const sponsorAccount = privateKeyToAccount(sponsorPk);

    const delegationResult = await this.checkDelegation(drainedPk);
    if (!delegationResult.hasDelegation) {
      throw new Error("No delegation found to revoke");
    }

    const drainedWalletClient = createWalletClient({
      account: drainedAccount,
      chain: chain,
      transport: http(),
    });
    const sponsorWalletClient = createWalletClient({
      account: sponsorAccount,
      chain: chain,
      transport: http(),
    });

    try {
      const auth = await drainedWalletClient.signAuthorization({
        contractAddress: zeroAddress,
        executor: sponsorAccount.address,
      });

      const hash = await sponsorWalletClient.sendTransaction({
        authorizationList: [auth],
        data: "0x",
        to: drainedAccount.address,
      });

      return hash;
    } catch (error) {
      console.error("Revocation failed:", error);
      throw new Error(
        `Failed to revoke delegation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
