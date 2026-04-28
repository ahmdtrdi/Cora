import type { ServerWebSocket } from 'bun';
import type { GameState, WsMessage, CharacterState, GameStatus, Card } from '@shared/websocket';
import { deriveMatchId } from '@shared/escrow';
import { signSettlementAuthorization, serverPublicKey } from '../utils/settlement';

interface RoomClient {
  ws: ServerWebSocket<unknown> | null;
  disconnectTimeout: ReturnType<typeof setTimeout> | null;
}

interface ServerPlayerState {
  baseHealth: number;
  characterState: CharacterState;
  hand: Card[];
  hasDeposited: boolean;
}

export interface Room {
  id: string;
  /** 32-byte match ID derived from room ID — used for on-chain PDA derivation */
  matchIdBytes: Uint8Array;
  clients: Map<string, RoomClient>;
  status: GameStatus;
  currentRound: number;
  players: Map<string, ServerPlayerState>;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private matchmakingQueue: Array<{ address: string; resolve: (roomId: string) => void }> = [];
  private DISCONNECT_TIMEOUT_MS = 10000; // 10 seconds

  // Returns the room if it exists, otherwise creates a new one
  public createRoom(roomId: string): Room {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const newRoom: Room = {
      id: roomId,
      matchIdBytes: deriveMatchId(roomId),
      clients: new Map(),
      status: 'waiting',
      currentRound: 1,
      players: new Map()
    };
    this.rooms.set(roomId, newRoom);
    return newRoom;
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  // True FIFO matchmaking: pairs two players and returns a shared roomId
  public async queueMatch(address: string, signal?: AbortSignal): Promise<string> {
    // Check if there is another player in queue who isn't the same address
    const index = this.matchmakingQueue.findIndex((q) => q.address !== address);

    if (index !== -1) {
      // Pair found!
      const pairedPlayer = this.matchmakingQueue.splice(index, 1)[0];
      const newRoomId = `room-${Date.now()}`;
      this.createRoom(newRoomId);
      
      // Resolve for the waiting player
      pairedPlayer.resolve(newRoomId);
      // Resolve for current player
      return newRoomId;
    }

    // No pair found, enter queue
    return new Promise((resolve) => {
      const queueItem = { address, resolve };
      this.matchmakingQueue.push(queueItem);

      if (signal) {
        signal.addEventListener('abort', () => {
          const qIndex = this.matchmakingQueue.indexOf(queueItem);
          if (qIndex !== -1) {
            this.matchmakingQueue.splice(qIndex, 1);
            console.log(`Player ${address} aborted matchmaking request.`);
          }
        });
      }
    });
  }

  public joinRoom(roomId: string, address: string, ws: ServerWebSocket<unknown>) {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.warn(`Room ${roomId} not found for join.`);
      return;
    }

    const client = room.clients.get(address);

    if (client) {
      // Reconnect
      console.log(`Player ${address} reconnected to room ${roomId}`);
      if (client.disconnectTimeout) {
        clearTimeout(client.disconnectTimeout);
        client.disconnectTimeout = null;
      }
      client.ws = ws;
    } else {
      // New join
      if (room.clients.size >= 2) {
        console.warn(`Room ${roomId} is full.`);
        ws.close(1008, 'Room is full');
        return;
      }

      console.log(`Player ${address} joined room ${roomId}`);
      room.clients.set(address, {
        ws,
        disconnectTimeout: null
      });

      room.players.set(address, {
        baseHealth: 100,
        characterState: 'stay',
        hand: this.getMockHand(),
        hasDeposited: false
      });
    }

    // Check if we can start depositing
    if (room.status === 'waiting' && room.clients.size === 2) {
      room.status = 'depositing';
      console.log(`Room ${roomId} has 2 players. Transitioning to depositing!`);
    }

    this.broadcastGameState(room);
  }

  public leaveRoom(roomId: string, address: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const client = room.clients.get(address);
    if (client) {
      console.log(`Player ${address} disconnected from room ${roomId}. Starting 10s timeout.`);
      client.ws = null;
      
      client.disconnectTimeout = setTimeout(() => {
        console.log(`Player ${address} forfeit room ${roomId} due to timeout.`);
        this.forfeitMatch(roomId, address);
      }, this.DISCONNECT_TIMEOUT_MS);
    }
  }

