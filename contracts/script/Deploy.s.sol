// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/TestToken.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        vm.startBroadcast(deployerPrivateKey);
        TestToken testToken = new TestToken();
        console.log("TestToken deployed at:", address(testToken));
        console.log("\n=== Deployment Summary ===");
        console.log("TestToken:", address(testToken));
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        vm.stopBroadcast();
    }
}
