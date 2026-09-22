/**
 * Read-only checks against the RWA address in backend/.env (Sepolia default).
 * Usage: node scripts/verify-rwa-preset.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from 'ethers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendEnvPath = resolve(__dirname, '../../backend/.env');

function loadEnv(path) {
  const text = readFileSync(path, 'utf8');
  const out = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = loadEnv(backendEnvPath);
const chainId = 11155111;
const rpc = env[`CHAIN_${chainId}_RPC_URL`];
const rwa = env[`CHAIN_${chainId}_RWA_ADDRESS`];
const minterKey = env.RWA_OWNER_PRIVATE_KEY;

if (!rpc || !rwa) {
  console.error('Missing CHAIN_11155111_RPC_URL or CHAIN_11155111_RWA_ADDRESS in backend/.env');
  process.exit(1);
}

const provider = new JsonRpcProvider(rpc);
const abi = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function MINTER_ROLE() view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
];
const nft = new Contract(rwa, abi, provider);

const removed = ['vaultRef', 'adminBurn', 'mintBatch', 'totalMinted', 'activeTokenIdOf'];

async function main() {
  const [name, symbol, totalSupply, minterRole, adminRole] = await Promise.all([
    nft.name(),
    nft.symbol(),
    nft.totalSupply(),
    nft.MINTER_ROLE(),
    nft.DEFAULT_ADMIN_ROLE(),
  ]);

  console.log('RWA preset read-only verification');
  console.log('  chainId     :', chainId);
  console.log('  address     :', rwa);
  console.log('  name/symbol :', name, '/', symbol);
  console.log('  totalSupply :', totalSupply.toString());

  const iface = nft.interface;
  for (const fn of removed) {
    if (iface.hasFunction(fn)) {
      console.error('FAIL: contract still exposes', fn);
      process.exit(1);
    }
  }
  console.log('  ABI         : no legacy custom methods');

  if (minterKey) {
    const wallet = new Wallet(minterKey, provider);
    const addr = await wallet.getAddress();
    const hasMinter = await nft.hasRole(minterRole, addr);
    console.log('  minter wallet:', addr, 'MINTER_ROLE=', hasMinter);
    if (!hasMinter) {
      console.error('FAIL: backend minter lacks MINTER_ROLE');
      process.exit(1);
    }
  }

  const adminKey = env.RWA_ADMIN_PRIVATE_KEY;
  if (adminKey) {
    const wallet = new Wallet(adminKey, provider);
    const adminAddr = await wallet.getAddress();
    const hasAdmin = await nft.hasRole(adminRole, adminAddr);
    console.log(
      '  RWA_ADMIN_PRIVATE_KEY wallet:',
      adminAddr,
      'DEFAULT_ADMIN_ROLE=',
      hasAdmin,
    );
  }

  const code = await provider.getCode(rwa);
  if (code === '0x') {
    console.error('FAIL: no bytecode at address');
    process.exit(1);
  }

  console.log('OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
