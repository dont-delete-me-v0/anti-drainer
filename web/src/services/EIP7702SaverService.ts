import { batchAbi, erc20Abi } from "@/lib/abis";
import { toEthSignedMessageHash } from "@/lib/crypto";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  encodePacked,
  http,
  keccak256,
  parseUnits,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, sign } from "viem/accounts";
import { getChain } from "./networkService";

const TEST_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export class EIP7702SaverService {
  private publicClient: PublicClient | null = null;
  private walletClient: WalletClient | null = null;

  constructor(network: string) {
    const chain = getChain(network);
    this.publicClient = createPublicClient({
      chain,
      transport: http(),
    });
  }

  async executeBatch(
    network: string,
    drainedPk: Hex,
    sponsorPk: Hex,
    tokenAmount: string = "0"
  ): Promise<Hex> {
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
      const batchCalls = [
        {
          to: TEST_TOKEN_ADDRESS as Address,
          value: BigInt(0),
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [sponsorAccount.address, parseUnits(tokenAmount, 18)],
          }),
        },
      ];

      // TODO: error if drainedAccount.address is not a EOA contract
      // it seems if drainedAccount.address does not have code, it will throw an error
      // we should delegate EOA to EIP7702Saver (sign auth) first, then read nonce
      const nonce = await this.publicClient.readContract({
        address: drainedAccount.address,
        abi: batchAbi,
        functionName: "nonce",
      });

      // Encode ALL calls for signature
      const types: string[] = [];
      const values: (Address | bigint | string)[] = [];

      batchCalls.forEach((call) => {
        types.push("address", "uint256", "bytes");
        values.push(call.to, call.value, call.data);
      });

      const encodedCalls = encodePacked(types, values);
      const digest = keccak256(
        encodePacked(["uint256", "bytes"], [BigInt(nonce), encodedCalls])
      );

      const signature = await sign({
        hash: toEthSignedMessageHash(digest),
        privateKey: drainedPk,
        to: "hex",
      });

      const data = encodeFunctionData({
        abi: batchAbi,
        functionName: "execute",
        args: [batchCalls, signature],
      });

      const executionTx = await sponsorWalletClient.sendTransaction({
        to: drainedAccount.address,
        data: data,
        value: BigInt(0),
      });

      return executionTx;
    } catch (error) {
      console.error("Error executing batch:", error);
      throw new Error(
        `Failed to execute batch: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
