import { anvilLocal } from "@/lib/chains";
import type { Chain } from "viem";
import {
  arbitrum,
  bsc,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from "viem/chains";

export function getChain(network: string): Chain {
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

export const SUPPORTED_NETWORKS = [
  { value: "mainnet", label: "Ethereum Mainnet" },
  { value: "sepolia", label: "Sepolia Testnet" },
  { value: "polygon", label: "Polygon" },
  { value: "bsc", label: "BSC" },
  { value: "arbitrum", label: "Arbitrum" },
  { value: "optimism", label: "Optimism" },
  { value: "anvilLocal", label: "Anvil Local" },
] as const;
