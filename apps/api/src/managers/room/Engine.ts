import { GameEngine } from '@cora/game-logic';
import type { PlayCardResult } from '@cora/game-logic';
import type { MatchResult } from '@shared/websocket';
import { fetchMatchQuestions } from '../../questions';
import { Room } from './types';
import type { RoomManager } from '../RoomManager';

export class Engine {
  private CARD_ANSWER_TIMEOUT_MS = 10_000;
  private CARD_COUNTDOWN_TICK_MS = 1_000;

  constructor(private manager: RoomManager) {}

  public async initializeEngine(room: Room) {
    if (!room.playerA || !room.playerB) {
      console.error(`Room ${room.id} missing player assignments. Cannot start.`);
      return;
    }

    const addresses: [string, string] = [room.playerA, room.playerB];
    const playersInfo: [{ address: string; characterId: string }, { address: string; characterId: string }] = [
      { address: addresses[0], characterId: room.playerMeta.get(addresses[0])?.characterId || 'einstein' },
      { address: addresses[1], characterId: room.playerMeta.get(addresses[1])?.characterId || 'einstein' }
    ];
    
    // Fetch unique questions per match from Supabase (with JSON fallback)
    const questions = await fetchMatchQuestions();

    if (questions.length === 0) {
      console.error(`No questions loaded! Cannot start match in room ${room.id}.`);
      return;
    }

    const engine = new GameEngine(playersInfo, questions, { externalAuthority: room.erEnabled });
    room.engine = engine;

    // Create ER session if MagicBlock is configured
    await this.manager.blockchain.createBattleSession(room);
    if (this.manager.store.getRoom(room.id) !== room) {
      engine.stop();
      return;
    }
    room.status = 'playing';

    // Wire engine events to WebSocket broadcasts
    engine.on('timerSync', () => {
      this.manager.network.broadcastToRoom(room, {
        type: 'timerSync',
        payload: engine.getTimerState(),
      });
    });

    engine.on('phaseChange', (data) => {
      console.log(`Room ${room.id} entering EXTRA POINT phase!`);
      this.manager.network.broadcastToRoom(room, {
        type: 'phaseChange',
        payload: data.phase,
      });
      this.manager.network.broadcastGameState(room);
    });

    engine.on('roundDeadline', async (data) => {
      if (!room.erEnabled) return;
      console.log(`Room ${room.id} ER round ${data.roundNumber} deadline reached. Resolving on MagicBlock.`);
      try {
        await this.manager.blockchain.resolveRoundDeadline(room);
        this.manager.network.broadcastScoreUpdate(room);
        this.manager.network.broadcastGameState(room);
      } catch (e) {
        console.error(`[RoomEngineManager] ER deadline resolution failed for room ${room.id}:`, e);
        await this.manager.blockchain.handleErFatalError(room, 'round deadline resolution', e);
      }
    });

    engine.on('gameOver', (data) => {
      console.log(`Room ${room.id} game over! Winner: ${data.winnerAddress ?? 'draw'} (${data.reason})`);
      console.log('SETTLING: Outcome determined server-side, beginning payout flow...');

      room.status = 'settling';
      this.manager.network.broadcastGameState(room);

      try {
        const finalScores = engine.getScores();
        const finalHealth = engine.getHealth();
        const finalRoundsWon = engine.getRoundsWon();
        const finalCorrectAnswers = engine.getCorrectAnswers();
        const verdicts = data.antiCheatVerdicts || {};
        let isRejected = false;
        let cheaterAddress: string | null = null;
        let isSuspicious = false;

        console.log(`[Anti-Cheat] Room ${room.id} verdicts:`);
        for (const [address, verdict] of Object.entries(verdicts)) {
          console.log(` - Player ${address}: ${verdict.verdict.toUpperCase()} (Score: ${verdict.trustScore.toFixed(2)})`);
          if (verdict.verdict === 'rejected') {
            isRejected = true;
            cheaterAddress = address;
            console.warn(`[Anti-Cheat] WARNING: Player ${address} was rejected for flags:`, verdict.flags.map(f => f.signal).join(', '));
          } else if (verdict.verdict === 'suspicious') {
            isSuspicious = true;
            console.warn(`[Anti-Cheat] WARNING: Player ${address} is suspicious. Flags:`, verdict.flags.map(f => f.signal).join(', '));
          }
          console.log(`[Anti-Cheat] Stats for ${address}:`, JSON.stringify(verdict.stats));
        }

        if (isRejected && cheaterAddress) {
          console.error(`[Anti-Cheat] Match in Room ${room.id} REJECTED. Handling anti-cheat settlement.`);
          this.manager.blockchain.settleAntiCheat(room, cheaterAddress);

          const result: MatchResult = {
            winnerAddress: data.winnerAddress,
            reason: 'anti_cheat',
            finalScores,
            finalHealth,
            finalRoundsWon,
            finalCorrectAnswers,
          };

          this.manager.network.broadcastToRoom(room, {
            type: 'matchInvalidated',
            payload: result,
          });
        } else if (!data.winnerAddress || data.reason === 'draw') {
          const result: MatchResult = {
            winnerAddress: null,
            reason: 'draw',
            finalScores,
            finalHealth,
            finalRoundsWon,
            finalCorrectAnswers,
            antiCheatWarning: isSuspicious,
          };

          this.manager.blockchain.refundMatch(room, 'draw');
          this.manager.network.broadcastToRoom(room, {
            type: 'matchResult',
            payload: result,
          });
        } else {
          const result: MatchResult = {
            winnerAddress: data.winnerAddress,
            reason: data.reason,
            surrenderedAddress: data.surrenderedAddress,
            finalScores,
            finalHealth,
            finalRoundsWon,
            finalCorrectAnswers,
            antiCheatWarning: isSuspicious,
          };

          this.manager.blockchain.settleMatch(room, data.winnerAddress);
          this.manager.network.broadcastToRoom(room, {
            type: 'matchResult',
            payload: result,
          });
        }
      } catch (e) {
        console.error(`[RoomEngineManager] Error during game over processing for room ${room.id}:`, e);
        this.manager.blockchain.refundMatch(room, 'server_error');
        this.manager.network.broadcastToRoom(room, {
          type: 'matchResult',
          payload: {
            winnerAddress: null,
            reason: 'server_error',
            finalScores: engine.getScores(),
            finalHealth: engine.getHealth(),
            finalRoundsWon: engine.getRoundsWon(),
            finalCorrectAnswers: engine.getCorrectAnswers(),
          } satisfies MatchResult,
        });
      } finally {
        room.status = 'finished';
        if (room.roomType === 'private') {
          void this.manager.blinkMatches.markCompleted(room.id).catch((err) => {
            console.error(`[Blink] Failed to mark private room ${room.id} completed:`, err);
          });
        }
        console.log(`FINISHED: Room ${room.id} settlement dispatched.`);
        this.manager.network.broadcastGameState(room);
        
        // Clean up the room after 15 seconds
        setTimeout(() => {
          this.manager.lifecycle.destroyRoom(room.id);
        }, 15_000);
      }
    });

    engine.on('roundOver', (data) => {
      const roundNum = engine.getCurrentRound() - 1;
      const roundsWon = engine.getRoundsWon();
      console.log(`Room ${room.id} round ${roundNum} over. Winner: ${data.winnerAddress} (${data.reason})`);

      this.manager.lifecycle.clearAllOpenedCards(room);

      this.manager.network.broadcastToRoom(room, {
        type: 'roundOver',
        payload: {
          winnerAddress: data.winnerAddress,
          reason: data.reason,
          roundNumber: roundNum,
          roundsWon,
        }
      });
      this.manager.network.broadcastGameState(room);
    });

    engine.on('stateUpdate', () => {
      this.manager.network.broadcastGameState(room);
    });

    engine.start();
    if (room.erEnabled) {
      try {
        await this.manager.blockchain.syncErState(room);
      } catch (e) {
        console.warn(`[RoomEngineManager] Initial ER state sync failed for room ${room.id}:`, e);
      }
    }
    console.log(`Room ${room.id} game engine started. 5-minute countdown begins!`);
    this.manager.network.broadcastGameState(room);
  }

