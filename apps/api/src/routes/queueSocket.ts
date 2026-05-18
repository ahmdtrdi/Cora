import type { WSEvents } from 'hono/ws';
import type { RoomManager } from '../managers/RoomManager';
import type { WsMessage } from '@shared/websocket';

/**
 * WebSocket route handler for /queue — replaces the HTTP long-poll matchmaking flow.
 *
 * Lifecycle:
 *   1. Client opens WS to /queue?address=<wallet>
 *   2. Server checks for active rooms (reconnect) or enters queue
 *   3. Server pushes queueJoined / queueStatus / matchFound / queueLeft events
 *   4. Client can send cancelQueue to leave
 *   5. WS close also removes from queue
 */
export function createQueueSocketRoute(roomManager: RoomManager) {
  return (address: string | undefined): WSEvents => {
    if (!address) {
      return {
        onOpen(_event, ws) {
          ws.close(1008, 'Address query param is required');
        },
      };
    }

    let queued = false;
    let cancelled = false;

    return {
      onOpen(_event, ws) {
        roomManager.queue.releaseUnfundedPublicDepositRoom(address);

        // Check for active room first (reconnect scenario)
        const activeRoom = roomManager.queue.findActiveRoomForAddress(address);
        if (activeRoom) {
          const role =
            activeRoom.playerA === address ? 'playerA'
              : activeRoom.playerB === address ? 'playerB'
                : undefined;
          const opponentAddress = address === activeRoom.playerA ? activeRoom.playerB : activeRoom.playerA;

          roomManager.network.safeSend(ws, {
            type: 'matchFound',
            payload: { roomId: activeRoom.id, role, opponentAddress: opponentAddress ?? '', roomType: activeRoom.roomType },
          } satisfies WsMessage);

          console.log(`[QueueWS] ${address.slice(0, 6)}.. already in room ${activeRoom.id}, sent matchFound`);
          return;
        }

        // Enter queue via WebSocket
        queued = true;
        roomManager.queue.queueMatchWs(address, ws);
      },

      onMessage(event, ws) {
        try {
          const msg: WsMessage = JSON.parse(
            typeof event.data === 'string' ? event.data : event.data.toString(),
          );

          if (msg.type === 'cancelQueue') {
            console.log(`[QueueWS] ${address.slice(0, 6)}.. sent cancelQueue`);
            cancelled = true;
            roomManager.queue.cancelQueueWs(address, ws);
            ws.close(1000, 'Queue cancelled by client');
          }
        } catch {
          // Ignore unparseable messages
        }
      },

      onClose(_event, ws) {
        if (queued && !cancelled) {
          roomManager.queue.detachQueueWs(address, ws);
        }
      },
    };
  };
}
