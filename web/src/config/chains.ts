import { defineChain } from "viem";

export const anvilLocal = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
    public: { http: ["http://127.0.0.1:8545"] },
  },
  blockExplorers: {
    default: { name: "Local", url: "http://127.0.0.1:8545" },
  },
  contracts: {
    // update after deployment
    testToken: {
      address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    },
  },
});