  public handleOpenCard(room: Room, address: string, cardId: string) {
    if (!room.engine || !room.engine.isActive()) return;
    if (!cardId) return;

    const existing = room.openedCards.get(address);
    if (existing) {
      console.warn(`Player ${address} already has card ${existing.cardId} open in room ${room.id}. Ignoring.`);
      return;
    }

    const playerState = room.engine.getStateForPlayer(address);
    const cardInHand = playerState.hand.find(c => c.id === cardId);
    if (!cardInHand) {
      console.warn(`Card ${cardId} not found in ${address}'s hand. Ignoring openCard.`);
      return;
    }

    const openedAt = Date.now();
    console.log(`Player ${address} opened card ${cardId} in room ${room.id}. 10s countdown started.`);

    const client = room.clients.get(address);
    this.manager.network.safeSend(client?.ws, {
      type: 'cardCountdown',
      payload: { cardId, remainingMs: this.CARD_ANSWER_TIMEOUT_MS },
    });

    const countdownInterval = setInterval(() => {
      const elapsed = Date.now() - openedAt;
      const remaining = Math.max(0, this.CARD_ANSWER_TIMEOUT_MS - elapsed);

      const c = room.clients.get(address);
      this.manager.network.safeSend(c?.ws, {
        type: 'cardCountdown',
        payload: { cardId, remainingMs: remaining },
      });
    }, this.CARD_COUNTDOWN_TICK_MS);

    const timeoutHandle = setTimeout(() => {
      void this.expireCard(room, address, cardId);
    }, this.CARD_ANSWER_TIMEOUT_MS);

    room.openedCards.set(address, {
      cardId,
      openedAt,
      countdownInterval,
      timeoutHandle,
    });
  }

