import type { WsMessage } from '@shared/websocket';
import type { RoomManager } from '../RoomManager';
import type { RoomSocket } from './types';

interface QueueItem {
  address: string;
  ws?: RoomSocket;
  resolve: (roomId: string) => void;
  enqueuedAt: number;
  ttlHandle?: ReturnType<typeof setTimeout>;
}

export class Queue {
  private queue: QueueItem[] = [];

  constructor(private manager: RoomManager) {}

  public findActiveRoomForAddress(address: string) {
    return this.manager.store.getAllRooms().find((room) => (
      (room.playerA === address || room.playerB === address) &&
      room.status !== 'finished'
    ));
  }

  public async queueMatch(address: string, signal?: AbortSignal): Promise<string> {
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
      this.printQueueState('WAITING', `${this.shortAddr(address)} added to queue`);
    });
  }

  public requeueInnocent(address: string, ws: RoomSocket) {
    const queueItem: QueueItem = {
      address,
      ws,
      resolve: (newRoomId: string) => {
        this.manager.network.safeSend(ws, {
          type: 'matchFound',
          payload: { roomId: newRoomId, role: 'playerA', opponentAddress: '' },
        } satisfies WsMessage);
      },
      enqueuedAt: Date.now(),
    };
    this.queue.unshift(queueItem);
    this.printQueueState('REQUEUED', `${this.shortAddr(address)} returned to queue`);
  }

  private bindAbort(signal: AbortSignal | undefined, queueItem: QueueItem, address: string): void {
    if (!signal) return;
    signal.addEventListener('abort', () => {
      if (queueItem.ttlHandle) clearTimeout(queueItem.ttlHandle);
      if (this.removeQueueItem(queueItem)) {
        this.printQueueState('ABORTED', `${this.shortAddr(address)} left matchmaking`);
      }
    }, { once: true });
  }

  private removeQueueItem(queueItem: QueueItem): boolean {
    const index = this.queue.indexOf(queueItem);
    if (index === -1) return false;
    this.queue.splice(index, 1);
    return true;
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
}
