import { InternalServerErrorException } from '@nestjs/common';
import { isRpcRateLimitError } from './rpc-retry.util';

function rpcErrorBlob(err: unknown): string {
  if (!err || typeof err !== 'object') return String(err ?? '');
  const e = err as {
    message?: string;
    shortMessage?: string;
    reason?: string;
    code?: string;
    info?: { error?: { message?: string } };
  };
  return [
    e.shortMessage,
    e.reason,
    e.message,
    e.info?.error?.message,
    e.code,
  ]
    .filter((s) => typeof s === 'string' && s.trim())
    .join(' ');
}

/** Turn ethers / JSON-RPC failures into a single operator-facing mint message. */
export function formatMintRpcError(err: unknown): string {
  if (isRpcRateLimitError(err)) {
    return (
      'Blockchain RPC rate limit (Alchemy compute units). Wait a few seconds and retry mint, ' +
      'or raise RPC_MAX_CONCURRENCY / upgrade the RPC plan.'
    );
  }

  const blob = rpcErrorBlob(err).toLowerCase();

  if (
    blob.includes('minter role') ||
    blob.includes('must have minter role')
  ) {
    return (
      'Mint wallet is missing MINTER_ROLE on the RWA contract. ' +
      'Grant MINTER_ROLE to RWA_OWNER_PRIVATE_KEY on this chain.'
    );
  }
  if (blob.includes('paused') || blob.includes('pausable')) {
    return 'RWA contract is paused — unpause before minting.';
  }
  if (
    blob.includes('insufficient funds') ||
    blob.includes('insufficient balance')
  ) {
    return 'Mint wallet has insufficient ETH for gas on this chain.';
  }
  if (blob.includes('nonce too low') || blob.includes('already known')) {
    return (
      'Mint transaction nonce conflict (another tx may be pending). ' +
      'Wait for pending txs or reset the owner wallet nonce.'
    );
  }
  if (blob.includes('replacement fee too low')) {
    return 'Pending mint tx blocks a new one — wait for confirmation or speed up the stuck tx.';
  }
  if (
    blob.includes('timeout') ||
    blob.includes('timed out') ||
    blob.includes('etimedout')
  ) {
    return 'Blockchain RPC timed out while waiting for mint confirmation — retry; check ALCHEMY / RPC URL.';
  }
  if (blob.includes('revert') || blob.includes('execution reverted')) {
    const raw = rpcErrorBlob(err).trim();
    return raw
      ? `On-chain mint reverted: ${raw}`
      : 'On-chain mint reverted (check contract pause, minter role, and recipient address).';
  }

  const raw = rpcErrorBlob(err).trim();
  if (raw) {
    return `On-chain mint failed: ${raw}`;
  }
  return 'On-chain mint failed (unknown RPC error). Check backend logs and RWA_OWNER_PRIVATE_KEY / chain config.';
}

export function toMintRpcHttpException(err: unknown): InternalServerErrorException {
  return new InternalServerErrorException(formatMintRpcError(err));
}
