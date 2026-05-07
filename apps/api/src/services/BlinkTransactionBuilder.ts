import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, createSyncNativeInstruction } from '@solana/spl-token';
import { ESCROW_CONSTANTS } from '@shared/escrow';
import bs58 from 'bs58';
import { Room } from '../managers/room/types';

export const PROGRAM_ID = new PublicKey('9Pqkgy5uu9w2HvgyNUnHEvzdRWSv1h6GyCuD4uKBVp1W');
const DEPOSIT_WAGER_DISCRIMINATOR = Buffer.from([234, 73, 235, 136, 168, 103, 239, 207]);
const INITIALIZE_MATCH_DISCRIMINATOR = Buffer.from([156, 133, 52, 179, 176, 29, 64, 124]);

export const TOKEN_MINTS: Record<string, string> = {
  SOL:  'So11111111111111111111111111111111111111112',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  USDC: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
};

export function resolveTokenMint(input: string): string | null {
  const mapped = TOKEN_MINTS[input.toUpperCase()];
  if (mapped) return mapped;
  try {
    new PublicKey(input);
    return input;
  } catch {
    return null;
  }
}

export class BlinkTransactionBuilder {
  public static async buildDepositTransaction(
    account: string,
    room: Room,
    isPlayerA: boolean
  ): Promise<string> {
    const depositor = new PublicKey(account);
    const tokenMint = new PublicKey(room.tokenMint!);
    const wagerAmount = room.wagerAmount!;

    const RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const conn = new Connection(RPC, 'confirmed');
    const latest = await conn.getLatestBlockhash();
    const matchIdBytes = room.matchIdBytes;

    const [matchStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(ESCROW_CONSTANTS.MATCH_SEED), matchIdBytes],
      PROGRAM_ID,
    );
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(ESCROW_CONSTANTS.VAULT_SEED), matchIdBytes],
      PROGRAM_ID,
    );

    const depositorATA = getAssociatedTokenAddressSync(tokenMint, depositor, true);
    
    const tx = new Transaction({
      recentBlockhash: latest.blockhash,
      feePayer: depositor,
    });

    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        depositor,
        depositorATA,
        depositor,
        tokenMint
      )
    );

    if (tokenMint.toBase58() === TOKEN_MINTS.SOL) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: depositor,
          toPubkey: depositorATA,
          lamports: wagerAmount,
        }),
        createSyncNativeInstruction(depositorATA)
      );
    }

    if (isPlayerA) {
      const privateKey = process.env.SERVER_KEYPAIR;
      if (!privateKey) throw new Error("Missing SERVER_KEYPAIR for backend");
      const serverKeypair = privateKey.trimStart().startsWith('[')
        ? new Uint8Array(JSON.parse(privateKey))
        : bs58.decode(privateKey);
      const serverPubkey = new PublicKey(serverKeypair.subarray(32, 64));

      const wagerAmountBuffer = Buffer.alloc(8);
      wagerAmountBuffer.writeBigUInt64LE(BigInt(wagerAmount));
      
      const initData = Buffer.concat([
        INITIALIZE_MATCH_DISCRIMINATOR,
        Buffer.from(matchIdBytes),
        wagerAmountBuffer,
        serverPubkey.toBuffer()
      ]);

      const initIx = new TransactionInstruction({
        programId: PROGRAM_ID,
        data: initData,
        keys: [
          { pubkey: depositor, isSigner: true, isWritable: true },
          { pubkey: new PublicKey(room.playerB || account), isSigner: false, isWritable: false },
          { pubkey: tokenMint, isSigner: false, isWritable: false },
          { pubkey: matchStatePDA, isSigner: false, isWritable: true },
          { pubkey: vaultPDA, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
      });
      tx.add(initIx);
    }

    const depositWagerIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      data: DEPOSIT_WAGER_DISCRIMINATOR,
      keys: [
        { pubkey: depositor,      isSigner: true,  isWritable: true  },
        { pubkey: matchStatePDA,  isSigner: false, isWritable: true  },
        { pubkey: depositorATA,   isSigner: false, isWritable: true  },
        { pubkey: vaultPDA,       isSigner: false, isWritable: true  },
        { pubkey: tokenMint,      isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
    });

    tx.add(depositWagerIx);

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    return serialized.toString('base64');
  }
}
