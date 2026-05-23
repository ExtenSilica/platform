// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {XSILToken} from "../src/XSILToken.sol";

contract XSILTokenTest is Test {
    XSILToken token;
    address admin = makeAddr("admin");
    address minter = makeAddr("minter");
    address user = makeAddr("user");

    function setUp() public {
        token = new XSILToken(admin, minter);
    }

    function testFounderMintOnDeploy() public view {
        assertEq(token.balanceOf(admin), 3_000_000 * 10 ** 18);
        assertEq(token.totalSupply(), 3_000_000 * 10 ** 18);
    }

    function testMinterCanMintWithGrantIds() public {
        vm.prank(minter);
        token.mint(user, 500 * 10 ** 18, "grant-1,grant-2");
        assertEq(token.balanceOf(user), 500 * 10 ** 18);
    }

    function testNonMinterCannotMint() public {
        vm.prank(user);
        vm.expectRevert();
        token.mint(user, 1, "");
    }

    function testCannotExceedMaxSupply() public {
        uint256 remaining = token.MAX_SUPPLY() - token.totalSupply();
        vm.prank(minter);
        vm.expectRevert("Exceeds max supply");
        token.mint(user, remaining + 1, "");
    }

    function testPauseBlocksTransfer() public {
        vm.prank(minter);
        token.mint(user, 100 * 10 ** 18, "");
        vm.prank(admin);
        token.pause();
        vm.prank(user);
        vm.expectRevert();
        token.transfer(admin, 1);
    }
}
