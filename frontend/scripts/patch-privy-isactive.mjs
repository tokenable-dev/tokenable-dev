/**
 * Post-install patches for @privy-io/react-auth.
 *
 * 1. Remove unused `isActive` prop on TransactionDetails accordion (styled-components).
 * 2. `"clip-path"` → `"clipPath"` in bundled SVG icons (React 19 dev warning).
 * 3. UserPill "Add funds" → Polygon USDC + MoonPay (Dashboard default is often chain 1).
 * 4. fundWallet chain fallback when Dashboard default is not in supportedChains.
 * 5. TransactionErrorView `styled.text` → `styled.span` (React crash: unrecognized <text> tag).
 *
 * Re-run safe after `pnpm install` — idempotent.
 */
import fs from "node:fs";
import path from "node:path";

const PRIVY_DIST = path.join(
  process.cwd(),
  "node_modules",
  "@privy-io",
  "react-auth",
  "dist",
);

/** MoonPay destination — match NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID (Polygon production default). */
const FUNDING_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID?.trim() || "137",
);

// Avoid defaultFundingMethod:"card" — auto-opens MoonPay from useEffect and
// browsers block the popup → "Unable to initialize flow".
const FUNDING_OPTIONS =
  `{chain:{id:${FUNDING_CHAIN_ID}},asset:"USDC",card:{preferredProvider:"moonpay"}}`;

const IS_ACTIVE_NEEDLE = 'isActive:l?"true":"false",';
const CLIP_PATH_NEEDLE = '"clip-path"';
const CLIP_PATH_REPLACEMENT = '"clipPath"';

/** Privy TransactionErrorView uses styled.text (SVG-only) outside <svg> → React crash on failed txs. */
const STYLED_TEXT_NEEDLES = [
  ["styled.text`", "styled.span`"],
  [".styled.text`", ".styled.span`"],
  // ESM build: `import a from "styled-components"; … a.text\`…\``
  ["=a.text`", "=a.span`"],
];

const USERPILL_ADD_FUNDS_NEEDLE =
  'onClick:()=>i({address:a.address}),disabled:!t.wallet,children:"Add funds"';
const USERPILL_ADD_FUNDS_REPLACEMENT = `onClick:()=>i({address:a.address,options:${FUNDING_OPTIONS}}),disabled:!t.wallet,children:"Add funds"`;

/** Re-apply when chain id changes (e.g. Sepolia → Polygon). */
const USERPILL_ADD_FUNDS_LEGACY_REPLACEMENT = `onClick:()=>i({address:a.address,options:{chain:{id:1},asset:"USDC",card:{preferredProvider:"moonpay"}}}),disabled:!t.wallet,children:"Add funds"`;

const USERPILL_ADD_FUNDS_SEPOLIA_REPLACEMENT = `onClick:()=>i({address:a.address,options:{chain:{id:11155111},asset:"USDC",card:{preferredProvider:"moonpay"}}}),disabled:!t.wallet,children:"Add funds"`;

/** Older patch left defaultFundingMethod — strip it so MoonPay popup can open. */
const USERPILL_ADD_FUNDS_WITH_DEFAULT_METHOD = `onClick:()=>i({address:a.address,options:{chain:{id:${FUNDING_CHAIN_ID}},asset:"USDC",defaultFundingMethod:"card",card:{preferredProvider:"moonpay"}}}),disabled:!t.wallet,children:"Add funds"`;

const WALLET_ACTIONS_ADD_FUNDS_NEEDLE =
  '"ethereum"===c?.chainType?await a(c.address):';
const WALLET_ACTIONS_ADD_FUNDS_REPLACEMENT = `"ethereum"===c?.chainType?await a(c.address,${FUNDING_OPTIONS}):`;

const WALLET_ACTIONS_ADD_FUNDS_LEGACY_REPLACEMENT =
  '"ethereum"===c?.chainType?await a(c.address,{chain:{id:1},asset:"USDC",card:{preferredProvider:"moonpay"}}):';

const WALLET_ACTIONS_ADD_FUNDS_SEPOLIA_REPLACEMENT =
  '"ethereum"===c?.chainType?await a(c.address,{chain:{id:11155111},asset:"USDC",card:{preferredProvider:"moonpay"}}):';

