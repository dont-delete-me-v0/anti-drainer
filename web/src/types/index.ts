import { type Chain } from "viem";

export interface StatusMessage {
  type: "success" | "error" | "warning" | "info";
  message: string;
}

export interface DelegationResult {
  hasDelegation: boolean;
  delegatedAddress?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

export interface AccountData {
  drainedPk: string;
  sponsorPk: string;
  delegateAddr: string;
}

export interface NetworkConfig {
  name: string;
  chain: Chain;
}
