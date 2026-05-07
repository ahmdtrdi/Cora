import type { ServerWebSocket } from 'bun';
import type { WsMessage, MatchResult } from '@shared/websocket';
import { Room } from './types';
import type { RoomManager } from '../RoomManager';

export class Lifecycle {
  private DISCONNECT_TIMEOUT_MS = 10_000;
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

  public joinRoom(roomId: string, address: string, ws: ServerWebSocket<unknown>, characterId: string = 'einstein') {
    const room = this.manager.store.getRoom(roomId);
    if (!room) {
      console.warn(`Room ${roomId} not found for join.`);
      return;
    }

    const client = room.clients.get(address);

    if (client) {
      console.log(`Player ${address} reconnected to room ${roomId}`);
      if (client.disconnectTimeout) {
        clearTimeout(client.disconnectTimeout);
        client.disconnectTimeout = null;
      }
      client.ws = ws;
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
        disconnectTimeout: null,
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
      if ((metaA?.hasDeposited ?? false) && (metaB?.hasDeposited ?? false)) {
        for (const t of room.depositTimeouts.values()) clearTimeout(t);
        room.depositTimeouts.clear();
        room.status = 'playing';
        console.log(`Room ${roomId}: Late join triggered game start — both already deposited!`);
        this.manager.engine.initializeEngine(room);
        return;
      }
    }

    this.manager.network.broadcastGameState(room);
  }

  public leaveRoom(roomId: string, address: string) {
    const room = this.manager.store.getRoom(roomId);
    if (!room) return;

    const client = room.clients.get(address);
    if (!client) return;

    client.ws = null;

    if (room.status === 'playing') {
      console.log(`Player ${address} disconnected from room ${roomId}. Starting 10s forfeit timer.`);
      client.disconnectTimeout = setTimeout(() => {
        console.log(`Player ${address} forfeit room ${roomId} due to timeout.`);
        this.forfeitMatch(roomId, address);
      }, this.DISCONNECT_TIMEOUT_MS);
    } else if (room.status === 'depositing') {
      console.log(`Player ${address} temporarily disconnected during depositing in room ${roomId}. Waiting for reconnect or timeout.`);
    }
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
      if (room.clients.size < 2) {
        console.log(`Room ${room.id}: Both deposited but only ${room.clients.size} player(s) connected. Waiting for both.`);
        return;
      }

      for (const t of room.depositTimeouts.values()) clearTimeout(t);
      room.depositTimeouts.clear();

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
      this.cancelRoom(room.id, opponentAddress ?? undefined);
    }, this.DEPOSIT_TIMEOUT_MS);

    room.depositTimeouts.set(address, timer);
  }

  public cancelRoom(roomId: string, innocentAddress?: string): void {
    const room = this.manager.store.getRoom(roomId);
    if (!room) return;

    console.log(`[Cancel] Room ${roomId} cancelled. Innocent: ${innocentAddress ?? 'none'}`);

    for (const timer of room.depositTimeouts.values()) clearTimeout(timer);
    room.depositTimeouts.clear();

    if (innocentAddress) {
      const client = room.clients.get(innocentAddress);
      const innocentWs = client?.ws;

      if (innocentWs) {
        this.manager.network.safeSend(innocentWs, { type: 'opponentFailedDeposit', payload: {} } satisfies WsMessage);
        this.manager.queue.requeueInnocent(innocentAddress, innocentWs);
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

  private forfeitMatch(roomId: string, disconnectedAddress: string) {
    const room = this.manager.store.getRoom(roomId);
    if (!room) return;

    room.status = 'settling';
    this.manager.network.broadcastGameState(room);

    this.clearAllOpenedCards(room);

    if (room.engine) {
      room.engine.stop(disconnectedAddress);
    } else {
      const opponentAddress = Array.from(room.clients.keys()).find(a => a !== disconnectedAddress);
      if (opponentAddress) {
        const result: MatchResult = {
          winnerAddress: opponentAddress,
          reason: 'forfeit',
          finalScores: {},
          finalHealth: {},
        };
        this.manager.network.broadcastToRoom(room, {
          type: 'matchResult',
          payload: result,
        });
      }
    }

    room.status = 'finished';
    this.manager.network.broadcastGameState(room);

    this.destroyRoom(roomId);
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
