import type { WsMessage } from '@shared/websocket';
import { Store } from './room/Store';
import { Network } from './room/Network';
import { Lifecycle } from './room/Lifecycle';
import { Engine } from './room/Engine';
import { Queue } from './room/Queue';
import { Blockchain } from './room/Blockchain';
import type { Room, RoomSocket } from './room/types';

export class RoomManager {
  public store: Store;
  public network: Network;
  public engine: Engine;
  public lifecycle: Lifecycle;
  public queue: Queue;
  public blockchain: Blockchain;

  constructor() {
    this.store = new Store();
    this.network = new Network();
    this.engine = new Engine(this);
    this.lifecycle = new Lifecycle(this);
    this.queue = new Queue(this);
    this.blockchain = new Blockchain(this);
  }

  public getRoom(roomId: string): Room | undefined {
    return this.store.getRoom(roomId);
  }

  public createRoom(roomId: string): Room {
    return this.store.createRoom(roomId);
  }

  public createPrivateRoom(playerAPubkey: string, tokenMint: string, wagerAmount: bigint): string {
    return this.lifecycle.createPrivateRoom(playerAPubkey, tokenMint, wagerAmount);
  }

  public joinPrivateRoom(playerBPubkey: string, roomId: string): 'ok' | 'not_found' | 'full' | 'cancelled' {
    return this.lifecycle.joinPrivateRoom(playerBPubkey, roomId);
  }

  public async queueMatch(address: string, signal?: AbortSignal): Promise<string> {
    return this.queue.queueMatch(address, signal);
  }

  public joinRoom(roomId: string, address: string, ws: RoomSocket, characterId: string = 'einstein') {
    this.lifecycle.joinRoom(roomId, address, ws, characterId);
  }

  public leaveRoom(roomId: string, address: string, ws?: RoomSocket) {
    this.lifecycle.leaveRoom(roomId, address, ws);
  }

  public handleMessage(roomId: string, address: string, message: WsMessage) {
    const room = this.store.getRoom(roomId);
    if (!room) return;

    if (message.type === 'confirmDeposit') {
      const signature = readStringPayload(message.payload, 'signature');
      if (signature) this.lifecycle.handleDeposit(room, address, signature);
    }

    if (message.type === 'cancelMatch') {
      this.lifecycle.cancelDuringDeposit(roomId, address);
    }

    if (message.type === 'surrender') {
      this.lifecycle.surrender(roomId, address);
    }

    if (message.type === 'openCard' && room.status === 'playing') {
      const cardId = readStringPayload(message.payload, 'cardId');
      if (cardId) this.engine.handleOpenCard(room, address, cardId);
    }

    if (message.type === 'playCard' && room.status === 'playing') {
      this.engine.handlePlayCard(room, address, readPlayCardPayload(message.payload));
    }
  }
}

function readStringPayload(payload: unknown, key: string): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function readPlayCardPayload(payload: unknown): { cardId?: string; selectedOptionId?: string } {
  if (!payload || typeof payload !== 'object') return {};
  const record = payload as Record<string, unknown>;
  return {
    cardId: typeof record.cardId === 'string' ? record.cardId : undefined,
    selectedOptionId: typeof record.selectedOptionId === 'string' ? record.selectedOptionId : undefined,
  };
}
