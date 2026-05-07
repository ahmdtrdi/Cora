import type { ServerWebSocket } from 'bun';
import type { WsMessage } from '@shared/websocket';
import { Store } from './room/Store';
import { Network } from './room/Network';
import { Lifecycle } from './room/Lifecycle';
import { Engine } from './room/Engine';
import { Queue } from './room/Queue';
import { Blockchain } from './room/Blockchain';
import { Room } from './room/types';

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

  public createPrivateRoom(playerAPubkey: string, tokenMint: string, wagerAmount: bigint): string {
    return this.lifecycle.createPrivateRoom(playerAPubkey, tokenMint, wagerAmount);
  }

  public joinPrivateRoom(playerBPubkey: string, roomId: string): 'ok' | 'not_found' | 'full' | 'cancelled' {
    return this.lifecycle.joinPrivateRoom(playerBPubkey, roomId);
  }

  public async queueMatch(address: string, signal?: AbortSignal): Promise<string> {
    return this.queue.queueMatch(address, signal);
  }

  public joinRoom(roomId: string, address: string, ws: ServerWebSocket<unknown>, characterId: string = 'einstein') {
    this.lifecycle.joinRoom(roomId, address, ws, characterId);
  }

  public leaveRoom(roomId: string, address: string) {
    this.lifecycle.leaveRoom(roomId, address);
  }

  public handleMessage(roomId: string, address: string, message: WsMessage) {
    const room = this.store.getRoom(roomId);
    if (!room) return;

    if (message.type === 'confirmDeposit') {
      this.lifecycle.handleDeposit(room, address, message.payload?.signature);
    }

    if (message.type === 'openCard' && room.status === 'playing') {
      this.engine.handleOpenCard(room, address, message.payload?.cardId);
    }

    if (message.type === 'playCard' && room.status === 'playing') {
      this.engine.handlePlayCard(room, address, message.payload);
    }
  }
}