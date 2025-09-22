// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/PermitSaver.sol";

contract DeployPermitSaver is Script {
    function run() external {
        // Anvil default accounts
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Deploying PermitSaver ===");
        console.log("Deployer:", deployer);
        console.log("");

        // Deploy EIP7702Saver
        PermitSaver permitSaver = new PermitSaver();
        console.log("PermitSaver deployed at:", address(permitSaver));

        console.log("");
        console.log("=== Test Setup Complete ===");
        console.log("PermitSaver:", address(permitSaver));
        console.log("");
        console.log("Test Accounts:");
        console.log("Deployer (Account #0):", deployer);
        console.log("");
        console.log("Contract Info:");
        (uint256 nonce, uint256 maxBatch) = permitSaver.getContractInfo();
        console.log("Current nonce:", nonce);
        console.log("Max batch size:", maxBatch);
        console.log("");
        console.log(" Ready for PermitSaver testing!");

        vm.stopBroadcast();
    }
}
