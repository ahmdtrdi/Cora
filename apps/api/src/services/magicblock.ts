import { Connection, PublicKey, Keypair } from '@solana/web3.js';

const BATTLE_PROGRAM_ID = new PublicKey(process.env.CORA_BATTLE_PROGRAM_ID || '11111111111111111111111111111111');
const BATTLE_SEED = Buffer.from('battle');

const mbRpcUrl = process.env.MAGICBLOCK_RPC_URL || 'https://devnet.magicblock.app';
const mbConnection = new Connection(mbRpcUrl, 'confirmed');

export interface BattleSessionState {
  healthA: number;
  healthB: number;
  scoreA: number;
  scoreB: number;
  winner: string | null;
  status: 'Active' | 'Finished';
}

/**
 * Orchestrates interactions with the cora-battle Anchor program
 * running on a MagicBlock Ephemeral Rollup (ER).
 *
 * The service is designed to be non-blocking: all methods catch errors
 * internally so callers can treat ER as an optional, parallel path
 * alongside the local GameEngine.
 */
export class MagicBlockService {
  /**
   * Create an ER session for a match.
   * Delegates the BattleSession PDA to the Ephemeral Rollup.
   */
  async createBattleSession(params: {
    matchId: Uint8Array;
    playerA: string;
    playerB: string;
    questionHash: Uint8Array;
    serverKeypair: Keypair;
  }): Promise<{ sessionPda: string }> {
    const [sessionPda] = PublicKey.findProgramAddressSync(
      [BATTLE_SEED, params.matchId],
      BATTLE_PROGRAM_ID,
    );

    // TODO: Call create_session instruction on mainchain via Anchor client
    // TODO: Delegate PDA to ER via MagicBlock SDK (exact API depends on SDK version)
    //   Example: await EphemeralRollup.delegate(sessionPda, BATTLE_PROGRAM_ID, ...)

    console.log(`[MagicBlock] Created battle session: ${sessionPda.toBase58()}`);
    return { sessionPda: sessionPda.toBase58() };
  }

  /**
   * Register an ephemeral card on ER for a battle session.
   */
  async registerCard(params: {
    sessionPda: string;
    cardId: Uint8Array;
    correctHash: Uint8Array;
    damage: number;
    serverKeypair: Keypair;
  }): Promise<string> {
    // TODO: Submit register_cards instruction to ER
    console.log(`[MagicBlock] Registered dummy card mapping for session ${params.sessionPda}`);
    return 'tx_hash_placeholder';
  }

  /**
   * Read battle session state from ER.
   * Parses the BattleSession account data (skips 8-byte Anchor discriminator).
   *
   * BattleSession layout (after discriminator):
   *   match_id:      [u8; 32]  offset 0
   *   player_a:      Pubkey    offset 32
   *   player_b:      Pubkey    offset 64
   *   health_a:      u16       offset 96
   *   health_b:      u16       offset 98
   *   score_a:       u16       offset 100
   *   score_b:       u16       offset 102
   *   current_round: u8        offset 104
   *   rounds_won_a:  u8        offset 105
   *   rounds_won_b:  u8        offset 106
   *   status:        u8        offset 107  (0=Active, 1=Finished)
   *   winner:        Pubkey    offset 108
   */
  async getSessionState(sessionPda: string): Promise<BattleSessionState> {
    const account = await mbConnection.getAccountInfo(new PublicKey(sessionPda));
    if (!account) throw new Error('Session not found on ER');

    const data = account.data;
    const DISC = 8; // Anchor discriminator

    const healthA = data.readUInt16LE(DISC + 96);
    const healthB = data.readUInt16LE(DISC + 98);
    const scoreA  = data.readUInt16LE(DISC + 100);
    const scoreB  = data.readUInt16LE(DISC + 102);
    const status  = data.readUInt8(DISC + 107) === 0 ? 'Active' : 'Finished';

    const winnerBytes = data.subarray(DISC + 108, DISC + 140);
    const winnerKey = new PublicKey(winnerBytes);
    const winner = winnerKey.equals(PublicKey.default) ? null : winnerKey.toBase58();

    return { healthA, healthB, scoreA, scoreB, winner, status };
  }
}

export const magicBlockService = new MagicBlockService();
