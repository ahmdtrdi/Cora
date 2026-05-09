import { serverPublicKey, signSettlementAuthorization, submitRefundTransaction, submitSettlementTransaction, getServerKeypair } from '../../utils/settlement';
import {
  magicBlockService,
  deriveRegisteredCardPda,
  estimateErSetupRentLamports,
  EFFECT_ATTACK,
  EFFECT_HEAL,
  END_REASON_SINGLE_PLAYER_TIMEOUT,
  END_REASON_BOTH_PLAYERS_TIMEOUT,
  END_REASON_SERVER_CANCELLED,
  getBaseLamportBalance,
  type BattleSessionState,
} from '../../services/magicblock';
import { getWagerUsdValue } from '../../services/goldrush';
import { deriveQuestionHash } from '../../utils/questionHash';
import { Room } from './types';
import type { RoomManager } from '../RoomManager';
import type { MatchResult, WsMessage } from '@shared/websocket';
import type { EngineCard } from '@cora/game-logic';

const GAMEPLAY_MAX_ATTACK_EFFECT_VALUE = 150;
const GAMEPLAY_MAX_HEAL_EFFECT_VALUE = 30;
const DEPLOYED_MAX_EFFECT_VALUE = Number(process.env.CORA_BATTLE_MAX_EFFECT_VALUE ?? 100);
const REGISTERED_MAX_ATTACK_EFFECT_VALUE = Math.min(GAMEPLAY_MAX_ATTACK_EFFECT_VALUE, DEPLOYED_MAX_EFFECT_VALUE);
const REGISTERED_MAX_HEAL_EFFECT_VALUE = Math.min(GAMEPLAY_MAX_HEAL_EFFECT_VALUE, DEPLOYED_MAX_EFFECT_VALUE);
const MIN_ER_PRE_REGISTER_CARD_LIMIT = 5;
const ER_PRE_REGISTER_CARD_LIMIT = Math.max(
  MIN_ER_PRE_REGISTER_CARD_LIMIT,
  Number(process.env.CORA_BATTLE_PRE_REGISTER_CARD_LIMIT ?? 20),
);
const ER_SETUP_CONCURRENCY = Math.max(1, Number(process.env.CORA_BATTLE_SETUP_CONCURRENCY ?? 8));
const ER_SETUP_FEE_CUSHION_LAMPORTS = Math.max(
  500_000,
  Number(process.env.CORA_BATTLE_SETUP_FEE_CUSHION_LAMPORTS ?? 1_500_000),
);