const WALLET_ACTIONS_ADD_FUNDS_WITH_DEFAULT_METHOD =
  `"ethereum"===c?.chainType?await a(c.address,{chain:{id:${FUNDING_CHAIN_ID}},asset:"USDC",defaultFundingMethod:"card",card:{preferredProvider:"moonpay"}}):`;


const FUNDING_CHAIN_GUARD_LEGACY_REPLACEMENT =
  `let u=r.chains.find((e=>e.id===l));if(!u){const _fb=r.chains.find((e=>1===e.id))??r.chains.find((e=>!e.testnet))??r.chains[0];if(_fb){l=_fb.id;u=_fb}}if(!u)throw new e(\`Funding chain \${l} is not in PrivyProvider chains list\`);`;

const FUNDING_CHAIN_GUARD_NEEDLE =
  "let u=r.chains.find((e=>e.id===l));if(!u)throw new e(`Funding chain ${l} is not in PrivyProvider chains list`);";
const FUNDING_CHAIN_GUARD_REPLACEMENT =
  `let u=r.chains.find((e=>e.id===l));if(!u){const _fb=r.chains.find((e=>${FUNDING_CHAIN_ID}===e.id))??r.chains.find((e=>!e.testnet))??r.chains[0];if(_fb){l=_fb.id;u=_fb}}if(!u)throw new e(\`Funding chain \${l} is not in PrivyProvider chains list\`);`;

/** @param {string} filePath @param {(content: string) => string | null} transform */
function patchFile(filePath, transform) {
  const content = fs.readFileSync(filePath, "utf8");
  const next = transform(content);
  if (next === null || next === content) return false;
  fs.writeFileSync(filePath, next);
  return true;
}

function patchIsActive() {
  let patched = 0;
  for (const sub of ["esm", "cjs"]) {
    const dir = path.join(PRIVY_DIST, sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.includes("TransactionDetails")) continue;
      const fp = path.join(dir, name);
      if (
        patchFile(fp, (content) =>
          content.includes(IS_ACTIVE_NEEDLE)
            ? content.replaceAll(IS_ACTIVE_NEEDLE, "")
            : null,
        )
      ) {
        patched += 1;
        console.log(`[patch-privy-sdk] isActive → ${path.relative(process.cwd(), fp)}`);
      }
    }
  }
  return patched;
}

function patchClipPath() {
  let patched = 0;
  for (const sub of ["esm", "cjs"]) {
    const dir = path.join(PRIVY_DIST, sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".mjs") && !name.endsWith(".js")) continue;
      const fp = path.join(dir, name);
      if (
        patchFile(fp, (content) =>
          content.includes(CLIP_PATH_NEEDLE)
            ? content.replaceAll(CLIP_PATH_NEEDLE, CLIP_PATH_REPLACEMENT)
            : null,
        )
      ) {
        patched += 1;
        console.log(`[patch-privy-sdk] clipPath → ${path.relative(process.cwd(), fp)}`);
      }
    }
  }
  return patched;
}

/**
 * Fix Privy tx-failure modal: `styled.text` renders an invalid HTML <text> tag and
 * React throws into RootLayout ("The tag <text> is unrecognized…").
 */
function patchStyledTextOutsideSvg() {
  let patched = 0;
  for (const sub of ["esm", "cjs"]) {
    const dir = path.join(PRIVY_DIST, sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.includes("TransactionErrorView")) continue;
      const fp = path.join(dir, name);
      if (
        patchFile(fp, (content) => {
          let next = content;
          let changed = false;
          for (const [needle, replacement] of STYLED_TEXT_NEEDLES) {
            if (next.includes(needle)) {
              next = next.replaceAll(needle, replacement);
              changed = true;
            }
          }
          return changed ? next : null;
        })
      ) {
        patched += 1;
        console.log(
          `[patch-privy-sdk] styled.text → span → ${path.relative(process.cwd(), fp)}`,
        );
      }
    }
  }
  return patched;
}

