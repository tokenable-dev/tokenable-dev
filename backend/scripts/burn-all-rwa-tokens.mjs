/**
 * Burn every live TokenableRWA token on the configured chain so PSA certs can be re-minted.
 *
 * Usage (from backend/):
 *   node scripts/burn-all-rwa-tokens.mjs
 *   node scripts/burn-all-rwa-tokens.mjs --dry-run
 *
 * Requires RWA_OWNER_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY) with BURNER_ROLE,
 * plus CHAIN_{id}_RPC_URL and CHAIN_{id}_RWA_ADDRESS in backend/.env.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';

const TOKENABLE_RWA_ABI = [
  'function totalMinted() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function adminBurn(uint256 tokenId, address expectedOwner)',
  'function BURNER_ROLE() view returns (bytes32)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

loadDotEnv();

const dryRun = process.argv.includes('--dry-run');

function resolveChainId() {
  const raw = process.env.DEFAULT_CHAIN_ID?.trim() ?? '11155111';
  const n = Number(raw);
  return Number.isFinite(n) ? n : 11155111;
}

function resolvePrivateKey() {
  const raw =
    process.env.RWA_OWNER_PRIVATE_KEY?.trim() ||
    process.env.DEPLOYER_PRIVATE_KEY?.trim() ||
    '';
  if (!raw) {
    console.error('RWA_OWNER_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY) is required');
    process.exit(1);
  }
  return raw.startsWith('0x') ? raw : `0x${raw}`;
}

function resolveRpcUrl(chainId) {
  const url = process.env[`CHAIN_${chainId}_RPC_URL`]?.trim();
  if (!url) {
    console.error(`CHAIN_${chainId}_RPC_URL is not set`);
    process.exit(1);
  }
  return url;
}

function resolveRwaAddress(chainId) {
  const addr = process.env[`CHAIN_${chainId}_RWA_ADDRESS`]?.trim()?.toLowerCase();
  if (!addr || !/^0x[a-f0-9]{40}$/.test(addr)) {
    console.error(`CHAIN_${chainId}_RWA_ADDRESS is not set`);
    process.exit(1);
  }
  return addr;
}

function isMissingTokenError(e) {
  const blob = `${e?.code ?? ''} ${e?.reason ?? ''} ${e?.shortMessage ?? ''}`.toLowerCase();
  return (
    e?.code === 'CALL_EXCEPTION' &&
    (blob.includes('invalid token') ||
      blob.includes('nonexistent token') ||
      blob.includes('owner query for nonexistent'))
  );
}

async function main() {
  const chainId = resolveChainId();
  const rpcUrl = resolveRpcUrl(chainId);
  const contractAddress = resolveRwaAddress(chainId);
  const provider = new JsonRpcProvider(rpcUrl, chainId);
  const wallet = new Wallet(resolvePrivateKey(), provider);
  const contract = new Contract(contractAddress, TOKENABLE_RWA_ABI, wallet);

  const [totalMinted, hasBurner] = await Promise.all([
    contract.totalMinted(),
    contract.hasRole(await contract.BURNER_ROLE(), wallet.address),
  ]);

  const total = Number(totalMinted);
  console.log(`Chain ${chainId} · RWA ${contractAddress}`);
  console.log(`Signer ${wallet.address} · BURNER_ROLE=${hasBurner} · totalMinted=${total}`);
  if (!hasBurner) {
    console.error('Signer lacks BURNER_ROLE — run grant-burner for this chain first.');
    process.exit(1);
  }

  const live = [];
  for (let tokenId = 1; tokenId <= total; tokenId += 1) {
    try {
      const owner = await contract.ownerOf(tokenId);
      live.push({ tokenId, owner });
    } catch (e) {
      if (!isMissingTokenError(e)) throw e;
    }
  }

  if (live.length === 0) {
    console.log('No live tokens on chain — nothing to burn.');
    return;
  }

  console.log(`Found ${live.length} live token(s): ${live.map((t) => `#${t.tokenId}`).join(', ')}`);
  if (dryRun) {
    console.log('Dry run — no transactions sent.');
    return;
  }

  for (const { tokenId, owner } of live) {
    console.log(`Burning token #${tokenId} (owner ${owner})…`);
    const tx = await contract.adminBurn(tokenId, owner);
    console.log(`  tx ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  confirmed in block ${receipt?.blockNumber ?? '?'}`);
  }

  console.log('Done — all live tokens burned on chain.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
