// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title XSIL — ExtenSilica contributor governance token (non-monetary utility; governance only).
contract XSILToken is ERC20, AccessControl, ERC20Permit, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant MAX_SUPPLY = 10_000_000 * 10 ** 18;

    event TokensClaimed(address indexed recipient, uint256 amount, string grantIds);

    constructor(address admin, address minter)
        ERC20("ExtenSilica Governance Token", "XSIL")
        ERC20Permit("ExtenSilica Governance Token")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, admin);

        // Founder allocation (30%) — vested off-chain per tokenomics doc.
        _mint(admin, 3_000_000 * 10 ** 18);
    }

    function mint(address to, uint256 amount, string calldata grantIds)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
        emit TokensClaimed(to, amount, grantIds);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _update(address from, address to, uint256 value) internal override whenNotPaused {
        super._update(from, to, value);
    }
}
