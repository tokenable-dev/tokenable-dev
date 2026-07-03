#!/usr/bin/env node
/**
 * Copy compiled TokenableRWA ABI to backend after `pnpm compile`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const artifactPath = path.join(
  root,
  'artifacts/contracts/TokenableRWA.sol/TokenableRWA.json',
);

if (!fs.existsSync(artifactPath)) {
  console.error('Run `pnpm compile` first — artifact not found.');
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const abi = artifact.abi;

const backendOut = path.resolve(
  root,
  '../backend/src/blockchain/abis/tokenable-rwa.abi.ts',
);
const backendBody = `/** Auto-generated from contracts artifacts — run \`pnpm sync-abi\` in contracts/ */\nexport const TOKENABLE_RWA_ABI = ${JSON.stringify(abi, null, 2)} as const;\n`;
fs.writeFileSync(backendOut, backendBody);

console.log('Wrote', path.relative(process.cwd(), backendOut));
