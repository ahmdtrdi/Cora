import type { ServerWebSocket } from 'bun';
import type { WsMessage } from '@shared/websocket';
import type { RoomManager } from '../RoomManager';

interface QueueItem {
  address: string;
  ws?: ServerWebSocket<unknown>;
  resolve: (roomId: string) => void;
  enqueuedAt: number;
}

export class Queue {
  private queue: QueueItem[] = [];

  constructor(private manager: RoomManager) {}

  private shortAddr(address: string): string {
    if (address.length <= 12) return address;
    return `${address.slice(0, 4)}..${address.slice(-4)}`;
  }

  private printQueueState(event: string, detail: string = '') {
    const C = {
      reset: '\x1b[0m',
      bold: '\x1b[1m',
      dim: '\x1b[2m',
      cyan: '\x1b[36m',
      yellow: '\x1b[33m',
      green: '\x1b[32m',
      magenta: '\x1b[35m',
      red: '\x1b[31m',
      white: '\x1b[37m',
    };

    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const W = 56;
    
    console.log('');
    console.log(`${C.cyan}${C.bold}┌${'─'.repeat(W)}┐${C.reset}`);
    console.log(`${C.cyan}│${C.reset} ${C.bold}🎮 MATCHMAKING FIFO${C.reset}${' '.repeat(W - 21)}${C.cyan}│${C.reset}`);
    console.log(`${C.cyan}│${C.reset} ${C.dim}${time}${C.reset}${' '.repeat(W - time.length - 2)}${C.cyan}│${C.reset}`);
    console.log(`${C.cyan}├${'─'.repeat(W)}┤${C.reset}`);

    const eventLine = ` ${event}`;
    const pad1 = Math.max(0, W - eventLine.length);
    console.log(`${C.cyan}│${C.reset}${C.yellow}${C.bold}${eventLine}${C.reset}${' '.repeat(pad1)}${C.cyan}│${C.reset}`);

    if (detail) {
      const detailLine = `   ${detail}`;
      const pad2 = Math.max(0, W - detailLine.length);
      console.log(`${C.cyan}│${C.reset}${C.dim}${detailLine}${C.reset}${' '.repeat(pad2)}${C.cyan}│${C.reset}`);
    }

    console.log(`${C.cyan}├${'─'.repeat(W)}┤${C.reset}`);

    const qLen = this.queue.length;
    const qTitle = ` 🧍 Queue (${qLen} waiting)`;
    const pad3 = Math.max(0, W - qTitle.length);
    console.log(`${C.cyan}│${C.reset}${C.magenta}${C.bold}${qTitle}${C.reset}${' '.repeat(pad3)}${C.cyan}│${C.reset}`);

    if (qLen === 0) {
      const emptyLine = `   (empty)`;
      const padE = Math.max(0, W - emptyLine.length);
      console.log(`${C.cyan}│${C.reset}${C.dim}${emptyLine}${C.reset}${' '.repeat(padE)}${C.cyan}│${C.reset}`);
    } else {
      this.queue.forEach((q, i) => {
        const addr = this.shortAddr(q.address);
        const line = `   ${i + 1}. ${addr}`;
        const padQ = Math.max(0, W - line.length);
        console.log(`${C.cyan}│${C.reset}${C.white} ${line}${C.reset}${' '.repeat(padQ - 1)}${C.cyan}│${C.reset}`);
      });
    }

    console.log(`${C.cyan}├${'─'.repeat(W)}┤${C.reset}`);

    const activeRooms = this.manager.store.getAllRooms().filter(r => r.status !== 'finished');
    const rTitle = ` 🏠 Active Rooms (${activeRooms.length})`;
    const pad4 = Math.max(0, W - rTitle.length);
    console.log(`${C.cyan}│${C.reset}${C.green}${C.bold}${rTitle}${C.reset}${' '.repeat(pad4)}${C.cyan}│${C.reset}`);

    if (activeRooms.length === 0) {
      const emptyLine = `   (none)`;
      const padE = Math.max(0, W - emptyLine.length);
      console.log(`${C.cyan}│${C.reset}${C.dim}${emptyLine}${C.reset}${' '.repeat(padE)}${C.cyan}│${C.reset}`);
    } else {
      for (const room of activeRooms) {
        const players = Array.from(room.clients.keys()).map(a => this.shortAddr(a));
        const statusIcon = room.status === 'waiting' ? '⏳' : room.status === 'depositing' ? '💰' : room.status === 'playing' ? '⚔️' : room.status === 'settling' ? '⚖️' : '🏁';
        const roomShort = room.id.length > 20 ? room.id.slice(0, 20) + '..' : room.id;
        const line = `   ${statusIcon} ${roomShort}`;
        const padR = Math.max(0, W - line.length);
        console.log(`${C.cyan}│${C.reset}${C.white} ${line}${C.reset}${' '.repeat(padR - 1)}${C.cyan}│${C.reset}`);
        const pLine = `      ${players.join(' vs ') || '(no players yet)'}`;
        const padP = Math.max(0, W - pLine.length);
        console.log(`${C.cyan}│${C.reset}${C.dim}${pLine}${C.reset}${' '.repeat(padP)}${C.cyan}│${C.reset}`);
      }
    }

    console.log(`${C.cyan}└${'─'.repeat(W)}┘${C.reset}`);
    console.log('');
  }