async function runWithConcurrency(tasks: Array<() => Promise<void>>, concurrency: number): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (nextIndex < tasks.length) {
      const task = tasks[nextIndex++];
      await task();
    }
  });
  await Promise.all(workers);
}

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
    if (!room.erEnabled) {
      console.log(`[MagicBlock] ER disabled for room ${room.id} — running engine-only`);
      return;
    }
    if (DEPLOYED_MAX_EFFECT_VALUE < GAMEPLAY_MAX_ATTACK_EFFECT_VALUE) {
      console.warn(
        `[MagicBlock] ER compatibility mode for room ${room.id} — deployed cora-battle MAX_EFFECT_VALUE=${DEPLOYED_MAX_EFFECT_VALUE}. ` +
        `Attack effects above ${REGISTERED_MAX_ATTACK_EFFECT_VALUE} will be capped until web3 deploys MAX_EFFECT_VALUE=${GAMEPLAY_MAX_ATTACK_EFFECT_VALUE}.`,
      );
    }
    if (!room.playerA || !room.playerB) return;
    if (!room.engine) return;

    const keypair = getServerKeypair();
    const setupTxs: string[] = [];
    const queue = room.engine.getMatchQueue().slice(0, ER_PRE_REGISTER_CARD_LIMIT);
    const registeredCardCount = queue.length * 2;
    const [availableLamports, rentEstimate] = await Promise.all([
      getBaseLamportBalance(keypair.publicKey),
      estimateErSetupRentLamports(registeredCardCount),
    ]);
    const recommendedLamports = rentEstimate.totalRentLamports + ER_SETUP_FEE_CUSHION_LAMPORTS;

    if (availableLamports < recommendedLamports) {
      console.warn(
        `[MagicBlock] ER disabled for room ${room.id} — insufficient server SOL for setup. ` +
        `Available=${availableLamports} lamports, recommended_min=${recommendedLamports} ` +
        `for ${registeredCardCount} registered cards (rent=${rentEstimate.totalRentLamports}, ` +
        `fee_cushion=${ER_SETUP_FEE_CUSHION_LAMPORTS}). Top up ${keypair.publicKey.toBase58()} ` +
        `on devnet or reduce CORA_BATTLE_PRE_REGISTER_CARD_LIMIT.`,
      );
      room.erEnabled = false;
      room.erLifecycleStatus = 'failed';
      room.engine?.setExternalAuthority(false);
      return;
    }

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
      const registrationJobs: Array<() => Promise<void>> = [];
      console.log(
        `[MagicBlock] Pre-registering ${queue.length} cards per player for room ${room.id} ` +
        `with concurrency ${ER_SETUP_CONCURRENCY}.`,
      );

      for (let pIdx = 0; pIdx < players.length; pIdx++) {
        const playerAddr = players[pIdx];

        for (let queueIdx = 0; queueIdx < queue.length; queueIdx++) {
          const card = queue[queueIdx];
          // Deterministic compact card key: <playerIndex>-<queueIndex>.
          const cardKey = `${pIdx}-${String(queueIdx).padStart(2, '0')}`;
          const effectType = card.type === 'attack' ? EFFECT_ATTACK : EFFECT_HEAL;
          const maxValue = card.type === 'attack' ? REGISTERED_MAX_ATTACK_EFFECT_VALUE : REGISTERED_MAX_HEAL_EFFECT_VALUE;

          const cardPda = deriveRegisteredCardPda(sessionPda, cardKey);
          registrationJobs.push(async () => {
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
              cardId: cardKey,
              effectType,
              maxValue,
              isDelegated: false,
              isConsumed: false,
            });
          });
        }
      }
      await runWithConcurrency(registrationJobs, ER_SETUP_CONCURRENCY);
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
      const delegateJobs = Array.from(room.erCardRegistry.values()).map(regCard => async () => {
        const delegateCardSig = await magicBlockService.delegateRegisteredCard({
          roomId: room.id,
          sessionPda,
          cardPda: regCard.cardPda,
          cardId: regCard.cardId,
          serverKeypair: keypair,
        });
        setupTxs.push(delegateCardSig);
        regCard.isDelegated = true;
      });
      await runWithConcurrency(delegateJobs, ER_SETUP_CONCURRENCY);
      console.log(`[MagicBlock] Phase 5/5 done — all cards delegated`);

      // ── Done ─────────────────────────────────────────────────────
      room.erLifecycleStatus = 'active';
      room.erProofMeta = {
        sessionPda,
        setupTxSignatures: setupTxs,
        terminalTxSignatures: [],
        status: 'Active',
        winner: null,
        endReason: null,
      };

      console.log(`[MagicBlock] ER setup complete for room ${room.id}. Session: ${sessionPda}. Cards: ${room.erCardRegistry.size}. Txs: ${setupTxs.length}`);

    } catch (err) {
      console.warn(`[MagicBlock] ER setup failed for room ${room.id}, falling back to engine-only:`, err);
      room.erEnabled = false;
      room.erLifecycleStatus = 'failed';
      room.engine?.setExternalAuthority(false);
    }
  }

  public async registerAndDelegateReplacementCard(room: Room, owner: string, card: EngineCard): Promise<void> {
    if (!room.erEnabled || !room.erSessionPda) return;
    if (room.erCardRegistry.has(`${owner}:${card.id}`)) return;
    throw new Error(
      `ER replacement card was not pre-registered for ${owner}:${card.id}. ` +
      `Increase CORA_BATTLE_PRE_REGISTER_CARD_LIMIT or deploy lazy registration support.`,
    );
  }

  public async applyErCardEffect(
    room: Room,
    params: { owner: string; cardId: string; finalValue: number; scoreDelta: number },
  ): Promise<BattleSessionState | null> {
    if (!room.erEnabled || !room.erSessionPda) return null;

    const registeredCard = room.erCardRegistry.get(`${params.owner}:${params.cardId}`);
    if (!registeredCard) {
      throw new Error(`ER card registry missing ${params.owner}:${params.cardId}`);
    }
    if (registeredCard.isConsumed) {
      throw new Error(`ER card already consumed ${params.owner}:${params.cardId}`);
    }

    const finalValue = Math.min(params.finalValue, registeredCard.maxValue);
    const scoreDelta = Math.min(params.scoreDelta, finalValue);
    if (finalValue !== params.finalValue || scoreDelta !== params.scoreDelta) {
      console.warn(
        `[MagicBlock] Capping ER card effect for room ${room.id}: requested finalValue=${params.finalValue}, ` +
        `scoreDelta=${params.scoreDelta}, registeredMax=${registeredCard.maxValue}.`,
      );
    }

    await magicBlockService.applyCardEffect({
      roomId: room.id,
      sessionPda: room.erSessionPda,
      cardPda: registeredCard.cardPda,
      finalValue,
      scoreDelta,
      serverKeypair: getServerKeypair(),
    });
    registeredCard.isConsumed = true;

    return this.syncErState(room);
  }

  public async syncErState(room: Room): Promise<BattleSessionState | null> {
    if (!room.erEnabled || !room.erSessionPda || !room.engine) return null;

    const erState = await magicBlockService.getSessionState(room.erSessionPda);
    room.engine.applyAuthoritativeState(erState);
    if (room.erProofMeta) {
      room.erProofMeta.status = erState.status;
      room.erProofMeta.winner = erState.winner;
      room.erProofMeta.endReason = erState.endReason;
    }
    return erState;
  }

  public async resolveRoundDeadline(room: Room): Promise<void> {
    if (!room.erEnabled || !room.erSessionPda || !room.engine) return;

    const keypair = getServerKeypair();
    const playerAConnected = Boolean(room.playerA && room.clients.get(room.playerA)?.ws);
    const playerBConnected = Boolean(room.playerB && room.clients.get(room.playerB)?.ws);

    if (playerAConnected && playerBConnected) {
      await magicBlockService.resolveRoundByState({
        roomId: room.id,
        sessionPda: room.erSessionPda,
        serverKeypair: keypair,
      });
    } else if (!playerAConnected && !playerBConnected) {
      await magicBlockService.cancelSession({
        roomId: room.id,
        sessionPda: room.erSessionPda,
        reason: END_REASON_BOTH_PLAYERS_TIMEOUT,
        serverKeypair: keypair,
      });
    } else {
      const timedOutPlayer = playerAConnected ? room.playerB : room.playerA;
      if (!timedOutPlayer) return;
      await magicBlockService.timeoutPlayerForRound({
        roomId: room.id,
        sessionPda: room.erSessionPda,
        timedOutPlayer,
        serverKeypair: keypair,
      });
    }

    const erState = await this.syncErState(room);
    if (erState) {
      await this.finalizeTerminalErSession(room, erState);
    }
  }

  public async cancelErSession(room: Room, reason: number = END_REASON_SERVER_CANCELLED): Promise<void> {
    if (!room.erEnabled || !room.erSessionPda) return;

    await magicBlockService.cancelSession({
      roomId: room.id,
      sessionPda: room.erSessionPda,
      reason,
      serverKeypair: getServerKeypair(),
    });
    const erState = await this.syncErState(room);
    if (erState) {
      await this.finalizeTerminalErSession(room, erState);
    }
  }

  public async handleErFatalError(room: Room, context: string, error: unknown): Promise<void> {
    console.error(`[MagicBlock] Fatal ER failure in room ${room.id} during ${context}:`, error);

    if (
      room.erLifecycleStatus === 'delegating' ||
      room.erLifecycleStatus === 'active' ||
      room.erLifecycleStatus === 'committing'
    ) {
      console.warn(
        `[MagicBlock] Skipping cancelSession for delegated ER room ${room.id}; ` +
        `falling back to local server_error finalization because cancelSession is not compatible with delegated ownership.`,
      );
      this.forceLocalErFailure(room);
      return;
    }

    try {
      await this.cancelErSession(room);
      return;
    } catch (cancelError) {
      console.error(`[MagicBlock] ER cancel failed for room ${room.id}; forcing local server_error fallback:`, cancelError);
    }

    this.forceLocalErFailure(room);
  }

  public async finalizeTerminalErSession(room: Room, state?: BattleSessionState | null): Promise<boolean> {
    if (!room.erEnabled || !room.erSessionPda || !room.engine) return false;
    if (room.erLifecycleStatus === 'committing' || room.erLifecycleStatus === 'finished') return true;

    const erState = state ?? await this.syncErState(room);
    if (!erState || (erState.status !== 'Finished' && erState.status !== 'Cancelled')) return false;

    room.erLifecycleStatus = 'committing';
    room.status = 'settling';
    this.manager.network.broadcastGameState(room);

    const keypair = getServerKeypair();
    const terminalTxs: string[] = [];

    for (const card of room.erCardRegistry.values()) {
      if (!card.isDelegated) continue;
      terminalTxs.push(await magicBlockService.commitRegisteredCard({
        roomId: room.id,
        sessionPda: room.erSessionPda,
        cardPda: card.cardPda,
        serverKeypair: keypair,
      }));
    }

    terminalTxs.push(await magicBlockService.commitBattleSession({
      roomId: room.id,
      sessionPda: room.erSessionPda,
      serverKeypair: keypair,
    }));

    for (const card of room.erCardRegistry.values()) {
      if (!card.isDelegated) continue;
      terminalTxs.push(await magicBlockService.undelegateRegisteredCard({
        roomId: room.id,
        sessionPda: room.erSessionPda,
        cardPda: card.cardPda,
        serverKeypair: keypair,
      }));
      card.isDelegated = false;
    }

    terminalTxs.push(await magicBlockService.undelegateBattleSession({
      roomId: room.id,
      sessionPda: room.erSessionPda,
      serverKeypair: keypair,
    }));

    const finalState = await magicBlockService.getSessionState(room.erSessionPda);
    room.engine.applyAuthoritativeState(finalState);
    room.erLifecycleStatus = 'finished';
    if (room.erProofMeta) {
      room.erProofMeta.terminalTxSignatures.push(...terminalTxs);
      room.erProofMeta.status = finalState.status;
      room.erProofMeta.winner = finalState.winner;
      room.erProofMeta.endReason = finalState.endReason;
    }

    this.dispatchErMatchResult(room, finalState);
    room.status = 'finished';
    this.manager.network.broadcastGameState(room);

    setTimeout(() => {
      this.manager.lifecycle.destroyRoom(room.id);
    }, 15_000);

    return true;
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
      .catch(err => {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('TimeoutNotReached')) {
          console.warn(
            `[RoomBlockchain] Refund for ${reason} is timeout-gated on-chain and cannot be executed yet. ` +
            `Match UI/result has been finalized locally.`,
          );
          return;
        }
        console.error(`[RoomBlockchain] Refund failed for ${reason}:`, err);
      });
  }

  private dispatchErMatchResult(room: Room, finalState: BattleSessionState): void {
    const engine = room.engine;
    if (!engine) return;

    const finalScores = {
      [finalState.playerA]: finalState.gameScoreA,
      [finalState.playerB]: finalState.gameScoreB,
    };
    const finalHealth = {
      [finalState.playerA]: finalState.healthA,
      [finalState.playerB]: finalState.healthB,
    };
    const finalRoundsWon = {
      [finalState.playerA]: finalState.scoreA,
      [finalState.playerB]: finalState.scoreB,
    };
    const finalCorrectAnswers = engine.getCorrectAnswers();
    const verdicts = engine.getAntiCheatVerdicts();
    const antiCheatWarning = Object.values(verdicts).some(
      verdict => verdict.verdict === 'suspicious' || verdict.verdict === 'rejected',
    );
    const erProof = this.buildErProofPayload(room);

    if (finalState.status === 'Finished' && finalState.winner) {
      this.settleMatch(room, finalState.winner);
      this.manager.network.broadcastToRoom(room, {
        type: 'matchResult',
        payload: {
          winnerAddress: finalState.winner,
          reason: finalState.endReason === END_REASON_SINGLE_PLAYER_TIMEOUT ? 'time_up' : 'hp_zero',
          finalScores,
          finalHealth,
          finalRoundsWon,
          finalCorrectAnswers,
          antiCheatWarning,
          erProof,
        } satisfies MatchResult,
      });
      return;
    }

    const refundReason = finalState.endReason === END_REASON_SERVER_CANCELLED ? 'server_error' : 'draw';
    this.refundMatch(room, refundReason);
    this.manager.network.broadcastToRoom(room, {
      type: 'matchResult',
      payload: {
        winnerAddress: null,
        reason: refundReason === 'server_error' ? 'server_error' : 'draw',
        finalScores,
        finalHealth,
        finalRoundsWon,
        finalCorrectAnswers,
        antiCheatWarning,
        erProof,
      } satisfies MatchResult,
    });
  }

  private buildErProofPayload(room: Room): MatchResult['erProof'] {
    if (!room.erProofMeta) return undefined;

    return {
      erSessionPda: room.erProofMeta.sessionPda,
      explorerUrl: `https://explorer.solana.com/address/${room.erProofMeta.sessionPda}?cluster=devnet`,
      erEnabled: room.erEnabled,
      status: room.erProofMeta.status,
      winner: room.erProofMeta.winner,
      endReason: room.erProofMeta.endReason,
      setupTxSignatures: room.erProofMeta.setupTxSignatures,
      terminalTxSignatures: room.erProofMeta.terminalTxSignatures,
    };
  }

  private forceLocalErFailure(room: Room): void {
    if (room.status === 'finished') return;

    room.erEnabled = false;
    room.erLifecycleStatus = 'failed';
    if (room.erProofMeta) {
      room.erProofMeta.status = 'Cancelled';
      room.erProofMeta.endReason = END_REASON_SERVER_CANCELLED;
    }

    const engine = room.engine;
    const result: MatchResult = {
      winnerAddress: null,
      reason: 'server_error',
      finalScores: engine?.getScores() ?? {},
      finalHealth: engine?.getHealth() ?? {},
      finalRoundsWon: engine?.getRoundsWon() ?? {},
      finalCorrectAnswers: engine?.getCorrectAnswers() ?? {},
      erProof: this.buildErProofPayload(room),
    };

    engine?.setExternalAuthority(false);
    this.manager.lifecycle.clearAllOpenedCards(room);
    engine?.stop();

    room.status = 'finished';
    this.manager.network.broadcastToRoom(room, {
      type: 'matchResult',
      payload: result,
    });
    this.manager.network.broadcastGameState(room);

    setTimeout(() => {
      this.manager.lifecycle.destroyRoom(room.id);
    }, 15_000);
  }
}
