import { Connection, PublicKey, Keypair } from '@solana/web3.js';

const BATTLE_PROGRAM_ID = new PublicKey(process.env.CORA_BATTLE_PROGRAM_ID || '11111111111111111111111111111111');
const BATTLE_SEED = Buffer.from('battle');

const mbRouterRpcUrl = process.env.MAGICBLOCK_ROUTER_RPC_URL
  || process.env.MAGICBLOCK_RPC_URL
  || 'https://devnet-router.magicblock.app';
const mbConnection = new Connection(mbRouterRpcUrl, 'confirmed');

export const MAGICBLOCK_END_REASONS = {
  NONE: 0,
  NORMAL_WIN: 1,
  SINGLE_PLAYER_TIMEOUT: 2,
  BOTH_PLAYERS_TIMEOUT: 3,
  SERVER_CANCELLED: 4,
  CHEATER_FLAGGED: 5,
  FORCE_ENDED: 6,
} as const;

export function isMagicBlockConfigured(): boolean {
  return Boolean(process.env.MAGICBLOCK_ROUTER_RPC_URL || process.env.MAGICBLOCK_RPC_URL);
}

export interface BattleSessionState {
  healthA: number;
  healthB: number;
  scoreA: number;
  scoreB: number;
  currentRound: number;
  roundDeadline: number;
  winner: string | null;
  status: 'WaitingCards' | 'Active' | 'Finished' | 'Cancelled';
  endReason: number;
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
   * Create a base-layer battle session for a match.
   * Delegation is a separate lifecycle step handled by delegateBattleSession().
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

    // TODO: Call create_session instruction on the Solana base layer via Anchor client.

    console.log(`[MagicBlock] Created battle session: ${sessionPda.toBase58()}`);
    return { sessionPda: sessionPda.toBase58() };
  }

  async delegateBattleSession(params: {
    sessionPda: string;
    serverKeypair: Keypair;
  }): Promise<string> {
    // TODO: Send delegate_battle_session through Magic Router.
    console.log(`[MagicBlock] Delegated battle session ${params.sessionPda}`);
    return 'tx_hash_placeholder';
  }

  /**
   * Register an ephemeral card on ER for a battle session.
   */
  async registerCard(params: {
    sessionPda: string;
    cardId: Uint8Array;
    damage: number;
    serverKeypair: Keypair;
  }): Promise<string> {
    // TODO: Submit register_card instruction to Magic Router/ER.
    console.log(`[MagicBlock] Registered dummy card mapping for session ${params.sessionPda}`);
    return 'tx_hash_placeholder';
  }

  async delegateRegisteredCard(params: {
    sessionPda: string;
    cardId: Uint8Array;
    serverKeypair: Keypair;
  }): Promise<string> {
    // TODO: Send delegate_registered_card through Magic Router for cards mutated in ER.
    console.log(`[MagicBlock] Delegated registered card for session ${params.sessionPda}`);
    return 'tx_hash_placeholder';
  }

  async activateSession(params: {
    sessionPda: string;
    serverKeypair: Keypair;
  }): Promise<string> {
    // TODO: Submit activate_session through Magic Router/ER.
    console.log(`[MagicBlock] Activated battle session ${params.sessionPda}`);
    return 'tx_hash_placeholder';
  }

  async applyDamage(params: {
    sessionPda: string;
    attacker: string;
    cardId: Uint8Array;
    serverKeypair: Keypair;
  }): Promise<string> {
    // TODO: Submit apply_damage through Magic Router/ER after off-chain correctness checks.
    console.log(`[MagicBlock] Applied damage for attacker ${params.attacker} in session ${params.sessionPda}`);
    return 'tx_hash_placeholder';
  }

  async timeoutPlayerForRound(params: {
    sessionPda: string;
    timedOutPlayer: string;
    serverKeypair: Keypair;
  }): Promise<string> {
    // TODO: Submit timeout_player_for_round only after BE observes timeout until round end.
    console.log(`[MagicBlock] Timed out player ${params.timedOutPlayer} for session ${params.sessionPda}`);
    return 'tx_hash_placeholder';
  }

  async cancelSession(params: {
    sessionPda: string;
    reason: number;
    serverKeypair: Keypair;
  }): Promise<string> {
    // TODO: Submit cancel_session for no-contest/server failure outcomes.
    console.log(`[MagicBlock] Cancelled session ${params.sessionPda} with reason ${params.reason}`);
    return 'tx_hash_placeholder';
  }

  async finalizeMatch(params: {
    sessionPda: string;
    serverKeypair: Keypair;
  }): Promise<string> {
    // TODO: Submit finalize_match after ER outcome is committed/readable.
    console.log(`[MagicBlock] Finalized battle session ${params.sessionPda}`);
    return 'tx_hash_placeholder';
  }

  async commitBattleSession(params: {
    sessionPda: string;
    serverKeypair: Keypair;
  }): Promise<string> {
    // TODO: Send commit_battle_session through Magic Router after meaningful state changes.
    console.log(`[MagicBlock] Committed battle session ${params.sessionPda}`);
    return 'tx_hash_placeholder';
  }

  async undelegateBattleSession(params: {
    sessionPda: string;
    serverKeypair: Keypair;
  }): Promise<string> {
    // TODO: Send undelegate_battle_session through Magic Router before base-layer settlement.
    console.log(`[MagicBlock] Undelegated battle session ${params.sessionPda}`);
    return 'tx_hash_placeholder';
  }

  /**
   * Read battle session state from ER.
   * Parses the BattleSession account data (skips 8-byte Anchor discriminator).
   *
   * BattleSession layout (after discriminator):
   *   version:       u8        offset 0
   *   match_id:      [u8; 32]  offset 1
   *   authority:     Pubkey    offset 33
   *   player_a:      Pubkey    offset 65
   *   player_b:      Pubkey    offset 97
   *   health_a:      u16       offset 129
   *   health_b:      u16       offset 131
   *   score_a:       u16       offset 133
   *   score_b:       u16       offset 135
   *   current_round: u8        offset 137
   *   round_deadline:i64       offset 148
   *   status:        u8        offset 160
   *   winner:        Pubkey    offset 161
   *   end_reason:    u8        offset 242
   */
  async getSessionState(sessionPda: string): Promise<BattleSessionState> {
    const account = await mbConnection.getAccountInfo(new PublicKey(sessionPda));
    if (!account) throw new Error('Session not found on ER');

    const data = account.data;
    const DISC = 8; // Anchor discriminator

    const healthA = data.readUInt16LE(DISC + 129);
    const healthB = data.readUInt16LE(DISC + 131);
    const scoreA  = data.readUInt16LE(DISC + 133);
    const scoreB  = data.readUInt16LE(DISC + 135);
    const currentRound = data.readUInt8(DISC + 137);
    const roundDeadline = Number(data.readBigInt64LE(DISC + 148));
    const statusVariant = data.readUInt8(DISC + 160);
    const status = ['WaitingCards', 'Active', 'Finished', 'Cancelled'][statusVariant] as BattleSessionState['status'];

    const winnerBytes = data.subarray(DISC + 161, DISC + 193);
    const winnerKey = new PublicKey(winnerBytes);
    const winner = winnerKey.equals(PublicKey.default) ? null : winnerKey.toBase58();
    const endReason = data.readUInt8(DISC + 242);

    return { healthA, healthB, scoreA, scoreB, currentRound, roundDeadline, winner, status, endReason };
  }
}

export const magicBlockService = new MagicBlockService();
