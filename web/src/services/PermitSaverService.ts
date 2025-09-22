import { erc20Abi, erc20PermitAbi, permitSaverAbi } from "@/lib/abis";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  encodePacked,
  http,
  keccak256,
  parseUnits,
  toHex,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getChain } from "./networkService";

export interface PermitData {
  token: Address;
  owner: Address;
  spender: Address;
  value: bigint;
  deadline: bigint;
  v: number;
  r: Hex;
  s: Hex;
}

export interface TransferData {
  token: Address;
  to: Address;
  amount: bigint;
}

// EIP-712 Domain structure
const EIP712_DOMAIN = {
  name: "EIP-712 Domain",
  version: "1",
  chainId: 1, // Will be updated dynamically
  verifyingContract: "0x0000000000000000000000000000000000000000" as Address,
};

// Permit type structure for EIP-712
const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

const permitSaverAddress =
  "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" as Address; // TODO: Update with deployed address

export class PermitSaverService {
  private publicClient: PublicClient | null = null;
  private chainId: number;

  constructor(network: string) {
    const chain = getChain(network);
    this.chainId = chain.id;
    this.publicClient = createPublicClient({
      chain,
      transport: http(),
    });
  }

  async checkPermitSupport(token: Address): Promise<boolean> {
    if (!this.publicClient) {
      throw new Error("Public client not initialized");
    }

    try {
      await this.publicClient.readContract({
        address: token,
        abi: erc20PermitAbi,
        functionName: "DOMAIN_SEPARATOR",
      });
      return true;
    } catch (error) {
      console.error("Token does not support permit:", error);
      return false;
    }
  }

