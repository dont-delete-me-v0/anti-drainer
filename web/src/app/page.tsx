"use client";

import { useState } from "react";

import {
  createPublicClient,
  createWalletClient,
  http,
  zeroAddress,
  type Chain,
} from "viem";

import { anvilLocal } from "@/config/chains";
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  XCircle,
} from "lucide-react";
import { privateKeyToAccount } from "viem/accounts";
import {
  arbitrum,
  bsc,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from "viem/chains";

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
    case "anvilLocal":
      return anvilLocal;
    default:
      return mainnet;
  }
}

interface StatusMessage {
  type: "success" | "error" | "warning" | "info";
  message: string;
}

export default function Home() {
  const [selectedNetwork, setSelectedNetwork] = useState<string>("anvilLocal");
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Revocation state
  const [drainedPk, setDrainedPk] = useState<string>(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );
  const [sponsorPk, setSponsorPk] = useState<string>(
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
  );
  const [delegateAddr, setDelegateAddr] = useState<string>(
    "0xbB81E6C37BEFf16956c198D11E7E6e8fDb9fa064"
  );

  // UI state
  const [showDrainedPk, setShowDrainedPk] = useState(false);
  const [showSponsorPk, setShowSponsorPk] = useState(false);

  const setStatusMessage = (type: StatusMessage["type"], message: string) => {
    setStatus({ type, message });
  };

  const validatePrivateKey = (pk: string): boolean => {
    return pk.startsWith("0x") && pk.length === 66;
  };

  const validateAddress = (addr: string): boolean => {
    return addr.startsWith("0x") && addr.length === 42;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setStatusMessage("info", "Copied to clipboard!");
  };

  const checkDelegation = async () => {
    if (!drainedPk) {
      setStatusMessage("error", "Please enter drained private key");
      return;
    }

    if (!validatePrivateKey(drainedPk)) {
      setStatusMessage("error", "Invalid private key format");
      return;
    }

    setIsLoading(true);
    setStatusMessage("info", "Creating public client...");

    try {
      const drainedAccount = privateKeyToAccount(drainedPk as `0x${string}`);
      const publicClient = createPublicClient({
        chain: getChain(selectedNetwork),
        transport: http(),
      });
      const bytecode = await publicClient.getCode({
        address: drainedAccount.address,
      });

      if (bytecode === "0x") {
        setStatusMessage("success", "No delegation found");
        return undefined;
      } else if (bytecode?.startsWith("0xef0100")) {
        setStatusMessage("success", "Delegation found");
        // Extract the delegated address (remove 0xef0100 prefix)
        const delegatedAddress = "0x" + bytecode.slice(8); // Remove 0xef0100 (8 chars)
        return delegatedAddress;
      } else {
        setStatusMessage("warning", "Unknown bytecode");
        return undefined;
      }
    } catch (error) {
      console.error("Error checking delegation:", error);
      setStatusMessage(
        "error",
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return undefined;
    } finally {
      setIsLoading(false);
    }
  };

  const setDelegation = async () => {
    if (!drainedPk) {
      setStatusMessage("error", "Please enter drained private key");
      return;
    }

    if (!validatePrivateKey(drainedPk)) {
      setStatusMessage("error", "Invalid private key format");
      return;
    }

    if (!validateAddress(delegateAddr)) {
      setStatusMessage("error", "Invalid delegate address format");
      return;
    }

    setIsLoading(true);
    setStatusMessage("info", "Creating wallet client...");

    try {
      const drainedAccount = privateKeyToAccount(drainedPk as `0x${string}`);
      const drainedWalletClient = createWalletClient({
        account: drainedAccount,
        chain: getChain(selectedNetwork),
        transport: http(),
      });

      setStatusMessage("info", "Signing authorization...");

      const auth = await drainedWalletClient.signAuthorization({
        contractAddress: delegateAddr as `0x${string}`,
        executor: "self",
      });

      setStatusMessage("info", "Sending transaction...");

      const hash = await drainedWalletClient.sendTransaction({
        authorizationList: [auth],
        data: "0x",
        to: drainedWalletClient.account.address,
      });

      setStatusMessage("success", `Authorization successful! TX hash: ${hash}`);
    } catch (error) {
      console.error("Authorization failed:", error);
      setStatusMessage(
        "error",
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const revokeDelegation = async () => {
    if (!drainedPk) {
      setStatusMessage("error", "Please enter drained private key");
      return;
    }

    if (!validatePrivateKey(drainedPk)) {
      setStatusMessage("error", "Invalid drained private key format");
      return;
    }

    if (!validatePrivateKey(sponsorPk)) {
      setStatusMessage("error", "Invalid sponsor private key format");
      return;
    }

    setIsLoading(true);
    setStatusMessage("info", "Creating wallet client...");

    try {
      const delegatedAddress = await checkDelegation();
      if (!delegatedAddress) {
        setStatusMessage("error", "No delegation found");
        return;
      }

      const drainedAccount = privateKeyToAccount(drainedPk as `0x${string}`);
      const sponsorAccount = privateKeyToAccount(sponsorPk as `0x${string}`);

      const drainedWalletClient = createWalletClient({
        account: drainedAccount,
        chain: getChain(selectedNetwork),
        transport: http(),
      });

      const sponsorWalletClient = createWalletClient({
        account: sponsorAccount,
        chain: getChain(selectedNetwork),
        transport: http(),
      });

      setStatusMessage("info", "Signing revoke with drained account...");

      const auth = await drainedWalletClient.signAuthorization({
        contractAddress: zeroAddress as `0x${string}`,
        executor: sponsorAccount.address,
      });

      const hash = await sponsorWalletClient.sendTransaction({
        authorizationList: [auth],
        data: "0x",
        to: drainedAccount.address,
      });

      setStatusMessage("info", "Sending transaction...");
      setStatusMessage(
        "success",
        `Sponsored revocation successful! TX hash: ${hash}`
      );
    } catch (error) {
      console.error("Authorization failed:", error);
      setStatusMessage(
        "error",
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const StatusIcon = ({ type }: { type: StatusMessage["type"] }) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "info":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const InputField = ({
    label,
    value,
    onChange,
    type = "text",
    placeholder,
    showToggle = false,
    onToggle,
    isValid = true,
    errorMessage,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    showToggle?: boolean;
    onToggle?: () => void;
    isValid?: boolean;
    errorMessage?: string;
  }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
            isValid ? "border-gray-300" : "border-red-500"
          }`}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            {type === "password" ? (
              <Eye className="w-5 h-5" />
            ) : (
              <EyeOff className="w-5 h-5" />
            )}
          </button>
        )}
        {value && (
          <button
            type="button"
            onClick={() => copyToClipboard(value)}
            className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            <Copy className="w-4 h-4" />
          </button>
        )}
      </div>
      {!isValid && errorMessage && (
        <p className="text-sm text-red-500">{errorMessage}</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">
              EIP-7702 Anti-Drainer
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Manage account delegation and protect against drain attacks using
            EIP-7702 authorization
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Network Selection */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Network
              </label>
              <select
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="mainnet">Ethereum Mainnet</option>
                <option value="sepolia">Sepolia Testnet</option>
                <option value="polygon">Polygon</option>
                <option value="bsc">BSC</option>
                <option value="arbitrum">Arbitrum</option>
                <option value="optimism">Optimism</option>
                <option value="anvilLocal">Anvil Local</option>
              </select>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <InputField
                label="Drained Private Key"
                value={drainedPk}
                onChange={setDrainedPk}
                type={showDrainedPk ? "text" : "password"}
                placeholder="0x..."
                showToggle={true}
                onToggle={() => setShowDrainedPk(!showDrainedPk)}
                isValid={!drainedPk || validatePrivateKey(drainedPk)}
                errorMessage={
                  drainedPk && !validatePrivateKey(drainedPk)
                    ? "Invalid private key format"
                    : undefined
                }
              />

              <InputField
                label="Sponsor Private Key"
                value={sponsorPk}
                onChange={setSponsorPk}
                type={showSponsorPk ? "text" : "password"}
                placeholder="0x..."
                showToggle={true}
                onToggle={() => setShowSponsorPk(!showSponsorPk)}
                isValid={!sponsorPk || validatePrivateKey(sponsorPk)}
                errorMessage={
                  sponsorPk && !validatePrivateKey(sponsorPk)
                    ? "Invalid private key format"
                    : undefined
                }
              />

              <div className="md:col-span-2">
                <InputField
                  label="Delegate Address"
                  value={delegateAddr}
                  onChange={setDelegateAddr}
                  placeholder="0x..."
                  isValid={!delegateAddr || validateAddress(delegateAddr)}
                  errorMessage={
                    delegateAddr && !validateAddress(delegateAddr)
                      ? "Invalid address format"
                      : undefined
                  }
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <button
                onClick={setDelegation}
                disabled={
                  isLoading ||
                  !validatePrivateKey(drainedPk) ||
                  !validateAddress(delegateAddr)
                }
                className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Shield className="w-5 h-5 mr-2" />
                )}
                Set Delegation
              </button>

              <button
                onClick={checkDelegation}
                disabled={isLoading || !validatePrivateKey(drainedPk)}
                className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-5 h-5 mr-2" />
                )}
                Check Delegation
              </button>

              <button
                onClick={revokeDelegation}
                disabled={
                  isLoading ||
                  !validatePrivateKey(drainedPk) ||
                  !validatePrivateKey(sponsorPk)
                }
                className="flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <XCircle className="w-5 h-5 mr-2" />
                )}
                Revoke Delegation
              </button>
            </div>

            {/* Status Message */}
            {status && (
              <div
                className={`flex items-center p-4 rounded-lg ${
                  status.type === "success"
                    ? "bg-green-50 border border-green-200"
                    : status.type === "error"
                    ? "bg-red-50 border border-red-200"
                    : status.type === "warning"
                    ? "bg-yellow-50 border border-yellow-200"
                    : "bg-blue-50 border border-blue-200"
                }`}
              >
                <StatusIcon type={status.type} />
                <p
                  className={`ml-3 ${
                    status.type === "success"
                      ? "text-green-800"
                      : status.type === "error"
                      ? "text-red-800"
                      : status.type === "warning"
                      ? "text-yellow-800"
                      : "text-blue-800"
                  }`}
                >
                  {status.message}
                </p>
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="mt-8 bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              How it works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Set Delegation
                </h3>
                <p className="text-gray-600 text-sm">
                  Delegate account control to a trusted contract for enhanced
                  security
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Check Status
                </h3>
                <p className="text-gray-600 text-sm">
                  Verify if an account has active delegation and to which
                  contract
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Revoke Access
                </h3>
                <p className="text-gray-600 text-sm">
                  Remove delegation to prevent unauthorized access to your
                  account
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
