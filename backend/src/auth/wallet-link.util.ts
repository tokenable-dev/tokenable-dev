import { BadRequestException } from '@nestjs/common';
import { getAddress, verifyMessage } from 'ethers';

export const WALLET_LINK_JWT_PURPOSE = 'wallet_link';
export const WALLET_LINK_CHALLENGE_TTL_SEC = 300;

export function buildWalletLinkMessage(params: {
  userId: string;
  nonce: string;
  issuedAt: string;
}): string {
  return [
    'Link this wallet to your Tokenable account.',
    '',
    `Account: ${params.userId}`,
    `Nonce: ${params.nonce}`,
    `Issued: ${params.issuedAt}`,
  ].join('\n');
}

export function assertWalletLinkSignature(
  message: string,
  signature: string,
  expectedAddress: string,
): void {
  let recovered: string;
  try {
    recovered = verifyMessage(message, signature);
  } catch {
    throw new BadRequestException('Invalid wallet signature');
  }
  if (getAddress(recovered) !== getAddress(expectedAddress)) {
    throw new BadRequestException('Signature does not match wallet address');
  }
}