  public handleMessage(roomId: string, address: string, message: WsMessage) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (message.type === 'confirmDeposit') {
      const { signature } = message.payload;
      console.log(`Player ${address} confirmed deposit with signature ${signature} in room ${roomId}`);
      
      const playerState = room.players.get(address);
      if (playerState) {
        playerState.hasDeposited = true;
      }

      // Check if both players have deposited
      const allDeposited = Array.from(room.players.values()).every(p => p.hasDeposited);
      if (allDeposited && room.status === 'depositing') {
        room.status = 'playing';
        console.log(`Room ${roomId} both players deposited. Starting match!`);
        this.broadcastGameState(room);
      }
    }

    if (message.type === 'playCard' && room.status === 'playing') {
      const { cardId } = message.payload;
      console.log(`Player ${address} played card ${cardId} in room ${roomId}`);
      
      // Mock game logic: player attacks opponent
      const opponentAddress = Array.from(room.players.keys()).find(a => a !== address);
      const playerState = room.players.get(address);

      if (opponentAddress && playerState) {
        const opponentState = room.players.get(opponentAddress)!;
        
        // Remove card from hand
        playerState.hand = playerState.hand.filter((c: Card) => c.id !== cardId);
        playerState.characterState = 'action';
        
        // Damage opponent
        opponentState.baseHealth = Math.max(0, opponentState.baseHealth - 20);
        
        // Broadcast new state
        this.broadcastGameState(room);

        // Reset character state after a bit
        setTimeout(() => {
          playerState.characterState = 'stay';
          this.broadcastGameState(room);
        }, 1000);

        // Check for end
        if (opponentState.baseHealth <= 0) {
          room.status = 'finished';
          this.broadcastMatchResult(room, address);
        }
      }
    }
  }

  private forfeitMatch(roomId: string, disconnectedAddress: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.status = 'finished';
    const opponentAddress = Array.from(room.clients.keys()).find(a => a !== disconnectedAddress);
    
    if (opponentAddress) {
      this.broadcastMatchResult(room, opponentAddress);
    }
    
    // Clean up room
    this.rooms.delete(roomId);
  }

  private broadcastGameState(room: Room) {
    const addresses = Array.from(room.clients.keys());
    
    for (const address of addresses) {
      const client = room.clients.get(address);
      if (client?.ws) {
        const opponentAddress = addresses.find(a => a !== address);
        
        const playerState = room.players.get(address)!;
        const opponentState = opponentAddress ? room.players.get(opponentAddress)! : null;

        const payload: GameState = {
          status: room.status,
          currentRound: room.currentRound,
          player: {
            address,
            baseHealth: playerState.baseHealth,
            characterState: playerState.characterState
          },
          opponent: opponentState ? {
            address: opponentAddress!,
            baseHealth: opponentState.baseHealth,
            characterState: opponentState.characterState
          } : {
            // Mock empty opponent if waiting
            address: 'Waiting for opponent...',
            baseHealth: 100,
            characterState: 'stay'
          },
          hand: playerState.hand
        };

        client.ws.send(JSON.stringify({
          type: 'gameStateUpdate',
          payload
        } as WsMessage<GameState>));
      }
    }
  }

  private broadcastMatchResult(room: Room, winnerAddress: string) {
    // Sign settlement authorization for on-chain verification
    const settlementSignature = signSettlementAuthorization(
      room.matchIdBytes,
      winnerAddress,
    );

    for (const client of room.clients.values()) {
      if (client.ws) {
        client.ws.send(JSON.stringify({
          type: 'matchResult',
          payload: {
            winner: winnerAddress,
            matchId: Buffer.from(room.matchIdBytes).toString('hex'),
            settlementSignature,
            serverPublicKey,
          }
        } as WsMessage));
      }
    }
  }

  private getMockHand(): Card[] {
    return [
      {
        id: `card-${Math.random()}`,
        type: 'attack',
        question: {
          id: 'q-1',
          text: 'What is 5 + 5?',
          options: ['10', '15', '20']
        }
      },
      {
        id: `card-${Math.random()}`,
        type: 'heal',
        question: {
          id: 'q-2',
          text: 'If A -> B and B -> C, then...',
          options: ['A -> C', 'C -> A', 'A -> B -> A']
        }
      }
    ];
  }
}
