#!/usr/bin/env node
/**
 * Copy compiled ABIs to backend after `pnpm compile`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function syncAbi(artifactRel, outRel, exportName) {
  const artifactPath = path.join(root, artifactRel);
  if (!fs.existsSync(artifactPath)) {
    console.error(`Run \`pnpm compile\` first — missing ${artifactRel}`);
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const out = path.resolve(root, outRel);
  const body = `/** Auto-generated from contracts artifacts — run \`pnpm sync-abi\` in contracts/ */\nexport const ${exportName} = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`;
  fs.writeFileSync(out, body);
  console.log('Wrote', path.relative(process.cwd(), out));
}

syncAbi(
  'artifacts/contracts/TokenableRWA.sol/TokenableRWA.json',
  '../backend/src/blockchain/abis/tokenable-rwa.abi.ts',
  'TOKENABLE_RWA_ABI',
);

syncAbi(
  'artifacts/contracts/TokenablePaymentEscrow.sol/TokenablePaymentEscrow.json',
  '../backend/src/blockchain/abis/tokenable-payment-escrow.abi.ts',
  'TOKENABLE_PAYMENT_ESCROW_ABI',
);
