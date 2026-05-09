import type { WsMessage, MatchResult } from '@shared/websocket';
import type { Room, RoomSocket } from './types';
import type { RoomManager } from '../RoomManager';

export class Lifecycle {
  private DEPOSIT_TIMEOUT_MS = 30_000;

  constructor(private manager: RoomManager) {}

  public createPrivateRoom(playerAPubkey: string, tokenMint: string, wagerAmount: bigint): string {
    const roomId = `private-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const room = this.manager.store.createRoom(roomId);
    
    room.status = 'depositing';
    room.playerMeta.set(playerAPubkey, { hasDeposited: false, characterId: 'einstein' });
    room.roomType = 'private';
    room.playerA = playerAPubkey;
    room.tokenMint = tokenMint;
    room.wagerAmount = wagerAmount;

    console.log(`[Private] Room ${roomId} created for Player A: ${playerAPubkey}`);
    this.armDepositTimeout(room, playerAPubkey);

    this.manager.blockchain.fetchWagerUsd(room);

    return roomId;
  }

  public joinPrivateRoom(playerBPubkey: string, roomId: string): 'ok' | 'not_found' | 'full' | 'cancelled' {
    const room = this.manager.store.getRoom(roomId);
    if (!room || room.roomType !== 'private') return 'not_found';
    if (room.status !== 'depositing') return 'cancelled';
    if (room.playerB !== null) return 'full';
    if (room.playerA === playerBPubkey) return 'full';

    room.playerB = playerBPubkey;
    room.playerMeta.set(playerBPubkey, { hasDeposited: false, characterId: 'einstein' });
    console.log(`[Private] Player B ${playerBPubkey} joined room ${roomId}`);
    return 'ok';
  }

  public joinRoom(roomId: string, address: string, ws: RoomSocket, characterId: string = 'einstein') {
    const room = this.manager.store.getRoom(roomId);
    if (!room) {
      console.warn(`Room ${roomId} not found for join.`);
      ws.close(1008, 'Room not found or already finished');
      return;
    }

    if (room.status === 'finished') {
      console.warn(`Room ${roomId} already finished for join.`);
      ws.close(1008, 'Room already finished');
      return;
    }

    const client = room.clients.get(address);

    if (client) {
      console.log(`Player ${address} reconnected to room ${roomId}`);
      const previousWs = client.ws;
      client.ws = ws;
      client.lastSeenAt = Date.now();
      if (previousWs && previousWs !== ws) {
        try {
          previousWs.close(1000, 'Replaced by newer connection');
        } catch (e) {
          console.warn(`Failed to close previous socket for ${address} in room ${roomId}:`, e);
        }
      }
      const meta = room.playerMeta.get(address);
      if (meta) meta.characterId = characterId;
    } else {
      if (room.clients.size >= 2) {
        console.warn(`Room ${roomId} is full.`);
        ws.close(1008, 'Room is full');
        return;
      }

      console.log(`Player ${address} joined room ${roomId} as ${characterId}`);
      room.clients.set(address, {
        ws,
        lastSeenAt: Date.now(),
      });

      room.playerMeta.set(address, {
        hasDeposited: false,
        characterId,
      });
    }

    if (room.status === 'waiting' && room.clients.size === 2) {
      room.status = 'depositing';
      console.log(`Room ${roomId} has 2 players. Transitioning to depositing!`);
    }

    if (room.status === 'depositing' && room.clients.size === 2 && room.playerA && room.playerB) {
      const metaA = room.playerMeta.get(room.playerA);
      const metaB = room.playerMeta.get(room.playerB);
      const playerAConnected = Boolean(room.clients.get(room.playerA)?.ws);
      const playerBConnected = Boolean(room.clients.get(room.playerB)?.ws);
      if ((metaA?.hasDeposited ?? false) && (metaB?.hasDeposited ?? false) && playerAConnected && playerBConnected) {
        for (const t of room.depositTimeouts.values()) clearTimeout(t);
        room.depositTimeouts.clear();
        room.status = 'playing';
        console.log(`Room ${roomId}: Late join triggered game start — both already deposited!`);
        this.manager.engine.initializeEngine(room);
        return;
      }
    }

    this.manager.network.broadcastGameState(room);
    this.manager.network.broadcastPresence(room);
  }

  public leaveRoom(roomId: string, address: string, ws?: RoomSocket) {
    const room = this.manager.store.getRoom(roomId);
    if (!room) return;

    const client = room.clients.get(address);
    if (!client) return;
    if (!client.ws) return;

    if (ws && client.ws !== ws) {
      console.log(`Ignoring stale disconnect for player ${address} in room ${roomId}`);
      return;
    }

    client.ws = null;
    client.lastSeenAt = Date.now();

    if (room.status === 'playing') {
      console.log(`Player ${address} disconnected from active room ${roomId}. Presence updated; match remains open.`);
      this.manager.network.broadcastPresence(room);
      this.manager.network.broadcastGameState(room);
    } else if (room.status === 'depositing') {
      const metaA = room.playerA ? room.playerMeta.get(room.playerA) : null;
      const metaB = room.playerB ? room.playerMeta.get(room.playerB) : null;
      const allDeposited = (metaA?.hasDeposited ?? false) && (metaB?.hasDeposited ?? false);

      if (allDeposited) {
        console.log(`Player ${address} disconnected from funded room ${roomId}. Presence updated; waiting for reconnect or surrender.`);
        this.manager.network.broadcastPresence(room);
        this.manager.network.broadcastGameState(room);
        return;
      }

      const opponentAddress = address === room.playerA ? room.playerB : room.playerA;
      console.log(`Player ${address} disconnected during depositing in room ${roomId}. Cancelling room immediately.`);
      this.cancelRoom(roomId, opponentAddress ?? undefined, { reason: 'disconnect', cancelledBy: address });
    }
  }

  public cancelDuringDeposit(roomId: string, cancelledBy: string): void {
    const room = this.manager.store.getRoom(roomId);
    if (!room) return;
    if (room.status !== 'depositing') return;
    if (cancelledBy !== room.playerA && cancelledBy !== room.playerB) return;

    console.log(`[Cancel] ${cancelledBy} cancelled deposit room ${roomId}.`);
    this.cancelRoom(roomId, undefined, { reason: 'player_cancelled', cancelledBy });
  }

  public handleDeposit(room: Room, address: string, signature: string) {
    console.log(`Player ${address} confirmed deposit with signature ${signature} in room ${room.id}`);

    const timer = room.depositTimeouts.get(address);
    if (timer) {
      clearTimeout(timer);
      room.depositTimeouts.delete(address);
    }

    const meta = room.playerMeta.get(address);
    if (meta) meta.hasDeposited = true;

    const isPlayerA = address === room.playerA;

    if (isPlayerA && !room.playerBUnlocked && room.playerB) {
      room.playerBUnlocked = true;
      const playerBMeta = room.playerMeta.get(room.playerB);
      const playerBAlreadyDeposited = playerBMeta?.hasDeposited ?? false;

      if (!playerBAlreadyDeposited) {
        const playerBClient = room.clients.get(room.playerB);
        this.manager.network.safeSend(playerBClient?.ws, {
          type: 'depositUnlocked',
          payload: { roomId: room.id },
        } satisfies WsMessage);
        this.armDepositTimeout(room, room.playerB);
      }
      console.log(`Room ${room.id}: Player A deposited. Player B unlocked.`);
    }

    if (!room.playerA || !room.playerB) return;
    const metaA = room.playerMeta.get(room.playerA);
    const metaB = room.playerMeta.get(room.playerB);
    const allDeposited = (metaA?.hasDeposited ?? false) && (metaB?.hasDeposited ?? false);

    if (allDeposited && room.status === 'depositing') {
      for (const t of room.depositTimeouts.values()) clearTimeout(t);
      room.depositTimeouts.clear();

      const playerAConnected = Boolean(room.clients.get(room.playerA)?.ws);
      const playerBConnected = Boolean(room.clients.get(room.playerB)?.ws);

      if (!playerAConnected || !playerBConnected) {
        console.log(`Room ${room.id}: Both deposited but not all sockets are connected. Waiting for reconnect.`);
        this.manager.network.broadcastGameState(room);
        this.manager.network.broadcastPresence(room);
        return;
      }

      room.status = 'playing';
      console.log(`Room ${room.id} both players deposited. Initializing game engine!`);
      this.manager.engine.initializeEngine(room);
    }
  }

  public armDepositTimeout(room: Room, address: string): void {
    const existing = room.depositTimeouts.get(address);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      console.log(`[ShotClock] Player ${address} timed out in room ${room.id}. Cancelling.`);
      const opponentAddress = address === room.playerA ? room.playerB : room.playerA;
      this.cancelRoom(room.id, opponentAddress ?? undefined, { reason: 'deposit_timeout', cancelledBy: address });
    }, this.DEPOSIT_TIMEOUT_MS);

    room.depositTimeouts.set(address, timer);
  }

  public cancelRoom(
    roomId: string,
    innocentAddress?: string,
    options?: { reason?: 'player_cancelled' | 'deposit_timeout' | 'disconnect'; cancelledBy?: string },
  ): void {
    const room = this.manager.store.getRoom(roomId);
    if (!room) return;
    const shouldRequeueInnocent = room.status !== 'depositing';
    const reason = options?.reason ?? 'deposit_timeout';

    console.log(`[Cancel] Room ${roomId} cancelled. Innocent: ${innocentAddress ?? 'none'}`);

    for (const timer of room.depositTimeouts.values()) clearTimeout(timer);
    room.depositTimeouts.clear();

    this.manager.network.broadcastToRoom(room, {
      type: 'roomCancelled',
      payload: {
        cancelledBy: options?.cancelledBy ?? null,
        reason,
      },
    });

    if (innocentAddress) {
      const client = room.clients.get(innocentAddress);
      const innocentWs = client?.ws;

      if (innocentWs) {
        this.manager.network.safeSend(innocentWs, { type: 'opponentFailedDeposit', payload: {} } satisfies WsMessage);
        if (shouldRequeueInnocent) {
          this.manager.queue.requeueInnocent(innocentAddress, innocentWs);
        } else {
          console.log(`[Cancel] Room ${roomId} ended during depositing. Skipping re-queue for ${innocentAddress}.`);
        }
      } else {
        console.log(`[Cancel] ${innocentAddress} already disconnected — skipping re-queue.`);
      }
    }

    this.destroyRoom(roomId);
  }

  public destroyRoom(roomId: string): void {
    const room = this.manager.store.getRoom(roomId);
    if (!room) return;

    console.log(`[RoomLifecycle] Destroying room ${roomId}`);

    for (const timer of room.depositTimeouts.values()) clearTimeout(timer);
    room.depositTimeouts.clear();

    this.clearAllOpenedCards(room);

    if (room.engine) {
      room.engine.stop();
    }

    this.manager.store.deleteRoom(roomId);
  }

  public surrender(roomId: string, surrenderedAddress: string): void {
    const room = this.manager.store.getRoom(roomId);
    if (!room) return;
    if (room.status !== 'playing' && room.status !== 'depositing') return;
    if (surrenderedAddress !== room.playerA && surrenderedAddress !== room.playerB) return;

    if (room.erEnabled) {
      const client = room.clients.get(surrenderedAddress);
      this.manager.network.safeSend(client?.ws, {
        type: 'surrenderRejected',
        payload: {
          message: 'Surrender is disabled for MagicBlock-authoritative matches in this release.',
        },
      } satisfies WsMessage);
      return;
    }

    const winnerAddress = surrenderedAddress === room.playerA ? room.playerB : room.playerA;
    if (!winnerAddress) return;
    const metaA = room.playerA ? room.playerMeta.get(room.playerA) : null;
    const metaB = room.playerB ? room.playerMeta.get(room.playerB) : null;
    const allDeposited = (metaA?.hasDeposited ?? false) && (metaB?.hasDeposited ?? false);
    if (!allDeposited) {
      console.log(`[Surrender] Ignoring surrender in room ${roomId}; both deposits are not confirmed.`);
      return;
    }

    console.log(`[Surrender] ${surrenderedAddress} surrendered room ${roomId}. Winner: ${winnerAddress}`);

    for (const timer of room.depositTimeouts.values()) clearTimeout(timer);
    room.depositTimeouts.clear();
    this.clearAllOpenedCards(room);

    if (room.engine) {
      room.engine.surrender(surrenderedAddress);
      return;
    }

    room.status = 'settling';
    this.manager.network.broadcastGameState(room);
    this.manager.blockchain.settleMatch(room, winnerAddress);

    const result: MatchResult = {
      winnerAddress,
      reason: 'surrender',
      surrenderedAddress,
      finalScores: {},
      finalHealth: {},
      finalRoundsWon: {},
      finalCorrectAnswers: {},
    };

    this.manager.network.broadcastToRoom(room, {
      type: 'matchResult',
      payload: result,
    });
    room.status = 'finished';
    this.manager.network.broadcastGameState(room);
    setTimeout(() => {
      this.destroyRoom(roomId);
    }, 15_000);
  }

  public clearOpenedCard(room: Room, address: string) {
    const opened = room.openedCards.get(address);
    if (!opened) return;

    if (opened.countdownInterval) clearInterval(opened.countdownInterval);
    if (opened.timeoutHandle) clearTimeout(opened.timeoutHandle);
    room.openedCards.delete(address);
  }

  public clearAllOpenedCards(room: Room) {
    for (const address of room.openedCards.keys()) {
      this.clearOpenedCard(room, address);
    }
  }
}
