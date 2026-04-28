import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  GameState,
  WsMessage,
  TimerState,
  DamageEvent,
  GamePhase,
  MatchResult,
} from '@shared/websocket';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

interface PlayCardResult {
  correct: boolean;
  damage: number;
  heal: number;
  multiplier: number;
  cardType: 'attack' | 'heal';
}

export function useMatchSocket(roomId: string) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [lastDamageEvent, setLastDamageEvent] = useState<DamageEvent | null>(null);
  const [lastPlayResult, setLastPlayResult] = useState<PlayCardResult | null>(null);
  const [currentPhase, setCurrentPhase] = useState<GamePhase>('normal');
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
            setMatchResult(message.payload as MatchResult);
            console.log('Match Result:', message.payload);
            break;

          case 'timerSync':
            // Update timer in existing game state if available
            setGameState(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                timer: message.payload as TimerState,
              };
            });
            break;

          case 'damageEvent':
            setLastDamageEvent(message.payload as DamageEvent);
            break;

          case 'phaseChange':
            setCurrentPhase(message.payload as GamePhase);
            console.log('Phase changed to:', message.payload);
            break;

          case 'playCardResult':
            setLastPlayResult(message.payload as PlayCardResult);
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

  const playCard = useCallback((cardId: string, selectedOptionId: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const message: WsMessage = {
        type: 'playCard',
        payload: { cardId, selectedOptionId },
      };
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn('Cannot play card, socket is not connected');
    }
  }, []);

  const confirmDeposit = useCallback((signature: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const message: WsMessage = {
        type: 'confirmDeposit',
        payload: { signature },
      };
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn('Cannot confirm deposit, socket is not connected');
    }
  }, []);

  return {
    connectionState,
    gameState,
    matchResult,
    lastDamageEvent,
    lastPlayResult,
    currentPhase,
    playCard,
    confirmDeposit,
  };
}
