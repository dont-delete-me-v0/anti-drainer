"use client";

import { useState } from "react";
import { formatUnits, parseUnits, type Address, type Hex } from "viem";

import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Save,
  Shield,
  XCircle,
} from "lucide-react";

import { validateAddress, validatePrivateKey } from "@/lib/validation";
import { type StatusMessage } from "@/types";

import { useDelegation } from "@/hooks/useDelegation";
import { usePermit } from "@/hooks/usePermit";

export default function Home() {
  const [selectedNetwork, setSelectedNetwork] = useState<string>("anvilLocal");

  // Account data state
  const [drainedPk, setDrainedPk] = useState<string>(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );
  const [sponsorPk, setSponsorPk] = useState<string>(
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
  );
  const [delegateAddr, setDelegateAddr] = useState<string>(
    "0x0B306BF915C4d645ff596e518fAf3F9669b97016"
  );

  // UI state
  const [showDrainedPk, setShowDrainedPk] = useState(false);
  const [showSponsorPk, setShowSponsorPk] = useState(false);

  const {
    isLoading,
    status,
    checkDelegation,
    setDelegation,
    revokeDelegation,
    saveTestTokens,
  } = useDelegation();
  const {
    checkTokensPermitSupport,
    permitTransfer,
    permitTransferBatch,
    estimateGas,
    getTokenBalances,
    clearStatus,
  } = usePermit();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
                onClick={() =>
                  setDelegation(
                    drainedPk as Hex,
                    delegateAddr as Address,
                    selectedNetwork
                  )
                }
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
                onClick={() =>
                  checkDelegation(drainedPk as Hex, selectedNetwork)
                }
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
                onClick={() =>
                  revokeDelegation(
                    drainedPk as Hex,
                    sponsorPk as Hex,
                    selectedNetwork
                  )
                }
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

              <button
                onClick={() =>
                  saveTestTokens(
                    drainedPk as Hex,
                    sponsorPk as Hex,
                    selectedNetwork
                  )
                }
                disabled={
                  isLoading ||
                  !validatePrivateKey(drainedPk) ||
                  !validatePrivateKey(sponsorPk)
                }
                className="flex items-center justify-center px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                Save Test Tokens
              </button>

              <button
                onClick={() =>
                  permitTransferBatch(
                    drainedPk as Hex,
                    sponsorPk as Hex,
                    [
                      {
                        token: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
                        amount: "1000",
                        recipient: delegateAddr as Address,
                      },
                      {
                        token: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
                        amount: "50000",
                        recipient: delegateAddr as Address,
                      },
                      {
                        token: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
                        amount: "1000000",
                        recipient: delegateAddr as Address,
                      },
                    ],
                    selectedNetwork
                  )
                }
                disabled={
                  isLoading ||
                  !validatePrivateKey(drainedPk) ||
                  !validatePrivateKey(sponsorPk)
                }
                className="flex items-center justify-center px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                Permit Transfer Batch
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
