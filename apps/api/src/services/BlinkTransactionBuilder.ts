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
import type { Room } from '../managers/room/types';
import { CORA_ESCROW_PROGRAM_ID, ESCROW_INSTRUCTION_DISCRIMINATORS } from '../config/solana';
import { DEVNET_TOKEN_MINTS, resolveTokenMint } from '../config/tokens';

export { resolveTokenMint };

type DepositTransactionRoom = Pick<Room, 'id' | 'matchIdBytes' | 'tokenMint' | 'wagerAmount' | 'playerB'>;

type BuildDepositOptions = boolean | {
  initializeMatch?: boolean;
  initializeOpponent?: string;
};

export class BlinkTransactionBuilder {
  public static async buildDepositTransaction(
    account: string,
    room: DepositTransactionRoom,
    options: BuildDepositOptions
  ): Promise<string> {
    const initializeMatch = typeof options === 'boolean' ? options : Boolean(options.initializeMatch);
    const initializeOpponent = typeof options === 'boolean' ? room.playerB : options.initializeOpponent ?? room.playerB;
    const depositor = new PublicKey(account);
    const tokenMint = new PublicKey(room.tokenMint!);
    const wagerAmount = room.wagerAmount!;

    const RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const conn = new Connection(RPC, 'confirmed');
    const latest = await conn.getLatestBlockhash();
    const matchIdBytes = room.matchIdBytes;

    const [matchStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(ESCROW_CONSTANTS.MATCH_SEED), matchIdBytes],
      CORA_ESCROW_PROGRAM_ID,
    );
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(ESCROW_CONSTANTS.VAULT_SEED), matchIdBytes],
      CORA_ESCROW_PROGRAM_ID,
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

    if (tokenMint.toBase58() === DEVNET_TOKEN_MINTS.SOL) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: depositor,
          toPubkey: depositorATA,
          lamports: wagerAmount,
        }),
        createSyncNativeInstruction(depositorATA)
      );
    }

    if (initializeMatch) {
      const privateKey = process.env.SERVER_KEYPAIR;
      if (!privateKey) throw new Error("Missing SERVER_KEYPAIR for backend");
      const serverKeypair = privateKey.trimStart().startsWith('[')
        ? new Uint8Array(JSON.parse(privateKey))
        : bs58.decode(privateKey);
      const serverPubkey = new PublicKey(serverKeypair.subarray(32, 64));

      const wagerAmountBuffer = Buffer.alloc(8);
      wagerAmountBuffer.writeBigUInt64LE(BigInt(wagerAmount));
      
      const initData = Buffer.concat([
        ESCROW_INSTRUCTION_DISCRIMINATORS.initializeMatch,
        Buffer.from(matchIdBytes),
        wagerAmountBuffer,
        serverPubkey.toBuffer()
      ]);

      const initIx = new TransactionInstruction({
        programId: CORA_ESCROW_PROGRAM_ID,
        data: initData,
        keys: [
          { pubkey: depositor, isSigner: true, isWritable: true },
          { pubkey: new PublicKey(initializeOpponent || account), isSigner: false, isWritable: false },
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
      programId: CORA_ESCROW_PROGRAM_ID,
      data: ESCROW_INSTRUCTION_DISCRIMINATORS.depositWager,
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
