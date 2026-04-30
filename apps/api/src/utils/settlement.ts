import {
  Keypair,
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Ed25519Program,
  sendAndConfirmTransaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { buildSettlementMessage, ESCROW_CONSTANTS } from '@shared/escrow';

/**
 * Loads the server keypair from the environment variable.
 * Fallback to a randomly generated one for local development if not provided,
 * but logs a loud warning.
 */
export function getServerKeypair(): Keypair {
  const secretEnv = process.env.SERVER_KEYPAIR;

  if (!secretEnv) {
    console.warn('⚠️  WARNING: SERVER_KEYPAIR is missing in .env! Generating an ephemeral throwaway keypair for this session. Do NOT do this in production.');
    return Keypair.generate();
  }

  try {
    // Try passing it as a JSON array of numbers first (standard solana-keygen format)
    if (secretEnv.startsWith('[')) {
      const secretBytes = Uint8Array.from(JSON.parse(secretEnv));
      return Keypair.fromSecretKey(secretBytes);
    }
    
    // Otherwise fallback to trying base58 decode (Phantom export format)
    const secretBytes = bs58.decode(secretEnv);
    return Keypair.fromSecretKey(secretBytes);
  } catch (error) {
    console.error('Failed to parse SERVER_KEYPAIR environment variable. Must be a JSON array or Base58 string.');
    throw error;
  }
}

const serverKeypair = getServerKeypair();
export const serverPublicKey = serverKeypair.publicKey.toBase58();

/**
 * Signs the settlement payload using the shared message format.
 * The signed message exactly matches what the Anchor program reconstructs and verifies.
 *
 * Message format (defined in @cora/shared-types/escrow):
 *   65 bytes: action (1 byte) + match_id (32 bytes) + target_pubkey (32 bytes)
 *
 * @param action 0 for Normal (winner), 1 for Anti-Cheat (cheater)
 * @param matchId The 32-byte match ID
 * @param targetAddress The Solana public key of the target (winner or cheater)
 * @returns Base58 encoded signature that the client or server can submit on-chain
 */
export function signSettlementAuthorization(
  action: number,
  matchId: Uint8Array,
  targetAddress: string,
): string {
  const messageBytes = buildSettlementMessage(action, matchId, targetAddress);

  // Sign using Ed25519 (standard Solana signature)
  const signatureBytes = nacl.sign.detached(messageBytes, serverKeypair.secretKey);

  // Return signature encoded in Base58 for easy transportation & Anchor parsing
  return bs58.encode(signatureBytes);
}

const PROGRAM_ID = new PublicKey('9Pqkgy5uu9w2HvgyNUnHEvzdRWSv1h6GyCuD4uKBVp1W');

/**
 * Submits the settle_match transaction directly to the Solana blockchain,
 * handling the funds movement entirely server-side.
 *
 * @param action 0 for Normal (winner), 1 for Anti-Cheat (cheater)
 * @param matchId 32-byte match ID array
 * @param targetAddress Public key string of the target
 * @returns Solana Transaction Hash
 */
export async function submitSettlementTransaction(
  action: number,
  matchId: Uint8Array,
  targetAddress: string,
): Promise<string> {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'http://127.0.0.1:8899';
  const connection = new Connection(rpcUrl, 'confirmed');

  const matchStatePda = PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_CONSTANTS.MATCH_SEED), matchId],
    PROGRAM_ID
  )[0];
  const vaultPda = PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_CONSTANTS.VAULT_SEED), matchId],
    PROGRAM_ID
  )[0];

  const accountInfo = await connection.getAccountInfo(matchStatePda);
  if (!accountInfo) {
    throw new Error('MatchState account not found on-chain');
  }

  // Parse MatchState manually to avoid heavy IDL dependency
  // Discriminator: 8 bytes
  // match_id: 32 bytes (offset 8)
  // player_a: 32 bytes (offset 40)
  // player_b: 32 bytes (offset 72)
  // token_mint: 32 bytes (offset 104)
  const matchStateData = accountInfo.data;
  const playerA = new PublicKey(matchStateData.subarray(40, 72));
  const playerB = new PublicKey(matchStateData.subarray(72, 104));
  const tokenMint = new PublicKey(matchStateData.subarray(104, 136));

  const targetPubkey = new PublicKey(targetAddress);
  
  // ATAs
  const playerATa = getAssociatedTokenAddressSync(tokenMint, playerA, true);
  const playerBTa = getAssociatedTokenAddressSync(tokenMint, playerB, true);
  
  const treasuryKey = process.env.TREASURY_PUBKEY 
    ? new PublicKey(process.env.TREASURY_PUBKEY) 
    : serverKeypair.publicKey;
  const treasuryTa = getAssociatedTokenAddressSync(tokenMint, treasuryKey, true);

  const messageBytes = buildSettlementMessage(action, matchId, targetAddress);
  const signatureBytes = nacl.sign.detached(messageBytes, serverKeypair.secretKey);

  const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
    publicKey: serverKeypair.publicKey.toBytes(),
    message: messageBytes,
    signature: signatureBytes,
  });

  // Construct settle_match instruction data
  // Discriminator: sha256("global:settle_match")[0..8] => [0x47, 0x7c, 0x75, 0x60, 0xbf, 0xd9, 0x74, 0x18]
  // Buffer size: 8 (discriminator) + 1 (action) + 32 (target) + 64 (signature) = 105 bytes
  const data = Buffer.alloc(105);
  data.set([0x47, 0x7c, 0x75, 0x60, 0xbf, 0xd9, 0x74, 0x18], 0);
  data.writeUInt8(action, 8);
  data.set(targetPubkey.toBytes(), 9);
  data.set(signatureBytes, 41);

  const settleMatchIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    data,
    keys: [
      { pubkey: serverKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: matchStatePda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: playerATa, isSigner: false, isWritable: true },
      { pubkey: playerBTa, isSigner: false, isWritable: true },
      { pubkey: treasuryTa, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
    ],
  });

  const tx = new Transaction().add(ed25519Ix).add(settleMatchIx);
  
  console.log(`[Settlement] Submitting settle_match for match: ${Buffer.from(matchId).toString('hex')}`);
  console.log(`[Settlement] Winner: ${winnerAddress}`);
  
  const txHash = await sendAndConfirmTransaction(connection, tx, [serverKeypair]);
  console.log(`[Settlement] Success! TxHash: ${txHash}`);
  
  return txHash;
}

