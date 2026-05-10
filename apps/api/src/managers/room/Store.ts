import { deriveMatchId } from '@shared/escrow';
import { isMagicBlockConfigured } from '../../services/magicblock';
import { Room } from './types';

export class Store {
  private rooms: Map<string, Room> = new Map();

  public createRoom(roomId: string): Room {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const newRoom: Room = {
      id: roomId,
      matchIdBytes: deriveMatchId(roomId),
      clients: new Map(),
      status: 'waiting',
      playerMeta: new Map(),
      engine: null,
      openedCards: new Map(),
      roomType: 'public',
      playerA: null,
      playerB: null,
      playerBUnlocked: false,
      tokenMint: null,
      wagerAmount: null,
      depositTimeouts: new Map(),
      erSessionPda: null,
      wagerUsdValue: null,
      blinkJoinDeadline: null,
      erEnabled: isMagicBlockConfigured(),
      erLifecycleStatus: 'none',
      erCardRegistry: new Map(),
      erProofMeta: null,
    };
    this.rooms.set(roomId, newRoom);
    return newRoom;
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  public getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  public deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }
}
