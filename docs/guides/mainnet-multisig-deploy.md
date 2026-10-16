# RWA NFT deployment — OpenZeppelin preset (no proxy)

Tokenable deploys **unmodified** OpenZeppelin `ERC721PresetMinterPauserAutoId` (v4.9.6). There is no UUPS proxy, factory, or upgrade script.

```text
Deployer EOA (DEPLOYER_PRIVATE_KEY)
  → deploy ERC721PresetMinterPauserAutoId("Tokenable Collectibles", "GEMS", baseURI)
  → optional env: `RWA_TOKEN_NAME`, `RWA_TOKEN_SYMBOL`, `RWA_METADATA_BASE_URI`, `RWA_MINTER_ADDRESS`
  → mint+burn token 0 (collection-bid sentinel stays tokenId 0 in the DB)
  → DEFAULT_ADMIN_ROLE stays on deployer (OZ constructor + no admin transfer in deploy script)
  → optional: grant MINTER_ROLE + PAUSER_ROLE to backend hot wallet (`RWA_MINTER_ADDRESS`)
App
  → set CHAIN_{id}_RWA_ADDRESS / NEXT_PUBLIC_CHAIN_{id}_RWA to the new address
  → `RWA_ADMIN_PRIVATE_KEY` should be the deployer (or any wallet that holds DEFAULT_ADMIN_ROLE) for marketplace role grants
```

Changing NFT behavior = new deploy + env swap (old inventory stays on the old address).

```bash
cd contracts
# Optional: RWA_METADATA_BASE_URI=https://api.example/api/blockchain/rwa/metadata/
pnpm deploy:rwa:sepolia
# then copy printed addresses into backend/.env + frontend/.env
cd contracts && pnpm sync-abi
```

Do **not** set `RWA_ADMIN_ADDRESS` during deploy (removed from the deploy script). A separate Safe is not assigned `DEFAULT_ADMIN_ROLE` automatically; use the deployer wallet for admin operations unless you grant admin to another address manually later.
