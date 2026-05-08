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
  RoundOverData,
  CardType,
  PresenceUpdateData,
} from '@shared/websocket';

type ConnectionState = 'connecting' | 'reconnecting' | 'connected' | 'disconnected' | 'error';
type SocketCloseInfo = {
  code: number;
  reason: string;
  wasClean: boolean;
};

interface PlayCardResult {
  correct: boolean;
  damage: number;
  heal: number;
  multiplier: number;
  cardType: CardType;
}

interface MatchFoundPayload {
  roomId: string;
  role?: string;
  opponentAddress?: string;
}

interface RoomCancelledPayload {
  cancelledBy?: string | null;
  reason: 'player_cancelled' | 'deposit_timeout' | 'disconnect';
}

interface UseMatchSocketParams {
  roomId: string;
  address: string;
  characterId?: string;
}

function trimTrailingSlash(input: string) {
  return input.replace(/\/+$/, '');
}

function isSettlementPayload(value: unknown): value is MatchResultPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.winner === 'string' &&
    typeof payload.matchId === 'string' &&
    typeof payload.settlementSignature === 'string' &&
    typeof payload.serverPublicKey === 'string'
  );
}

function isMatchSummaryPayload(value: unknown): value is MatchResult {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    (typeof payload.winnerAddress === 'string' || payload.winnerAddress === null) &&
    typeof payload.reason === 'string' &&
    typeof payload.finalScores === 'object' &&
    typeof payload.finalHealth === 'object'
  );
}

export function useMatchSocket({ roomId, address, characterId }: UseMatchSocketParams) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastSocketError, setLastSocketError] = useState<string | null>(null);
  const [lastSocketCloseInfo, setLastSocketCloseInfo] = useState<SocketCloseInfo | null>(null);
  const [lastSocketIssueAt, setLastSocketIssueAt] = useState<number | null>(null);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [settlementResult, setSettlementResult] = useState<MatchResultPayload | null>(null);
  const [matchSummaryResult, setMatchSummaryResult] = useState<MatchResult | null>(null);
  const [matchInvalidated, setMatchInvalidated] = useState<MatchResult | null>(null);
  const [lastDamageEvent, setLastDamageEvent] = useState<DamageEvent | null>(null);
  const [lastPlayResult, setLastPlayResult] = useState<(PlayCardResult & { at: number }) | null>(null);
  const [lastCardCountdown, setLastCardCountdown] = useState<CardCountdownData | null>(null);
  const [lastCardExpired, setLastCardExpired] = useState<(CardExpiredData & { at: number }) | null>(null);
  const [lastScoreUpdate, setLastScoreUpdate] = useState<ScoreUpdateData | null>(null);
  const [lastRoundOver, setLastRoundOver] = useState<(RoundOverData & { at: number }) | null>(null);
  const [lastPresenceUpdate, setLastPresenceUpdate] = useState<(PresenceUpdateData & { at: number }) | null>(null);
  const [currentPhase, setCurrentPhase] = useState<GamePhase>('normal');
  const [depositUnlockedAt, setDepositUnlockedAt] = useState<number | null>(null);
  const [opponentFailedDepositAt, setOpponentFailedDepositAt] = useState<number | null>(null);
  const [lastRoomCancelled, setLastRoomCancelled] = useState<(RoomCancelledPayload & { at: number }) | null>(null);
  const [lastMatchFound, setLastMatchFound] = useState<(MatchFoundPayload & { at: number }) | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const wsBaseUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080');
  const characterQuery = characterId ? `&characterId=${encodeURIComponent(characterId)}` : "";
  const socketUrl =
    roomId && address
      ? `${wsBaseUrl}/match/${roomId}?address=${encodeURIComponent(address)}${characterQuery}`
      : null;

  useEffect(() => {
    if (!socketUrl) return;

    let isCleaningUp = false;
    const ws = new WebSocket(socketUrl);
    socketRef.current = ws;
    queueMicrotask(() => {
      setConnectionState((prev) => {
        if (reconnectNonce > 0 || prev === 'reconnecting') {
          return 'reconnecting';
        }
        return 'connecting';
      });
    });

    ws.onopen = () => {
      setConnectionState('connected');
      setLastSocketError(null);
      setLastSocketCloseInfo(null);
      setLastSocketIssueAt(null);
    };

    ws.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'gameStateUpdate':
            setGameState(message.payload as GameState);
            break;

          case 'matchResult':
            if (isSettlementPayload(message.payload)) {
              setSettlementResult(message.payload);
            } else if (isMatchSummaryPayload(message.payload)) {
              setMatchSummaryResult(message.payload);
            }
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

          case 'depositUnlocked':
            setDepositUnlockedAt(Date.now());
            break;

          case 'opponentFailedDeposit':
            setOpponentFailedDepositAt(Date.now());
            break;

          case 'roomCancelled':
            setLastRoomCancelled({
              ...(message.payload as RoomCancelledPayload),
              at: Date.now(),
            });
            break;

          case 'matchFound':
            setLastMatchFound({
              ...(message.payload as MatchFoundPayload),
              at: Date.now(),
            });
            break;

          // Legacy/forward-compat alias used in some older flows.
          case 'matchFoundWaiting':
            setLastMatchFound({
              ...(message.payload as MatchFoundPayload),
              at: Date.now(),
            });
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

          case 'presenceUpdate':
            setLastPresenceUpdate({
              ...(message.payload as PresenceUpdateData),
              at: Date.now(),
            });
            break;

          case 'roundOver':
            setLastRoundOver({
              ...(message.payload as RoundOverData),
              at: Date.now(),
            });
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Failed to parse websocket message', err);
      }
    };

    ws.onclose = (event) => {
      if (isCleaningUp || socketRef.current !== ws) return;
      setConnectionState('disconnected');
      setLastSocketIssueAt(Date.now());
      setLastSocketCloseInfo({
        code: event.code,
        reason: event.reason || '',
        wasClean: event.wasClean,
      });
    };

    ws.onerror = (error) => {
      if (isCleaningUp || socketRef.current !== ws) return;
      setConnectionState('error');
      setLastSocketIssueAt(Date.now());
      setLastSocketError('Socket connection failed. Check API server and room join.');
      console.error('WebSocket error:', error);
    };

    return () => {
      isCleaningUp = true;
      ws.close();
      if (socketRef.current === ws) {
        socketRef.current = null;
      }
    };
  }, [socketUrl, reconnectNonce]);

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

  const cancelMatch = useCallback(() => {
    sendMessage('cancelMatch', {});
  }, [sendMessage]);

  const surrender = useCallback(() => {
    sendMessage('surrender', {});
  }, [sendMessage]);

  const reconnect = useCallback(() => {
    setConnectionState('reconnecting');
    setLastSocketError(null);
    setLastSocketCloseInfo(null);
    setReconnectNonce((prev) => prev + 1);
  }, []);

  return {
    connectionState,
    socketUrl,
    lastSocketError,
    lastSocketCloseInfo,
    lastSocketIssueAt,
    gameState,
    settlementResult,
    matchSummaryResult,
    matchInvalidated,
    lastDamageEvent,
    lastPlayResult,
    lastCardCountdown,
    lastCardExpired,
    lastScoreUpdate,
    lastRoundOver,
    lastPresenceUpdate,
    currentPhase,
    depositUnlockedAt,
    opponentFailedDepositAt,
    lastRoomCancelled,
    lastMatchFound,
    openCard,
    playCard,
    confirmDeposit,
    cancelMatch,
    surrender,
    reconnect,
  };
}
