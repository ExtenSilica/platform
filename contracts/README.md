# XSIL Token (ERC-20)

Governance token for ExtenSilica contributors. Fixed max supply **10,000,000 XSIL** (18 decimals). Minting is restricted to `MINTER_ROLE` (backend hot wallet). Transfers are pausable by `PAUSER_ROLE`.

## Setup

```bash
cd contracts
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2
```

## Test

```bash
forge test
```

## Deploy (Base mainnet, chain ID 8453)

```bash
export ADMIN_ADDRESS=0x…    # hardware wallet (founder)
export MINTER_ADDRESS=0x…   # backend minter hot wallet
export XSIL_RPC_URL=https://mainnet.base.org

# Broadcast with admin key (Ledger via cast send, or Foundry --ledger):
forge script script/Deploy.s.sol:DeployXSIL \
  --rpc-url "$XSIL_RPC_URL" \
  --broadcast \
  --verify \
  --etherscan-api-key "$BASESCAN_API_KEY"
```

Or `forge create` (as in product spec):

```bash
forge create src/XSILToken.sol:XSILToken \
  --rpc-url https://mainnet.base.org \
  --private-key "$ADMIN_PRIVATE_KEY" \
  --constructor-args "$ADMIN_ADDRESS" "$MINTER_ADDRESS" \
  --verify --etherscan-api-key "$BASESCAN_API_KEY"
```

After deploy, set on the API server:

```
XSIL_CONTRACT_ADDRESS=0x…
XSIL_MINTER_PRIVATE_KEY=0x…   # never commit
XSIL_RPC_URL=https://mainnet.base.org
CHAIN_ID=8453
```

Dev claim without chain: `XSIL_CLAIM_STUB=true` on the backend.
