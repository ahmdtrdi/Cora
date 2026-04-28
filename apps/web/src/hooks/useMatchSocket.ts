import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, WsMessage } from '@shared/websocket';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useMatchSocket(roomId: string) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!roomId) return;
    let isCurrent = true;

    // Use environment variable in production, fallback to localhost for dev
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
    const ws = new WebSocket(`${wsUrl}/match/${roomId}`);
    socketRef.current = ws;

    queueMicrotask(() => {
      if (isCurrent) setConnectionState('connecting');
    });

    ws.onopen = () => {
      setConnectionState('connected');
      console.log(`Connected to match room: ${roomId}`);
    };

    ws.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data);
        
        switch (message.type) {
          case 'gameStateUpdate':
            setGameState(message.payload as GameState);
            break;
          case 'matchResult':
            console.log('Match Result:', message.payload);
            // Handle result if needed (or keep it in gameState)
            break;
          default:
            console.warn('Unknown message type:', message.type);
        }
      } catch (err) {
        console.error('Failed to parse websocket message', err);
      }
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
      console.log(`Disconnected from match room: ${roomId}`);
    };

    ws.onerror = (error) => {
      setConnectionState('error');
      console.error('WebSocket error:', error);
    };

    // Cleanup on unmount
    return () => {
      isCurrent = false;
      ws.close();
      socketRef.current = null;
    };
  }, [roomId]);

  const playCard = useCallback((cardId: string, selectedOptionIndex: number) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const message: WsMessage = {
        type: 'playCard',
        payload: { cardId, selectedOptionIndex }
      };
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn('Cannot play card, socket is not connected');
    }
  }, []);

  return {
    connectionState,
    gameState,
    playCard
  };
}
