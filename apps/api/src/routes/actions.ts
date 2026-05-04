import { Hono } from 'hono';
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ESCROW_CONSTANTS } from '@shared/escrow';
import { RoomManager } from '../managers/RoomManager';
import bs58 from 'bs58';

export function createActionsRouter(roomManager: RoomManager) {
  const router = new Hono();

  const PROGRAM_ID = new PublicKey('9Pqkgy5uu9w2HvgyNUnHEvzdRWSv1h6GyCuD4uKBVp1W');
  const DEPOSIT_WAGER_DISCRIMINATOR = Buffer.from([234, 73, 235, 136, 168, 103, 239, 207]);
  const INITIALIZE_MATCH_DISCRIMINATOR = Buffer.from([156, 133, 52, 179, 176, 29, 64, 124]);

  // ---------------------------------------------------------------------------
  // Solana Actions & Blinks Middleware
  // Spec: https://solana.com/docs/advanced/actions#options-response
  // All Action endpoints MUST return these CORS headers for GET, POST & OPTIONS.
  // ---------------------------------------------------------------------------
  router.use('/*', async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
    c.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Action-Version, X-Blockchain-Ids',
    );
    c.header('Access-Control-Expose-Headers', 'X-Action-Version, X-Blockchain-Ids');
    c.header('X-Action-Version', '2.1.3');
    c.header('X-Blockchain-Ids', 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'); // Solana Devnet

    if (c.req.method === 'OPTIONS') {
      return c.text('OK', 200);
    }

    await next();
  });

  // ---------------------------------------------------------------------------
  // GET /api/actions/challenge — Action metadata (renders the Blink on X)
  //
  // If ?roomId is provided, validates the room state and returns contextual metadata.
  // If no roomId, returns the generic public matchmaking Blink.
  // ---------------------------------------------------------------------------
  router.get('/challenge', (c) => {
    const roomId = c.req.query('roomId');
    const iconUrl = 'https://arweave.net/qN7Xy_CgGf2Y-DItf-Bf0iV9Wl80S-c4m2rV6Q5S3j0';

    if (roomId) {
      const room = roomManager.getRoom(roomId);

      if (!room || room.status === 'finished') {
        return c.json({ error: { message: 'Challenge canceled — this room no longer exists.' } }, 400);
      }
      if (room.playerB !== null) {
        return c.json({ error: { message: 'Challenge already accepted — this match is full.' } }, 400);
      }

      // Valid open room — return a targeted Blink
      return c.json({
        type: 'action' as const,
        icon: iconUrl,
        title: 'CORA — Accept the Challenge ⚔️',
        description:
          'Your opponent is waiting! Deposit your wager and join the battle. ' +
          '97.5% to the winner — powered by Solana.',
        label: 'Accept & Deposit',
        links: {
          actions: [
            {
              type: 'transaction' as const,
              label: 'Accept Challenge',
              href: `/api/actions/challenge?roomId=${roomId}`,
            },
          ],
        },
      });
    }

    // Generic public matchmaking Blink (no roomId)
    return c.json({
      type: 'action' as const,
      icon: iconUrl,
      title: 'CORA — Challenge Me ⚔️',
      description:
        'Wager your tokens in a high-stakes aptitude battle! ' +
        'Match instantly, prove your logic skills, and take the pot. ' +
        '97.5% to the winner — powered by Solana.',
      label: 'Deposit & Play',
      links: {
        actions: [
          {
            type: 'transaction' as const,
            label: 'Stake 5 USDC',
            href: '/api/actions/challenge?amount=5',
          },
          {
            type: 'transaction' as const,
            label: 'Stake 10 USDC',
            href: '/api/actions/challenge?amount=10',
          },
          {
            type: 'transaction' as const,
            label: 'Stake 25 USDC',
            href: '/api/actions/challenge?amount=25',
          },
          {
            type: 'transaction' as const,
            label: 'Custom Stake',
            href: '/api/actions/challenge?amount={amount}',
            parameters: [
              {
                type: 'number' as const,
                name: 'amount',
                label: 'Enter stake amount (USDC)',
                required: true,
                min: 1,
                max: 1000,
                patternDescription: 'Enter a number between 1 and 1000',
              },
            ],
          },
        ],
      },
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/actions/challenge — Build unsigned Solana transaction (base64)
  //
  // If ?roomId is present: Player B joining a private/Blink room.
  //   Calls joinPrivateRoom, then builds the real deposit_wager instruction.
  // If no roomId: generic public queue entry (future use).
  //
  // Spec reference — POST Request Body:  { "account": "<base58 pubkey>" }
  // POST Response Body:                  { "transaction": "<base64>", "message"?: string }
  // ---------------------------------------------------------------------------
  router.post('/challenge', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const account: string | undefined = body.account;
      const roomId = c.req.query('roomId');

      if (!account) {
        return c.json(
          { message: 'Missing `account` in POST body (base58 public key)' } satisfies ActionError,
          400,
        );
      }

      if (!roomId) {
        return c.json(
          { message: 'Missing `roomId` query parameter. Use POST /match/private to create a room first.' } satisfies ActionError,
          400,
        );
      }

      const room = roomManager.getRoom(roomId)!;
      if (!room) {
        return c.json({ message: 'Challenge canceled — this room no longer exists.' } satisfies ActionError, 404);
      }

      // Allow frontend to populate missing tokenMint and wagerAmount for public matchmaking
      if (room.roomType === 'public' && room.tokenMint === null && body.tokenMint) {
        room.tokenMint = body.tokenMint;
      }
      if (room.roomType === 'public' && room.wagerAmount === null && body.wagerAmount !== undefined) {
        room.wagerAmount = BigInt(body.wagerAmount);
      }

      // Check if user is already in the room
      const isPlayerA = room.playerA === account;
      const isPlayerB = room.playerB === account;

      // If not already in the room, try to join as Player B (Blink flow)
      if (!isPlayerA && !isPlayerB) {
        const joinResult = roomManager.joinPrivateRoom(account, roomId);
        if (joinResult === 'not_found') {
          return c.json({ message: 'Challenge canceled — this room no longer exists.' } satisfies ActionError, 404);
        }
        if (joinResult === 'cancelled') {
          return c.json({ message: 'Challenge canceled — the deposit window has expired.' } satisfies ActionError, 410);
        }
        if (joinResult === 'full') {
          return c.json({ message: 'Challenge already accepted — this match is full.' } satisfies ActionError, 409);
        }
      }

      if (!room.tokenMint || room.wagerAmount === null) {
        return c.json({ message: 'Internal error — room is missing token configuration.' } satisfies ActionError, 500);
      }

      const RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
      const conn = new Connection(RPC, 'confirmed');
      const latest = await conn.getLatestBlockhash();

      const depositor = new PublicKey(account);
      const tokenMint = new PublicKey(room.tokenMint);
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

      // If Player A is invoking this, we must initialize the match first
      if (isPlayerA) {
        // Find server pubkey
        const privateKey = process.env.SERVER_KEYPAIR;
        if (!privateKey) throw new Error("Missing SERVER_KEYPAIR for backend");
        const serverKeypair = bs58.decode(privateKey);
        // The last 32 bytes of the bs58 decoded string of a secret key or using Keypair
        // We will just read the Public Key from the private key via slice. Note: for ed25519 64 byte keys, it's bytes 32..64.
        const serverPubkey = new PublicKey(serverKeypair.subarray(32, 64));

        const wagerAmountBuffer = Buffer.alloc(8);
        wagerAmountBuffer.writeBigUInt64LE(BigInt(room.wagerAmount));
        
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
            { pubkey: depositor, isSigner: true, isWritable: true }, // player_a
            { pubkey: new PublicKey(room.playerB || account), isSigner: false, isWritable: false }, // player_b (might be fake if B hasn't joined, but it cannot be same as player_a. If B hasn't joined wait...)
            { pubkey: tokenMint, isSigner: false, isWritable: false }, // tokenMint
            { pubkey: matchStatePDA, isSigner: false, isWritable: true }, // matchState PDA
            { pubkey: vaultPDA, isSigner: false, isWritable: true }, // vault PDA
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // tokenProgram
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // systemProgram
          ],
        });
        tx.add(initIx);
      }

      // deposit_wager has no args — only accounts, no data beyond the discriminator
      const depositWagerIx = new TransactionInstruction({
        programId: PROGRAM_ID,
        data: DEPOSIT_WAGER_DISCRIMINATOR,
        keys: [
          { pubkey: depositor,      isSigner: true,  isWritable: true  }, // depositor
          { pubkey: matchStatePDA,  isSigner: false, isWritable: true  }, // matchState PDA
          { pubkey: depositorATA,   isSigner: false, isWritable: true  }, // depositorTokenAccount
          { pubkey: vaultPDA,       isSigner: false, isWritable: true  }, // vault PDA
          { pubkey: tokenMint,      isSigner: false, isWritable: false }, // tokenMint
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // tokenProgram
        ],
      });

      tx.add(depositWagerIx);

      const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const base64 = serialized.toString('base64');

      return c.json({
        transaction: base64,
        message: 'Sign to deposit your wager and join the CORA battle!',
      });
    } catch (err) {
      console.error('[actions/challenge POST] Failed to build transaction', err);
      return c.json(
        { message: 'Internal error — failed to build transaction' } satisfies ActionError,
        500,
      );
    }
  });

  return router;
}

// ---------------------------------------------------------------------------
// Lightweight error shape matching the Solana Actions spec (ActionError)
// ---------------------------------------------------------------------------
interface ActionError {
  message: string;
}