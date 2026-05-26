# XSIL Token (ERC-20)

Governance token for ExtenSilica contributors. Fixed max supply **10,000,000 XSIL** (18 decimals). Founder allocation is minted at deploy; contributor payouts use **treasury `transferFrom`** (backend wallet with DAO-approved allowance), not per-grant mint.

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
export MINTER_ADDRESS=0x…   # legacy Foundry deploy script only (not used for contributor payouts)
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
XSIL_TREASURY_ADDRESS=0x1FcE7Ae8B7c2fB4bf756801A270c1de237BF7c33
XSIL_BACKEND_ADDRESS=0x…
XSIL_BACKEND_PRIVATE_KEY=0x…   # never commit; needs allowance from treasury (XSIL-1: 500k XSIL)
XSIL_RPC_URL=https://mainnet.base.org
XSIL_CHAIN_ID=8453
```

Dev claim without chain: `XSIL_CLAIM_STUB=true` on the backend.