function patchUserPillAddFunds() {
  let patched = 0;
  for (const sub of ["esm", "cjs"]) {
    const fp = path.join(PRIVY_DIST, sub, "ui.mjs");
    const fpJs = path.join(PRIVY_DIST, sub, "ui.js");
    for (const file of [fp, fpJs]) {
      if (!fs.existsSync(file)) continue;
      if (
        patchFile(file, (content) => {
          let next = content;
          if (next.includes(USERPILL_ADD_FUNDS_REPLACEMENT)) {
            // already on target chain / options
          } else if (next.includes(USERPILL_ADD_FUNDS_WITH_DEFAULT_METHOD)) {
            next = next.replace(
              USERPILL_ADD_FUNDS_WITH_DEFAULT_METHOD,
              USERPILL_ADD_FUNDS_REPLACEMENT,
            );
          } else if (next.includes(USERPILL_ADD_FUNDS_SEPOLIA_REPLACEMENT)) {
            next = next.replace(
              USERPILL_ADD_FUNDS_SEPOLIA_REPLACEMENT,
              USERPILL_ADD_FUNDS_REPLACEMENT,
            );
          } else if (next.includes(USERPILL_ADD_FUNDS_LEGACY_REPLACEMENT)) {
            next = next.replace(
              USERPILL_ADD_FUNDS_LEGACY_REPLACEMENT,
              USERPILL_ADD_FUNDS_REPLACEMENT,
            );
          } else if (next.includes(USERPILL_ADD_FUNDS_NEEDLE)) {
            next = next.replace(USERPILL_ADD_FUNDS_NEEDLE, USERPILL_ADD_FUNDS_REPLACEMENT);
          } else {
            return null;
          }
          if (next.includes(WALLET_ACTIONS_ADD_FUNDS_REPLACEMENT)) {
            // already on target chain / options
          } else if (next.includes(WALLET_ACTIONS_ADD_FUNDS_WITH_DEFAULT_METHOD)) {
            next = next.replace(
              WALLET_ACTIONS_ADD_FUNDS_WITH_DEFAULT_METHOD,
              WALLET_ACTIONS_ADD_FUNDS_REPLACEMENT,
            );
          } else if (next.includes(WALLET_ACTIONS_ADD_FUNDS_SEPOLIA_REPLACEMENT)) {
            next = next.replace(
              WALLET_ACTIONS_ADD_FUNDS_SEPOLIA_REPLACEMENT,
              WALLET_ACTIONS_ADD_FUNDS_REPLACEMENT,
            );
          } else if (next.includes(WALLET_ACTIONS_ADD_FUNDS_LEGACY_REPLACEMENT)) {
            next = next.replace(
              WALLET_ACTIONS_ADD_FUNDS_LEGACY_REPLACEMENT,
              WALLET_ACTIONS_ADD_FUNDS_REPLACEMENT,
            );
          } else if (next.includes(WALLET_ACTIONS_ADD_FUNDS_NEEDLE)) {
            next = next.replace(
              WALLET_ACTIONS_ADD_FUNDS_NEEDLE,
              WALLET_ACTIONS_ADD_FUNDS_REPLACEMENT,
            );
          }
          return next;
        })
      ) {
        patched += 1;
        console.log(`[patch-privy-sdk] UserPill Add funds → ${path.relative(process.cwd(), file)}`);
      }
    }
  }
  return patched;
}

function patchFundWalletChainFallback() {
  let patched = 0;
  for (const sub of ["esm", "cjs"]) {
    const dir = path.join(PRIVY_DIST, sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.includes("use-unlink-wallet")) continue;
      const fp = path.join(dir, name);
      if (
        patchFile(fp, (content) => {
          if (content.includes(FUNDING_CHAIN_GUARD_LEGACY_REPLACEMENT)) {
            return content.replace(
              FUNDING_CHAIN_GUARD_LEGACY_REPLACEMENT,
              FUNDING_CHAIN_GUARD_REPLACEMENT,
            );
          }
          if (content.includes(FUNDING_CHAIN_GUARD_NEEDLE)) {
            return content.replace(FUNDING_CHAIN_GUARD_NEEDLE, FUNDING_CHAIN_GUARD_REPLACEMENT);
          }
          return null;
        })
      ) {
        patched += 1;
        console.log(
          `[patch-privy-sdk] fundWallet chain fallback → ${path.relative(process.cwd(), fp)}`,
        );
      }
    }
  }
  return patched;
}

function main() {
  if (!fs.existsSync(PRIVY_DIST)) return;

  const isActive = patchIsActive();
  const clipPath = patchClipPath();
  const addFunds = patchUserPillAddFunds();
  const chainFallback = patchFundWalletChainFallback();
  const styledText = patchStyledTextOutsideSvg();

  if (isActive + clipPath + addFunds + chainFallback + styledText === 0) {
    console.log("[patch-privy-sdk] nothing to patch (already patched or version changed)");
  }
}

main();
