import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  GameState,
  WsMessage,
  TimerState,
  DamageEvent,
  GamePhase,
  MatchResult,
  MatchResultPayload,
  CardCountdownData,
  CardExpiredData,
  ScoreUpdateData,
  CardType,
} from '@shared/websocket';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

interface PlayCardResult {
  correct: boolean;
  damage: number;
  heal: number;
  multiplier: number;
  cardType: CardType;
}

interface UseMatchSocketParams {
  roomId: string;
  address: string;
}

export function useMatchSocket({ roomId, address }: UseMatchSocketParams) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [settlementResult, setSettlementResult] = useState<MatchResultPayload | null>(null);
  const [matchInvalidated, setMatchInvalidated] = useState<MatchResult | null>(null);
  const [lastDamageEvent, setLastDamageEvent] = useState<DamageEvent | null>(null);
  const [lastPlayResult, setLastPlayResult] = useState<(PlayCardResult & { at: number }) | null>(null);
  const [lastCardCountdown, setLastCardCountdown] = useState<CardCountdownData | null>(null);
  const [lastCardExpired, setLastCardExpired] = useState<(CardExpiredData & { at: number }) | null>(null);
  const [lastScoreUpdate, setLastScoreUpdate] = useState<ScoreUpdateData | null>(null);
  const [currentPhase, setCurrentPhase] = useState<GamePhase>('normal');
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!roomId || !address) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
    const ws = new WebSocket(`${wsUrl}/match/${roomId}?address=${encodeURIComponent(address)}`);
    socketRef.current = ws;
    queueMicrotask(() => {
      setConnectionState('connecting');
    });

    ws.onopen = () => {
      setConnectionState('connected');
    };

    ws.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'gameStateUpdate':
            setGameState(message.payload as GameState);
            break;

          case 'matchResult':
            setSettlementResult(message.payload as MatchResultPayload);
            break;

          case 'matchInvalidated':
            setMatchInvalidated(message.payload as MatchResult);
            break;

          case 'timerSync':
            setGameState((prev) => {
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
            break;

          case 'playCardResult':
            setLastPlayResult({
              ...(message.payload as PlayCardResult),
              at: Date.now(),
            });
            break;

          case 'cardCountdown':
            setLastCardCountdown(message.payload as CardCountdownData);
            break;

          case 'cardExpired':
            setLastCardExpired({
              ...(message.payload as CardExpiredData),
              at: Date.now(),
            });
            break;

          case 'scoreUpdate':
            setLastScoreUpdate(message.payload as ScoreUpdateData);
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Failed to parse websocket message', err);
      }
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
    };

    ws.onerror = (error) => {
      setConnectionState('error');
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [roomId, address]);

  const sendMessage = useCallback((type: string, payload: unknown) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }
    socketRef.current.send(JSON.stringify({ type, payload } as WsMessage));
  }, []);

  const openCard = useCallback(
    (cardId: string) => {
      sendMessage('openCard', { cardId });
    },
    [sendMessage],
  );

  const playCard = useCallback(
    (cardId: string, selectedOptionId: string) => {
      sendMessage('playCard', { cardId, selectedOptionId });
    },
    [sendMessage],
  );

  const confirmDeposit = useCallback(
    (signature: string) => {
      sendMessage('confirmDeposit', { signature });
    },
    [sendMessage],
  );

  return {
    connectionState,
    gameState,
    settlementResult,
    matchInvalidated,
    lastDamageEvent,
    lastPlayResult,
    lastCardCountdown,
    lastCardExpired,
    lastScoreUpdate,
    currentPhase,
    openCard,
    playCard,
    confirmDeposit,
  };
}
