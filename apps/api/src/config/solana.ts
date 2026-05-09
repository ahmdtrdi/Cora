import { createHash } from 'crypto';
import { PublicKey } from '@solana/web3.js';

export const CORA_ESCROW_PROGRAM_ID = new PublicKey('9Pqkgy5uu9w2HvgyNUnHEvzdRWSv1h6GyCuD4uKBVp1W');

export const ESCROW_INSTRUCTION_DISCRIMINATORS = {
  depositWager: Buffer.from([234, 73, 235, 136, 168, 103, 239, 207]),
  initializeMatch: Buffer.from([156, 133, 52, 179, 176, 29, 64, 124]),
  settleMatch: Buffer.from([0x47, 0x7c, 0x75, 0x60, 0xbf, 0xd9, 0x74, 0x18]),
} as const;

export const MATCH_STATE_LAYOUT = {
  playerA: [41, 73],
  playerB: [73, 105],
  tokenMint: [105, 137],
} as const;

export function anchorDiscriminator(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}
