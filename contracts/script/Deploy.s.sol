// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {XSILToken} from "../src/XSILToken.sol";

/// @notice Deploy XSILToken to Base (or any EVM chain reachable via RPC_URL).
/// Env: ADMIN_ADDRESS, MINTER_ADDRESS (required). Optional: XSIL_RPC_URL for --rpc-url.
contract DeployXSIL is Script {
    function run() external {
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address minter = vm.envAddress("MINTER_ADDRESS");

        vm.startBroadcast();
        XSILToken token = new XSILToken(admin, minter);
        vm.stopBroadcast();

        console2.log("XSILToken deployed at", address(token));
        console2.log("MAX_SUPPLY", token.MAX_SUPPLY());
    }
}
