import { serverPublicKey, signSettlementAuthorization, submitRefundTransaction, submitSettlementTransaction, getServerKeypair } from '../../utils/settlement';
import { isMagicBlockConfigured, magicBlockService } from '../../services/magicblock';
import { getWagerUsdValue } from '../../services/goldrush';
import { Room } from './types';
import type { RoomManager } from '../RoomManager';
import type { WsMessage } from '@shared/websocket';

export class Blockchain {
  constructor(private manager: RoomManager) {}

  /**
   * Fetches the USD value of the wager and updates the room state.
   */
  public async fetchWagerUsd(room: Room): Promise<void> {
    if (!room.tokenMint || !room.wagerAmount) return;

    try {
      const usd = await getWagerUsdValue(room.tokenMint, room.wagerAmount);
      if (usd && this.manager.store.getRoom(room.id)) {
        room.wagerUsdValue = usd;
        this.manager.network.broadcastGameState(room);
      }
    } catch (e) {
      console.error('[RoomBlockchain] Failed to fetch wager USD value:', e);
    }
  }

  /**
   * Creates an Ephemeral Rollup session if MagicBlock is configured.
   */
  public async createBattleSession(room: Room): Promise<void> {
    if (!isMagicBlockConfigured()) return;
    if (!room.playerA || !room.playerB) return;

    try {
      const questionHash = new Uint8Array(32); // TODO: hash actual questions when ER is fully wired
      const { sessionPda } = await magicBlockService.createBattleSession({
        matchId: room.matchIdBytes,
        playerA: room.playerA,
        playerB: room.playerB,
        questionHash,
        serverKeypair: getServerKeypair(),
      });
      room.erSessionPda = sessionPda;
      console.log(`[MagicBlock] ER session created: ${sessionPda}`);
      await magicBlockService.delegateBattleSession({
        sessionPda,
        serverKeypair: getServerKeypair(),
      });
    } catch (err) {
      console.warn('[MagicBlock] Failed to create ER session, falling back to server-only:', err);
    }
  }

  /**
   * Broadcasts settlement-signed match result to all connected clients and submits to oracle.
   */
  public async settleMatch(room: Room, winnerAddress: string): Promise<void> {
    // Verify winner against ER if available (ER is source of truth)
    if (room.erSessionPda) {
      try {
        const erState = await magicBlockService.getSessionState(room.erSessionPda);
        if (erState.status === 'Finished' && erState.winner && erState.winner !== winnerAddress) {
          console.error(`[INTEGRITY] ER winner mismatch! ER=${erState.winner} Engine=${winnerAddress}`);
          winnerAddress = erState.winner;
        }
      } catch (err) {
        console.warn('[MagicBlock] Could not verify ER state:', err);
      }
    }

    // Normal match outcome: action = 0
    const action = 0;
    const settlementSignature = signSettlementAuthorization(
      action,
      room.matchIdBytes,
      winnerAddress,
    );

    // Call oracle to automatically submit settlement on-chain
    submitSettlementTransaction(action, room.matchIdBytes, winnerAddress)
      .then(tx => console.log(`[RoomBlockchain] On-chain settlement completed. Tx: ${tx}`))
      .catch(err => console.error(`[RoomBlockchain] Auto-settlement failed:`, err));

    for (const client of room.clients.values()) {
      this.manager.network.safeSend(client.ws, {
        type: 'settlementAuthorization',
        payload: {
          winner: winnerAddress,
          matchId: Buffer.from(room.matchIdBytes).toString('hex'),
          settlementSignature,
          serverPublicKey,
        }
      } as WsMessage);
    }
  }

  /**
   * Settles an anti-cheat invalidated match on-chain.
   */
  public settleAntiCheat(room: Room, cheaterAddress: string): void {
    // Anti-cheat penalty outcome: action = 1
    const action = 1;

    // We only need to tell the contract who the cheater is. The contract will refund the honest player 
    // and send the cheater's funds to the treasury.
    submitSettlementTransaction(action, room.matchIdBytes, cheaterAddress)
      .then(tx => console.log(`[RoomBlockchain] Anti-Cheat penalty on-chain settlement completed. Tx: ${tx}`))
      .catch(err => console.error(`[RoomBlockchain] Anti-Cheat Auto-settlement failed:`, err));
  }

  /**
   * Refunds both players. This should only be used for draws and server errors.
   */
  public refundMatch(room: Room, reason: 'draw' | 'server_error'): void {
    submitRefundTransaction(room.matchIdBytes)
      .then(tx => console.log(`[RoomBlockchain] Refund completed for ${reason}. Tx: ${tx}`))
      .catch(err => console.error(`[RoomBlockchain] Refund failed for ${reason}:`, err));
  }
}