  public async expireCard(room: Room, address: string, cardId: string) {
    if (!room.engine || !room.engine.isActive()) return;

    console.log(`Card ${cardId} expired for player ${address} in room ${room.id} (timeout).`);

    this.manager.lifecycle.clearOpenedCard(room, address);
    if (room.erEnabled) {
      const result = room.engine.playCardNonAuthoritative(address, cardId, '__timeout__');
      if (!result.success) return;

      try {
        // Consume slot on-chain even for timeout
        await this.manager.blockchain.consumeErSlotEmpty(room, address, cardId);
      } catch (e) {
        console.error(`[RoomEngineManager] Failed to consume ER slot after timeout in room ${room.id}:`, e);
        await this.manager.blockchain.handleErFatalError(room, 'timeout slot consumption', e);
        return;
      }
    } else {
      room.engine.playCard(address, cardId, '__timeout__');
    }

    const client = room.clients.get(address);
    this.manager.network.safeSend(client?.ws, {
      type: 'cardExpired',
      payload: { cardId },
    });

    this.manager.network.broadcastScoreUpdate(room);
  }

  public async handlePlayCard(room: Room, address: string, payload: { cardId?: string; selectedOptionId?: string }) {
    if (!room.engine || !room.engine.isActive()) return;

    const { cardId, selectedOptionId } = payload;
    if (!cardId || !selectedOptionId) return;

    const opened = room.openedCards.get(address);
    if (!opened || opened.cardId !== cardId) {
      console.warn(`Player ${address} tried to play card ${cardId} without opening it first in room ${room.id}.`);
      return;
    }

    this.manager.lifecycle.clearOpenedCard(room, address);

    console.log(`Player ${address} played card ${cardId} with answer ${selectedOptionId} in room ${room.id}`);

    let result: PlayCardResult;

    if (room.erEnabled) {
      const erResult = room.engine.playCardNonAuthoritative(address, cardId, selectedOptionId);
      result = erResult;

      if (!erResult.success) {
        console.warn(`Card play failed for ${address} in room ${room.id}`);
        return;
      }

      // === Optimistic UI: broadcast damage event BEFORE ER round-trip ===
      if (erResult.correct) {
        this.manager.network.broadcastToRoom(room, {
          type: 'damageEvent',
          payload: {
            attackerAddress: erResult.attackerAddress,
            targetAddress: erResult.targetAddress,
            damage: erResult.cardType === 'attack' ? erResult.damage : erResult.heal,
            multiplier: erResult.multiplier,
            type: erResult.cardType,
            timestamp: Date.now(),
          },
        });
      }

      // Send card result to the acting player immediately (optimistic)
      const client = room.clients.get(address);
      this.manager.network.safeSend(client?.ws, {
        type: 'playCardResult',
        payload: {
          correct: result.correct,
          damage: result.damage,
          heal: result.heal,
          multiplier: result.multiplier,
          cardType: result.cardType,
        },
      });

      this.manager.network.broadcastScoreUpdate(room);

      // === ER confirm async — non-blocking for UI ===
      try {
        if (erResult.correct) {
          const erState = await this.manager.blockchain.applyErCardEffect(room, {
            owner: address,
            cardId,
            finalValue: erResult.finalValue,
            scoreDelta: erResult.scoreDelta,
          });
          await this.manager.blockchain.finalizeTerminalErSession(room, erState);
        } else {
          // Wrong answer: consume the slot on-chain with zero effect
          await this.manager.blockchain.consumeErSlotEmpty(room, address, cardId);
        }
        this.manager.network.broadcastScoreUpdate(room);
      } catch (e) {
        console.error(`[RoomEngineManager] ER card play failed for room ${room.id}:`, e);
        await this.manager.blockchain.handleErFatalError(room, 'card play', e);
        return;
      }
    } else {
      result = room.engine.playCard(address, cardId, selectedOptionId);
      if (!result.success) {
        console.warn(`Card play failed for ${address} in room ${room.id}`);
        return;
      }

      if (result.correct) {
        this.manager.network.broadcastToRoom(room, {
          type: 'damageEvent',
          payload: {
            attackerAddress: result.attackerAddress,
            targetAddress: result.targetAddress,
            damage: result.cardType === 'attack' ? result.damage : result.heal,
            multiplier: result.multiplier,
            type: result.cardType,
            timestamp: Date.now(),
          },
        });
      }

      const client = room.clients.get(address);
      this.manager.network.safeSend(client?.ws, {
        type: 'playCardResult',
        payload: {
          correct: result.correct,
          damage: result.damage,
          heal: result.heal,
          multiplier: result.multiplier,
          cardType: result.cardType,
        },
      });

      this.manager.network.broadcastScoreUpdate(room);
    }

    setTimeout(() => {
      if (room.engine && room.engine.isActive()) {
        room.engine.resetCharacterStates();
      }
    }, 1000);
  }
}
