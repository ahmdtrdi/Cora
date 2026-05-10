import type { QueueStatusData, WsMessage } from '@shared/websocket';
import type { RoomManager } from '../RoomManager';
import type { RoomSocket } from './types';
import type { Room } from './types';

interface QueueItem {
  address: string;
  ws?: RoomSocket;
  /** The /queue WebSocket (separate from room WS) — used for queue status events */
  queueWs?: RoomSocket;
  resolve: (roomId: string) => void;
  enqueuedAt: number;
  ttlHandle?: ReturnType<typeof setTimeout>;
}

export class Queue {
  private queue: QueueItem[] = [];

  constructor(private manager: RoomManager) {}

  public findActiveRoomForAddress(address: string) {
    const activeRoom = this.manager.store.findRoomByPlayer(address);

    if (activeRoom && this.isZombieDepositRoom(activeRoom)) {
      console.warn(`[Queue] Ignoring zombie deposit room ${activeRoom.id} for ${this.shortAddr(address)}.`);
      this.manager.lifecycle.destroyRoom(activeRoom.id);
      return undefined;
    }

    return activeRoom;
  }

  public releaseUnfundedPublicDepositRoom(address: string): void {
    const activeRoom = this.manager.store.findRoomByPlayer(address);
    if (!activeRoom || activeRoom.roomType !== 'public' || activeRoom.status !== 'depositing') return;

    const playerMeta = activeRoom.playerMeta.get(address);
    const hasDeposited = playerMeta?.hasDeposited ?? false;
    if (hasDeposited) return;

    const opponentAddress = address === activeRoom.playerA ? activeRoom.playerB : activeRoom.playerA;
    console.warn(`[Queue] Releasing unfunded public deposit room ${activeRoom.id} for ${this.shortAddr(address)} before queue entry.`);
    this.manager.lifecycle.cancelRoom(activeRoom.id, opponentAddress ?? undefined, {
      reason: 'player_cancelled',
      cancelledBy: address,
    });
  }

  public async queueMatch(address: string, signal?: AbortSignal): Promise<string> {
    this.releaseUnfundedPublicDepositRoom(address);

    const activeRoom = this.findActiveRoomForAddress(address);
    if (activeRoom) {
      this.printQueueState('RECONNECT', `${this.shortAddr(address)} already in room ${activeRoom.id}`);
      return activeRoom.id;
    }

    const existing = this.queue.find((item) => item.address === address);
    if (existing) {
      this.printQueueState('REQUEUE', `${this.shortAddr(address)} already waiting; chaining request`);
      return new Promise<string>((resolve) => {
        const originalResolve = existing.resolve;
        existing.resolve = (roomId: string) => {
          originalResolve(roomId);
          resolve(roomId);
        };
        this.bindAbort(signal, existing, address);
      });
    }

    const opponentIndex = this.queue.findIndex((item) => item.address !== address);
    if (opponentIndex !== -1) {
      const playerAEntry = this.queue.splice(opponentIndex, 1)[0];
      if (playerAEntry.ttlHandle) clearTimeout(playerAEntry.ttlHandle);

      const roomId = `room-${Date.now()}`;
      const room = this.manager.store.createRoom(roomId);
      room.playerA = playerAEntry.address;
      room.playerB = address;
      room.status = 'depositing';
      this.manager.store.trackPlayer(playerAEntry.address, roomId);
      this.manager.store.trackPlayer(address, roomId);

      this.manager.lifecycle.armDepositTimeout(room, playerAEntry.address);
      this.printQueueState('MATCH FOUND', `${this.shortAddr(playerAEntry.address)} vs ${this.shortAddr(address)} -> ${roomId}`);

      playerAEntry.resolve(roomId);
      return roomId;
    }

    return new Promise((resolve) => {
      const queueItem: QueueItem = {
        address,
        resolve,
        enqueuedAt: Date.now(),
      };

      queueItem.ttlHandle = setTimeout(() => {
        this.removeQueueItem(queueItem);
        this.printQueueState('TTL EXPIRED', `${this.shortAddr(address)} removed after 5m timeout`);
      }, 300_000);

      this.queue.push(queueItem);
      this.bindAbort(signal, queueItem, address);
      this.broadcastQueuePositions();
      this.printQueueState('WAITING', `${this.shortAddr(address)} added to queue`);
    });
  }