  public async queueMatch(address: string, signal?: AbortSignal): Promise<string> {
    for (const room of this.manager.store.getAllRooms()) {
      if ((room.playerA === address || room.playerB === address) && room.status !== 'finished') {
        if (room.status === 'depositing' && Array.from(room.depositTimeouts.values()).length === 0) {
            console.log(`[StaleGuard] Room ${room.id} stuck in depositing with no timeouts. Destroying.`);
            this.manager.lifecycle.destroyRoom(room.id);
            continue;
        }

        this.printQueueState('♻️  RECONNECT', `${this.shortAddr(address)} already in room ${room.id}`);
        return room.id;
      }
    }

    const existingIndex = this.queue.findIndex(q => q.address === address);
    if (existingIndex !== -1) {
      this.printQueueState('♻️  RE-QUEUE', `${this.shortAddr(address)} already waiting — chaining request`);
      const existing = this.queue[existingIndex];
      return new Promise<string>((resolve) => {
        const originalResolve = existing.resolve;
        existing.resolve = (roomId: string) => {
          originalResolve(roomId);
          resolve(roomId);
        };
        // Update the WS reference if provided. Wait, 'ws' is not given here.
        if (signal) {
          signal.addEventListener('abort', () => {
            const qIndex = this.queue.indexOf(existing);
            if (qIndex !== -1) {
              this.queue.splice(qIndex, 1);
              this.printQueueState('❌ PLAYER LEFT', `${this.shortAddr(address)} aborted matchmaking`);
            }
          });
        }
      });
    }

    this.printQueueState('⬆️  PLAYER JOINING', `${this.shortAddr(address)} wants to play`);

    const index = this.queue.findIndex((q) => q.address !== address);

    if (index !== -1) {
      const playerAEntry = this.queue.splice(index, 1)[0];
      const newRoomId = `room-${Date.now()}`;
      const room = this.manager.store.createRoom(newRoomId);

      this.printQueueState(
        '✅ MATCH FOUND!',
        `${this.shortAddr(playerAEntry.address)} 🆚 ${this.shortAddr(address)} → ${newRoomId}`,
      );

      room.playerA = playerAEntry.address;
      room.playerB = address;
      room.status = 'depositing';

      this.manager.lifecycle.armDepositTimeout(room, playerAEntry.address);

      playerAEntry.resolve(newRoomId);

      return newRoomId;
    }

    return new Promise((resolve) => {
      const queueItem = { address, resolve, enqueuedAt: Date.now() };
      this.queue.push(queueItem);

      this.printQueueState('⏳ WAITING', `${this.shortAddr(address)} added to queue (no opponent yet)`);

      const ttlHandle = setTimeout(() => {
        const qIndex = this.queue.indexOf(queueItem);
        if (qIndex !== -1) {
          this.queue.splice(qIndex, 1);
          this.printQueueState('⏰ TTL EXPIRED', `${this.shortAddr(address)} removed after 5m timeout`);
        }
      }, 300_000);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(ttlHandle);
          const qIndex = this.queue.indexOf(queueItem);
          if (qIndex !== -1) {
            this.queue.splice(qIndex, 1);
            this.printQueueState('❌ PLAYER LEFT', `${this.shortAddr(address)} aborted matchmaking`);
          }
        });
      }
    });
  }

  public requeueInnocent(address: string, ws: ServerWebSocket<unknown>) {
    const queueItem = {
      address: address,
      ws: ws,
      resolve: (newRoomId: string) => {
        this.manager.network.safeSend(ws, { type: 'matchFound', payload: { roomId: newRoomId, role: 'playerA', opponentAddress: '' } } satisfies WsMessage);
      },
      enqueuedAt: Date.now(),
    };
    this.queue.unshift(queueItem);
    console.log(`[Cancel] Re-queued ${address} (WS alive).`);
  }
}
