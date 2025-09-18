"use client";

import { useState } from "react";

import {
  createPublicClient,
  createWalletClient,
  http,
  zeroAddress,
  type Account,
  type Chain,
  type Transport,
  type WalletClient,
} from "viem";

import {
  arbitrum,
  bsc,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from "viem/chains";

import { privateKeyToAccount } from "viem/accounts";

function getChain(network: string): Chain {
  switch (network) {
    case "mainnet":
      return mainnet;
    case "sepolia":
      return sepolia;
    case "polygon":
      return polygon;
    case "bsc":
      return bsc;
    case "arbitrum":
      return arbitrum;
    case "optimism":
      return optimism;
    default:
      return mainnet; // По умолчанию возвращаем mainnet
  }
}

export default function Home() {
  const [selectedNetwork, setSelectedNetwork] = useState<string>("mainnet");
  const [status, setStatus] = useState<string>("");

  // Revocation state
  const [drainedPk, setDrainedPk] = useState<string>(
    "0xdd13c79c01e2201431a2867e3f7acf433f139a9d9871347cf0c2561775e6c8d5"
  );
  const [sponsorPk, setSponsorPk] = useState<string>("");
  const [delegateAddr, setDelegateAddr] = useState<string>(
    "0xbB81E6C37BEFf16956c198D11E7E6e8fDb9fa064"
  );

  const checkDelegation = async () => {
    if (!drainedPk) {
      setStatus("❌ Please enter drained private key");
      return;
    }

    if (!drainedPk.startsWith("0x") || drainedPk.length !== 66) {
      setStatus("❌ Invalid private key format");
      return;
    }

    setStatus("⏳ Creating public client...");

    try {
      const drainedAccount = privateKeyToAccount(drainedPk as `0x${string}`);
      const publicClient = createPublicClient({
        chain: getChain(selectedNetwork),
        transport: http(),
      });
      const bytecode = await publicClient.getCode({
        address: drainedAccount.address,
      });
      console.log(bytecode);
      if (bytecode === "0x") {
        setStatus("✅ No delegation found");
        return undefined;
      } else if (bytecode?.startsWith("0xef0100")) {
        setStatus("✅ Delegation found");
        // Extract the delegated address (remove 0xef0100 prefix)
        const delegatedAddress = "0x" + bytecode.slice(8); // Remove 0xef0100 (8 chars)
        return delegatedAddress;
      } else {
        setStatus("❌ Unknown bytecode");
        return undefined;
      }
    } catch (error) {
      console.error("Error checking delegation:", error);
      setStatus(
        `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return undefined;
    }
  };

  const setAuthorization = async () => {
    if (!drainedPk) {
      setStatus("❌ Please enter drained private key");
      return;
    }

    if (!drainedPk.startsWith("0x") || drainedPk.length !== 66) {
      setStatus("❌ Invalid private key format");
      return;
    }

    setStatus("⏳ Creating wallet client...");

    try {
      const drainedAccount = privateKeyToAccount(drainedPk as `0x${string}`);
      const drainedWalletClient = createWalletClient({
        account: drainedAccount,
        chain: getChain(selectedNetwork),
        transport: http(),
      });

      setStatus("⏳ Signing authorization...");

      const auth = await drainedWalletClient.signAuthorization({
        contractAddress: delegateAddr as `0x${string}`,
        executor: "self",
      });

      setStatus("⏳ Sending transaction...");

      const hash = await drainedWalletClient.sendTransaction({
        authorizationList: [auth],
        data: "0x",
        to: drainedWalletClient.account.address,
      });

      setStatus("✅ Authorization successful! TX hash: " + hash);
    } catch (error) {
      console.error("Authorization failed:", error);
      setStatus(
        `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const resetAuthorization = async () => {
    if (!drainedPk) {
      setStatus("❌ Please enter drained private key");
      return;
    }

    if (!drainedPk.startsWith("0x") || drainedPk.length !== 66) {
      setStatus("❌ Invalid private key format");
      return;
    }

    setStatus("⏳ Creating wallet client...");

    try {
      const delegatedAddress = await checkDelegation();
      if (!delegatedAddress) {
        setStatus("❌ No delegation found");
        return;
      }

      const drainedAccount = privateKeyToAccount(drainedPk as `0x${string}`);
      const drainedWalletClient = createWalletClient({
        account: drainedAccount,
        chain: getChain(selectedNetwork),
        transport: http(),
      });

      setStatus("⏳ Signing authorization...");

      const auth = await drainedWalletClient.signAuthorization({
        contractAddress: zeroAddress as `0x${string}`,
        executor: "self",
      });

      setStatus("⏳ Sending transaction...");

      const hash = await drainedWalletClient.sendTransaction({
        authorizationList: [auth],
        data: "0x",
        to: drainedWalletClient.account.address,
      });

      setStatus("✅ Authorization successful! TX hash: " + hash);
    } catch (error) {
      console.error("Authorization failed:", error);
      setStatus(
        `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  return (
    <div>
      <div>
        <label>Network </label>
        <select
          value={selectedNetwork}
          onChange={(e) => setSelectedNetwork(e.target.value)}
        >
          <option value="mainnet">Mainnet</option>
          <option value="sepolia">Sepolia</option>
          <option value="polygon">Polygon</option>
          <option value="bsc">BSC</option>
          <option value="arbitrum">Arbitrum</option>
          <option value="optimism">Optimism</option>
        </select>
      </div>

      <div>
        <label>Drained PK</label>
        <input
          type="text"
          value={drainedPk}
          onChange={(e) => setDrainedPk(e.target.value)}
        />
      </div>

      <div>
        <label>Sponsor PK</label>
        <input
          type="text"
          value={sponsorPk}
          onChange={(e) => setSponsorPk(e.target.value)}
        />
      </div>

      <div>
        <label>Delegate PK</label>
        <input
          type="text"
          value={delegateAddr}
          onChange={(e) => setDelegateAddr(e.target.value)}
        />
      </div>

      <div className="flex flex-col">
        <button onClick={setAuthorization} className="mb-2">
          Set Authorization
        </button>
        <button onClick={checkDelegation} className="mb-2">
          Check Delegation
        </button>
        <button onClick={resetAuthorization} className="mb-2">
          Reset Authorization
        </button>
      </div>

      <div>{status}</div>
    </div>
  );
}
