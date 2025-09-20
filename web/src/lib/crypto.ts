import { encodePacked, keccak256, type Hex } from "viem";

export function toEthSignedMessageHash(messageHash: Hex) {
  return keccak256(
    encodePacked(
      ["string", "bytes32"],
      ["\x19Ethereum Signed Message:\n32", messageHash]
    )
  );
}