  async getTokenBalance(token: Address, account: Address): Promise<bigint> {
    if (!this.publicClient) {
      throw new Error("Public client not initialized");
    }

    try {
      const balance = await this.publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account],
      });
      return balance;
    } catch (error) {
      console.error("Error getting token balance:", error);
      return BigInt(0);
    }
  }

  /**
   * Get token name for EIP-712 domain
   */
  private async getTokenName(token: Address): Promise<string> {
    if (!this.publicClient) throw new Error("Public client not initialized");

    try {
      const name = await this.publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "name",
      });
      return name as string;
    } catch {
      return "Unknown Token";
    }
  }

  /**
   * Create permit signature using EIP-712
   */
  private async createPermitSignature(
    account: ReturnType<typeof privateKeyToAccount>,
    token: Address,
    spender: Address,
    value: bigint,
    nonce: bigint,
    deadline: bigint
  ): Promise<{ v: number; r: Hex; s: Hex }> {
    // Get token name for domain
    const tokenName = await this.getTokenName(token);

    // EIP-712 Domain
    const domain = {
      name: tokenName,
      version: "1",
      chainId: this.chainId,
      verifyingContract: token,
    };

    // EIP-712 Types
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    // EIP-712 Value
    const message = {
      owner: account.address,
      spender: spender,
      value: value,
      nonce: nonce,
      deadline: deadline,
    };

    // Sign typed data
    const signature = await account.signTypedData({
      domain,
      types,
      primaryType: "Permit",
      message,
    });

    // Parse signature
    const sig = signature.slice(2);
    const r = `0x${sig.slice(0, 64)}` as Hex;
    const s = `0x${sig.slice(64, 128)}` as Hex;
    const v = parseInt(sig.slice(128, 130), 16);

    // EIP-155 adjustment is not needed for EIP-712 signatures
    // The signature already includes the correct v value (27 or 28)

    return { v, r, s };
  }

  /**
   * Create signature for batch execution verification
   */
  private async createBatchSignature(
    drainedAccount: ReturnType<typeof privateKeyToAccount>,
    permitDataArray: PermitData[],
    transferDataArray: TransferData[],
    contractNonce: bigint
  ): Promise<Hex> {
    // Create message hash for batch
    let messageHash = keccak256(
      encodePacked(
        ["uint256", "uint256", "uint256"],
        [
          BigInt(permitDataArray.length),
          BigInt(transferDataArray.length),
          contractNonce,
        ]
      )
    );

    // Add each permit and transfer data to hash
    for (let i = 0; i < permitDataArray.length; i++) {
      messageHash = keccak256(
        encodePacked(
          [
            "bytes32",
            "address",
            "address",
            "address",
            "uint256",
            "uint256",
            "address",
            "address",
            "uint256",
          ],
          [
            messageHash,
            permitDataArray[i].token,
            permitDataArray[i].owner,
            permitDataArray[i].spender,
            permitDataArray[i].value,
            permitDataArray[i].deadline,
            transferDataArray[i].token,
            transferDataArray[i].to,
            transferDataArray[i].amount,
          ]
        )
      );
    }

    // Sign with Ethereum signed message prefix
    const signature = await drainedAccount.signMessage({
      message: { raw: messageHash },
    });

    return signature;
  }

  async permitTransferBatch(
    network: string,
    drainedPk: Hex,
    sponsorPk: Hex,
    transfers: Array<{
      token: Address;
      amount: string;
      recipient: Address;
      decimals?: number;
    }>
  ) {
    if (!this.publicClient) {
      throw new Error("Public client not initialized");
    }

    const chain = getChain(network);
    const drainedAccount = privateKeyToAccount(drainedPk);
    const sponsorAccount = privateKeyToAccount(sponsorPk);

    const sponsorWalletClient = createWalletClient({
      account: sponsorAccount,
      chain: chain,
      transport: http(),
    });

    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
      const permitDataArray: PermitData[] = [];
      const transferDataArray: TransferData[] = [];

      // Get contract nonce for replay protection
      const contractNonce = await this.publicClient.readContract({
        address: permitSaverAddress,
        abi: permitSaverAbi,
        functionName: "nonce",
      });

      // Prepare permit and transfer data for each token
      for (const transfer of transfers) {
        // Check if token supports permit
        const supportsPermit = await this.checkPermitSupport(transfer.token);
        if (!supportsPermit) {
          throw new Error(`Token ${transfer.token} does not support permit`);
        }

        const decimals = transfer.decimals ?? 18;
        const amountBigInt = parseUnits(transfer.amount, decimals);

        // Get token nonce for permit
        const tokenNonce = await this.publicClient.readContract({
          address: transfer.token,
          abi: erc20PermitAbi,
          functionName: "nonces",
          args: [drainedAccount.address],
        });

        // Create permit signature using EIP-712
        const { v, r, s } = await this.createPermitSignature(
          drainedAccount,
          transfer.token,
          permitSaverAddress,
          amountBigInt,
          tokenNonce as bigint,
          deadline
        );

        // Create permit data
        const permitData: PermitData = {
          token: transfer.token,
          owner: drainedAccount.address,
          spender: permitSaverAddress,
          value: amountBigInt,
          deadline: deadline,
          v: v,
          r: r,
          s: s,
        };

        // Create transfer data
        const transferData: TransferData = {
          token: transfer.token,
          to: transfer.recipient,
          amount: amountBigInt,
        };

        permitDataArray.push(permitData);
        transferDataArray.push(transferData);

        console.log(`Prepared permit for token ${transfer.token}:`, {
          owner: drainedAccount.address,
          spender: permitSaverAddress,
          value: amountBigInt.toString(),
          deadline: deadline.toString(),
          nonce: tokenNonce.toString(),
          v,
          r,
          s,
        });
      }

      // Create batch signature for sponsored execution
      const batchSignature = await this.createBatchSignature(
        drainedAccount,
        permitDataArray,
        transferDataArray,
        contractNonce as bigint
      );

      console.log("Batch signature created:", batchSignature);

      // Encode function call
      const functionData = encodeFunctionData({
        abi: permitSaverAbi,
        functionName: "permitTransferBatchWithSignature",
        args: [permitDataArray, transferDataArray, batchSignature],
      });

      // Estimate gas
      const gasEstimate = await this.publicClient.estimateGas({
        account: sponsorAccount.address,
        to: permitSaverAddress,
        data: functionData,
      });

      console.log("Estimated gas:", gasEstimate);

      // Send transaction via sponsor
      const hash = await sponsorWalletClient.sendTransaction({
        to: permitSaverAddress,
        data: functionData,
        gas: (gasEstimate * BigInt(120)) / BigInt(100), // Add 20% buffer
      });

      console.log("Transaction sent:", hash);

      // Wait for transaction receipt
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
      });

      console.log("Transaction confirmed:", receipt);

      return {
        hash,
        receipt,
        permitDataArray,
        transferDataArray,
      };
    } catch (error) {
      console.error("Error executing permit transfer batch:", error);
      throw new Error(
        `Failed to execute permit transfer batch: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Helper function to get token decimals
   */
  async getTokenDecimals(token: Address): Promise<number> {
    if (!this.publicClient) {
      throw new Error("Public client not initialized");
    }

    try {
      const decimals = await this.publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "decimals",
      });
      return Number(decimals);
    } catch (error) {
      console.error("Error getting token decimals:", error);
      return 18; // Default to 18 decimals
    }
  }

  /**
   * Get complete token information
   */
  async getTokenInfo(token: Address): Promise<{
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: bigint;
    supportsPermit: boolean;
  } | null> {
    if (!this.publicClient) {
      throw new Error("Public client not initialized");
    }

    try {
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        this.publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "name",
        }),
        this.publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "symbol",
        }),
        this.publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "decimals",
        }),
        this.publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "totalSupply",
        }),
      ]);

      const supportsPermit = await this.checkPermitSupport(token);

      return {
        name: name as string,
        symbol: symbol as string,
        decimals: Number(decimals),
        totalSupply: totalSupply as bigint,
        supportsPermit,
      };
    } catch (error) {
      console.error("Error getting token info:", error);
      return null;
    }
  }

  /**
   * Estimate gas for permit transfer batch
   */
  async estimateGas(
    network: string,
    drainedPk: Hex,
    sponsorPk: Hex,
    transfers: Array<{
      token: Address;
      amount: string;
      recipient: Address;
      decimals?: number;
    }>
  ): Promise<bigint> {
    if (!this.publicClient) {
      throw new Error("Public client not initialized");
    }

    const sponsorAccount = privateKeyToAccount(sponsorPk);
    const drainedAccount = privateKeyToAccount(drainedPk);

    try {
      // Prepare minimal data for gas estimation
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const permitDataArray: PermitData[] = [];
      const transferDataArray: TransferData[] = [];

      for (const transfer of transfers) {
        const decimals = transfer.decimals ?? 18;
        const amountBigInt = parseUnits(transfer.amount, decimals);

        // Mock permit data for gas estimation
        permitDataArray.push({
          token: transfer.token,
          owner: drainedAccount.address,
          spender: permitSaverAddress,
          value: amountBigInt,
          deadline: deadline,
          v: 28,
          r: ("0x" + "0".repeat(64)) as Hex,
          s: ("0x" + "0".repeat(64)) as Hex,
        });

        transferDataArray.push({
          token: transfer.token,
          to: transfer.recipient,
          amount: amountBigInt,
        });
      }

      // Mock signature for gas estimation
      const mockSignature = ("0x" + "0".repeat(130)) as Hex;

      // Encode function call
      const functionData = encodeFunctionData({
        abi: permitSaverAbi,
        functionName: "permitTransferBatchWithSignature",
        args: [permitDataArray, transferDataArray, mockSignature],
      });

      // Estimate gas
      const gasEstimate = await this.publicClient.estimateGas({
        account: sponsorAccount.address,
        to: permitSaverAddress,
        data: functionData,
      });

      // Add 30% buffer for safety
      return (gasEstimate * BigInt(130)) / BigInt(100);
    } catch (error) {
      console.error("Error estimating gas:", error);
      // Return default high estimate if estimation fails
      return BigInt(500000) * BigInt(transfers.length);
    }
  }
}
