import { serverPublicKey, signSettlementAuthorization, submitRefundTransaction, submitSettlementTransaction, getServerKeypair } from '../../utils/settlement';
import {
  isMagicBlockConfigured,
  magicBlockService,
  deriveRegisteredCardPda,
  EFFECT_ATTACK,
  EFFECT_HEAL,
} from '../../services/magicblock';
import { getWagerUsdValue } from '../../services/goldrush';
import { deriveQuestionHash } from '../../utils/questionHash';
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
   * Full ER setup pipeline for MagicBlock-enabled rooms.
   *
   * Flow: createSession → registerCardV2 (visible hand × 2 players)
   *     → activateSession → delegateBattleSession
   *     → delegateRegisteredCard (each card)
   *     → persist registry on room
   *
   * On any error, erEnabled is flipped to false and the match continues engine-only.
   */
  public async createBattleSession(room: Room): Promise<void> {
    if (!room.erEnabled) return;
    if (!room.playerA || !room.playerB) return;
    if (!room.engine) return;

    const keypair = getServerKeypair();
    const setupTxs: string[] = [];

    try {
      // ── Phase 1: Create Session ──────────────────────────────────
      room.erLifecycleStatus = 'creating';
      const questionHash = deriveQuestionHash(room.engine.getQuestions());

      const { sessionPda, signature: createSig } = await magicBlockService.createSession({
        roomId: room.id,
        playerA: room.playerA,
        playerB: room.playerB,
        questionHash,
        serverKeypair: keypair,
      });
      room.erSessionPda = sessionPda;
      setupTxs.push(createSig);
      console.log(`[MagicBlock] Phase 1/5 done — session created: ${sessionPda}`);

      // ── Phase 2: Register visible hand cards ─────────────────────
      room.erLifecycleStatus = 'registering';
      const players: [string, string] = [room.playerA, room.playerB];

      for (let pIdx = 0; pIdx < players.length; pIdx++) {
        const playerAddr = players[pIdx];
        const playerState = room.engine.getStateForPlayer(playerAddr);
        const hand = playerState.hand; // Card[] (visible, up to HAND_SIZE)

        for (let sIdx = 0; sIdx < hand.length; sIdx++) {
          const card = hand[sIdx];
          // Deterministic card key: <playerIndex>-<slotIndex> (e.g. "0-00", "1-04")
          const cardKey = `${pIdx}-${String(sIdx).padStart(2, '0')}`;
          const effectType = card.type === 'attack' ? EFFECT_ATTACK : EFFECT_HEAL;
          const maxValue = card.type === 'attack' ? 50 : 10; // BASE_DAMAGE / BASE_HEAL

          const cardPda = deriveRegisteredCardPda(sessionPda, cardKey);
          const regSig = await magicBlockService.registerCardV2({
            roomId: room.id,
            sessionPda,
            serverKeypair: keypair,
            owner: playerAddr,
            cardId: cardKey,
            effectType,
            maxValue,
          });
          setupTxs.push(regSig);

          // Persist in room registry
          room.erCardRegistry.set(`${playerAddr}:${card.id}`, {
            cardPda: cardPda.toBase58(),
            owner: playerAddr,
            effectType,
            maxValue,
            isDelegated: false,
            isConsumed: false,
          });
        }
      }
      console.log(`[MagicBlock] Phase 2/5 done — ${room.erCardRegistry.size} cards registered`);

      // ── Phase 3: Activate session ────────────────────────────────
      room.erLifecycleStatus = 'activating';
      const activateSig = await magicBlockService.activateSession({
        roomId: room.id,
        sessionPda,
        serverKeypair: keypair,
      });
      setupTxs.push(activateSig);
      console.log(`[MagicBlock] Phase 3/5 done — session activated`);

      // ── Phase 4: Delegate session PDA ────────────────────────────
      room.erLifecycleStatus = 'delegating';
      const delegateSessionSig = await magicBlockService.delegateBattleSession({
        roomId: room.id,
        sessionPda,
        serverKeypair: keypair,
      });
      setupTxs.push(delegateSessionSig);
      console.log(`[MagicBlock] Phase 4/5 done — session delegated`);

      // ── Phase 5: Delegate each registered card PDA ───────────────
      for (const [_regKey, regCard] of room.erCardRegistry) {
        const delegateCardSig = await magicBlockService.delegateRegisteredCard({
          roomId: room.id,
          sessionPda,
          cardPda: regCard.cardPda,
          serverKeypair: keypair,
        });
        setupTxs.push(delegateCardSig);
        regCard.isDelegated = true;
      }
      console.log(`[MagicBlock] Phase 5/5 done — all cards delegated`);

      // ── Done ─────────────────────────────────────────────────────
      room.erLifecycleStatus = 'active';
      room.erProofMeta = {
        sessionPda,
        setupTxSignatures: setupTxs,
        terminalTxSignatures: [],
        endReason: null,
      };

      console.log(`[MagicBlock] ER setup complete for room ${room.id}. Session: ${sessionPda}. Cards: ${room.erCardRegistry.size}. Txs: ${setupTxs.length}`);

    } catch (err) {
      console.warn(`[MagicBlock] ER setup failed for room ${room.id}, falling back to engine-only:`, err);
      room.erEnabled = false;
      room.erLifecycleStatus = 'failed';
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