  /**
   * WebSocket-based queue entry. Instead of hanging an HTTP request,
   * this pushes real-time events (queueJoined, queueStatus, matchFound)
   * over the provided /queue WebSocket.
   */
  public queueMatchWs(address: string, queueWs: RoomSocket, signal: AbortSignal): void {
    this.releaseUnfundedPublicDepositRoom(address);

    // Check for active room (reconnect)
    const activeRoom = this.findActiveRoomForAddress(address);
    if (activeRoom) {
      const role = activeRoom.playerA === address ? 'playerA' : 'playerB';
      this.manager.network.safeSend(queueWs, {
        type: 'matchFound',
        payload: { roomId: activeRoom.id, role, opponentAddress: '' },
      } satisfies WsMessage);
      this.printQueueState('RECONNECT (WS)', `${this.shortAddr(address)} already in room ${activeRoom.id}`);
      return;
    }

    // Already queued — attach WS to existing item
    const existing = this.queue.find((item) => item.address === address);
    if (existing) {
      existing.queueWs = queueWs;
      this.sendQueueStatus(existing, 'queueJoined');
      this.bindAbort(signal, existing, address);
      this.printQueueState('REATTACH (WS)', `${this.shortAddr(address)} WS attached to existing queue item`);
      return;
    }

    // Try instant match
    const opponentIndex = this.queue.findIndex((item) => item.address !== address);
    if (opponentIndex !== -1) {
      const playerAEntry = this.queue.splice(opponentIndex, 1)[0];
      if (playerAEntry.ttlHandle) clearTimeout(playerAEntry.ttlHandle);

      const roomId = `room-${Date.now()}`;
      const room = this.manager.store.createRoom(roomId);
      room.playerA = playerAEntry.address;
      room.playerB = address;
      room.status = 'depositing';
      this.manager.store.trackPlayer(playerAEntry.address, roomId);
      this.manager.store.trackPlayer(address, roomId);

      this.manager.lifecycle.armDepositTimeout(room, playerAEntry.address);
      this.printQueueState('MATCH FOUND (WS)', `${this.shortAddr(playerAEntry.address)} vs ${this.shortAddr(address)} -> ${roomId}`);

      // Notify Player A (opponent) via their queue WS if available
      if (playerAEntry.queueWs) {
        this.manager.network.safeSend(playerAEntry.queueWs, {
          type: 'matchFound',
          payload: { roomId, role: 'playerA', opponentAddress: address },
        } satisfies WsMessage);
      }
      playerAEntry.resolve(roomId);

      // Notify current player (Player B) via their queue WS
      this.manager.network.safeSend(queueWs, {
        type: 'matchFound',
        payload: { roomId, role: 'playerB', opponentAddress: playerAEntry.address },
      } satisfies WsMessage);

      this.broadcastQueuePositions();
      return;
    }

    // No opponent — add to queue and wait
    const queueItem: QueueItem = {
      address,
      queueWs,
      resolve: (roomId: string) => {
        // When matched via the HTTP path, also notify the queueWs.
        if (queueItem.queueWs) {
          this.manager.network.safeSend(queueItem.queueWs, {
            type: 'matchFound',
            payload: { roomId, role: 'playerA', opponentAddress: '' },
          } satisfies WsMessage);
        }
      },
      enqueuedAt: Date.now(),
    };

    queueItem.ttlHandle = setTimeout(() => {
      this.removeQueueItem(queueItem);
      if (queueItem.queueWs) {
        this.manager.network.safeSend(queueItem.queueWs, {
          type: 'queueLeft',
          payload: { reason: 'ttl_expired' },
        } satisfies WsMessage);
      }
      this.broadcastQueuePositions();
      this.printQueueState('TTL EXPIRED (WS)', `${this.shortAddr(address)} removed after 5m timeout`);
    }, 300_000);

    this.queue.push(queueItem);
    this.bindAbort(signal, queueItem, address);
    this.sendQueueStatus(queueItem, 'queueJoined');
    this.broadcastQueuePositions();
    this.printQueueState('WAITING (WS)', `${this.shortAddr(address)} added to queue`);
  }

  public isQueued(address: string): boolean {
    return this.queue.some((item) => item.address === address);
  }

  private bindAbort(signal: AbortSignal | undefined, queueItem: QueueItem, address: string): void {
    if (!signal) return;
    signal.addEventListener('abort', () => {
      if (queueItem.ttlHandle) clearTimeout(queueItem.ttlHandle);
      if (this.removeQueueItem(queueItem)) {
        queueItem.resolve('__aborted__');
        this.printQueueState('ABORTED', `${this.shortAddr(address)} left matchmaking`);
      }
    }, { once: true });
  }

  private removeQueueItem(queueItem: QueueItem): boolean {
    const index = this.queue.indexOf(queueItem);
    if (index === -1) return false;
    this.queue.splice(index, 1);
    this.broadcastQueuePositions();
    return true;
  }

  public isZombieDepositRoom(room: Room): boolean {
    if (room.status !== 'depositing') return false;

    const hasAnyDepositTimer = room.depositTimeouts.size > 0;
    const hasAnyLiveSocket = Array.from(room.clients.values()).some((client) => Boolean(client.ws));
    const hasAnyDeposit = [room.playerA, room.playerB].some((address) => {
      if (!address) return false;
      return room.playerMeta.get(address)?.hasDeposited ?? false;
    });

    return !hasAnyDepositTimer && !hasAnyLiveSocket && !hasAnyDeposit;
  }

  private shortAddr(address: string): string {
    if (address.length <= 12) return address;
    return `${address.slice(0, 4)}..${address.slice(-4)}`;
  }

  private printQueueState(event: string, detail = ''): void {
    const waiting = this.queue.map((item) => this.shortAddr(item.address)).join(', ') || 'empty';
    const activeRooms = this.manager.store.getAllRooms().filter((room) => room.status !== 'finished').length;
    console.log(`[Queue] ${event}${detail ? ` - ${detail}` : ''} | waiting=${waiting} | activeRooms=${activeRooms}`);
  }

  // ─── Queue Position Broadcasting ──────────────────────────────

  /** Send queue status to a single player */
  private sendQueueStatus(item: QueueItem, type: 'queueJoined' | 'queueStatus' = 'queueStatus'): void {
    if (!item.queueWs) return;
    const position = this.queue.indexOf(item) + 1;
    const payload: QueueStatusData = {
      position,
      estimatedWaitMs: null,
      queueDepth: this.queue.length,
    };
    this.manager.network.safeSend(item.queueWs, { type, payload } satisfies WsMessage);
  }

  /** Broadcast updated positions to ALL waiting players after any queue mutation */
  private broadcastQueuePositions(): void {
    for (const item of this.queue) {
      this.sendQueueStatus(item);
    }
  }

  /** Expose queue depth for health/admin endpoints */
  public getQueueDepth(): number {
    return this.queue.length;
  }
}
