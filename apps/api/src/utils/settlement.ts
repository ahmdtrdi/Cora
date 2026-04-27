import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

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
 * Signs the settlement payload.
 * The server signs a deterministic message that matches the Anchor program's expected payload.
 * 
 * @param matchId The unique ID of the match
 * @param winnerAddress The Solana public key of the winning wallet
 * @returns Base58 encoded signature that the client or server can submit on-chain
 */
export function signSettlementAuthorization(matchId: string, winnerAddress: string): string {
  // Construct a deterministic message string. 
  // The Anchor program expects to verify a signature over this exact payload format.
  const messageString = `SETTLE:${matchId}:${winnerAddress}`;
  const messageBuffer = Buffer.from(messageString, 'utf-8');

  // Sign using Ed25519 (standard Solana signature)
  const signatureBytes = nacl.sign.detached(messageBuffer, serverKeypair.secretKey);

  // Return signature encoded in Base58 for easy transportation & Anchor parsing
  return bs58.encode(signatureBytes);
}
