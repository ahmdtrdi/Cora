"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Card, CharacterState, GameStatus } from "@shared/websocket";
import { useMatchSocket } from "../../hooks/useMatchSocket";
import { HydratedWalletButton } from "@/components/wallet/HydratedWalletButton";
import { createChallengeLink, createChallengeTweetIntent } from "@/lib/challenge/createChallengeLink";
import { ChallengeShareCard } from "@/components/challenge/ChallengeShareCard";
import { createChallengeCardFileName, renderChallengeCardJpg } from "@/lib/challenge/renderChallengeCardJpg";

type MatchOutcome = {
  cardId: string;
  outcome: "correct" | "wrong" | "timeout";
  at: number;
};

const ANSWER_TIME_SEC = 10;
const EMPTY_HAND: Card[] = [];
const CARD_PLACEHOLDER_COUNT = 5;
const FIXED_WAGER_USD = "1.00";
const SOCKET_ALERT_DISPLAY_MS = 12000;
const SHARE_NOTICE_DISPLAY_MS = 5000;
const REACTION_DISPLAY_MS = 1900;
const LOBBY_DRAFT_STORAGE_KEY = "cora:lobby-draft";
const ACTIVE_ROOM_STORAGE_KEY = "cora:active-room";
const ARENA_TOKEN_BY_ID: Record<string, string> = {
  sol: "SOL",
  bonk: "BONK",
};
const CHARACTER_REACTION_EXPRESSIONS: CharacterExpression[] = ["happy", "confident", "hurt"];

const CARD_TRANSFORMS = [
  "translate-y-4 -rotate-6",
  "translate-y-1 -rotate-3",
  "-translate-y-1 rotate-0",
  "translate-y-1 rotate-3",
  "translate-y-4 rotate-6",
] as const;

function getCardTransform(index: number) {
  if (index < CARD_TRANSFORMS.length) {
    return CARD_TRANSFORMS[index];
  }
  return index % 2 === 0 ? "translate-y-3 -rotate-2" : "translate-y-3 rotate-2";
}

function getStatusLabel(status: GameStatus) {
  if (status === "waiting") return "Waiting Opponent";
  if (status === "depositing") return "Deposit Phase";
  if (status === "playing") return "Playing";
  if (status === "settling") return "Settling";
  return "Finished";
}

function shortenAddress(address?: string) {
  if (!address) return "Unknown";
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

function formatMatchClock(remainingMs?: number) {
  if (!Number.isFinite(remainingMs) || remainingMs === undefined) {
    return "03:00";
  }
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function clearLobbyReturnState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
  window.sessionStorage.removeItem(LOBBY_DRAFT_STORAGE_KEY);
}

type UiAlert = {
  id: string;
  title: string;
  message: string;
  tone: "error" | "warning";
  autoDismissMs: number;
  actionLabel?: string;
  onAction?: () => void;
};

type BattleSide = "player" | "opponent";

type ProjectileState = {
  id: string;
  from: BattleSide;
  to: BattleSide;
  src: string | null;
};

type BaseFxState = "idle" | "hit" | "heal";
type CharacterSpriteState = "stay" | "action";
type CharacterExpression = "happy" | "confident" | "hurt";
type CharacterReaction = {
  id: string;
  expression: CharacterExpression;
};

function getCharacterVisual(characterId?: string) {
  if (characterId === "turing") {
    return {
      initial: "T",
      portraitBg: "linear-gradient(160deg, #152920 0%, #274137 60%, #0d1f18 100%)",
      baseGlyph: "</>",
    };
  }
  if (characterId === "curie") {
    return {
      initial: "C",
      portraitBg: "linear-gradient(160deg, #3d1f0a 0%, #5c2e12 60%, #210e04 100%)",
      baseGlyph: "⚗",
    };
  }
  if (characterId === "einstein") {
    return {
      initial: "E",
      portraitBg: "linear-gradient(160deg, #12122a 0%, #1e1e3f 60%, #080814 100%)",
      baseGlyph: "✦",
    };
  }
  return {
    initial: (characterId?.slice(0, 1) ?? "R").toUpperCase(),
    portraitBg: "linear-gradient(160deg, #173026 0%, #274137 60%, #10231b 100%)",
    baseGlyph: "⌬",
  };
}

function resolveCharacterSpriteState(characterState?: CharacterState, isActioning = false): CharacterSpriteState {
  if (isActioning || characterState === "action") return "action";
  return "stay";
}

function getCharacterSpriteSrc(characterId?: string, state: CharacterSpriteState = "stay") {
  const normalizedId = characterId?.trim().toLowerCase();
  if (!normalizedId) return null;
  return `/assets/characters/${normalizedId}/${state}.png`;
}

function getCharacterExpressionSrc(characterId?: string, expression: CharacterExpression = "happy") {
  const normalizedId = characterId?.trim().toLowerCase();
  if (!normalizedId) return null;
  return `/assets/characters/${normalizedId}/exp/${expression}.png`;
}

function getCharacterProjectileSrc(characterId?: string) {
  const normalizedId = characterId?.trim().toLowerCase();
  if (!normalizedId) return null;
  if (normalizedId === "turing") {
    const variant = Math.random() < 0.5 ? 0 : 1;
    return `/assets/characters/turing/projectile_${variant}.png`;
  }
  return `/assets/characters/${normalizedId}/projectile.png`;
}

function getCharacterBaseSrc(characterId: string | undefined, side: BattleSide) {
  const normalizedId = characterId?.trim().toLowerCase();
  if (!normalizedId) return null;
  if (normalizedId === "einstein") {
    return side === "player"
      ? "/assets/characters/einstein/base_left.png"
      : "/assets/characters/einstein/base_right.png";
  }
  return `/assets/characters/${normalizedId}/base.png`;
}

export function BattleScreen() {
  const searchParams = useSearchParams();
  const roomIdParam = searchParams.get("roomId");
  const arenaIdParam = searchParams.get("arena");
  const tokenParam = searchParams.get("token");
  const wagerParam = searchParams.get("wager");
  const roomId = roomIdParam ?? "";
  const arenaId = arenaIdParam ?? "sol";
  const arenaToken = tokenParam ?? ARENA_TOKEN_BY_ID[arenaId] ?? "SOL";
  const wagerUsd = wagerParam ?? FIXED_WAGER_USD;
  const preSignedDepositSig = searchParams.get("depositSig");
  const wallet = useWallet();
  const { publicKey } = wallet;

  const address = publicKey?.toBase58() ?? "";
  const requiresWalletConnect = !address;
  const playGuardError = !roomIdParam
    ? "Missing roomId. Return to lobby and enter the match from the found flow."
    : null;

  const {
    connectionState,
    socketUrl,
    lastSocketError,
    lastSocketCloseInfo,
    lastSocketIssueAt,
    gameState,
    settlementResult,
    matchSummaryResult,
    matchInvalidated,
    lastPresenceUpdate,
    lastRoomCancelled,
    lastDamageEvent,
    lastPlayResult,
    lastCardCountdown,
    lastCardExpired,
    currentPhase,
    openCard,
    playCard,
    confirmDeposit,
    cancelMatch,
    surrender,
    reconnect,
  } = useMatchSocket({ roomId, address });

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(ANSWER_TIME_SEC);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [gameNotice, setGameNotice] = useState<{ id: string; message: string; tone: "action" | "phase" } | null>(null);
  const [characterActionSide, setCharacterActionSide] = useState<BattleSide | null>(null);
  const [projectile, setProjectile] = useState<ProjectileState | null>(null);
  const [playerBaseFx, setPlayerBaseFx] = useState<BaseFxState>("idle");
  const [opponentBaseFx, setOpponentBaseFx] = useState<BaseFxState>("idle");
  const [playerReaction, setPlayerReaction] = useState<CharacterReaction | null>(null);
  const [opponentReaction, setOpponentReaction] = useState<CharacterReaction | null>(null);
  const [outcomes, setOutcomes] = useState<MatchOutcome[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});
  const [shareNotice, setShareNotice] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [settlementDetailsOpen, setSettlementDetailsOpen] = useState(false);
  const [surrenderModalOpen, setSurrenderModalOpen] = useState(false);
  const [pendingSurrenderAfterReconnect, setPendingSurrenderAfterReconnect] = useState(false);
  const [failedCharacterSprites, setFailedCharacterSprites] = useState<Record<string, true>>({});
  const [failedProjectileSprites, setFailedProjectileSprites] = useState<Record<string, true>>({});
  const [failedBaseSprites, setFailedBaseSprites] = useState<Record<string, true>>({});

  const pendingCardIdRef = useRef<string | null>(null);
  const lastProcessedPlayAtRef = useRef(0);
  const lastProcessedExpiredAtRef = useRef(0);
  const lastDamageTimestampRef = useRef(0);
  const depositConfirmedRef = useRef(false);
  const extraPointShownRef = useRef(false);
  const previousOpponentConnectedRef = useRef<boolean | null>(null);
  const gameNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerReactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opponentReactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPlayerStreakRef = useRef(0);
  const previousOpponentStreakRef = useRef(0);
  const playerActionControls = useAnimationControls();
  const opponentActionControls = useAnimationControls();
  const playerBaseControls = useAnimationControls();
  const opponentBaseControls = useAnimationControls();

  const showGameNotice = useCallback((message: string, tone: "action" | "phase" = "action") => {
    if (gameNoticeTimerRef.current) {
      clearTimeout(gameNoticeTimerRef.current);
      gameNoticeTimerRef.current = null;
    }
    setGameNotice({ id: `${Date.now()}`, message, tone });
    gameNoticeTimerRef.current = setTimeout(() => {
      setGameNotice(null);
      gameNoticeTimerRef.current = null;
    }, 2100);
  }, []);

  const showReaction = useCallback(
    (side: BattleSide, expression: CharacterExpression, durationMs = REACTION_DISPLAY_MS) => {
      const id = `${side}:${expression}:${Date.now()}`;
      if (side === "player") {
        if (playerReactionTimerRef.current) {
          clearTimeout(playerReactionTimerRef.current);
          playerReactionTimerRef.current = null;
        }
        setPlayerReaction({ id, expression });
        playerReactionTimerRef.current = setTimeout(() => {
          setPlayerReaction((prev) => (prev?.id === id ? null : prev));
          playerReactionTimerRef.current = null;
        }, durationMs);
        return;
      }
      if (opponentReactionTimerRef.current) {
        clearTimeout(opponentReactionTimerRef.current);
        opponentReactionTimerRef.current = null;
      }
      setOpponentReaction({ id, expression });
      opponentReactionTimerRef.current = setTimeout(() => {
        setOpponentReaction((prev) => (prev?.id === id ? null : prev));
        opponentReactionTimerRef.current = null;
      }, durationMs);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (gameNoticeTimerRef.current) {
        clearTimeout(gameNoticeTimerRef.current);
      }
      if (playerReactionTimerRef.current) {
        clearTimeout(playerReactionTimerRef.current);
      }
      if (opponentReactionTimerRef.current) {
        clearTimeout(opponentReactionTimerRef.current);
      }
    };
  }, []);

  const hand = gameState?.hand ?? EMPTY_HAND;
  const displaySlots = hand.length > 0 ? hand.length : CARD_PLACEHOLDER_COUNT;
  const status = gameState?.status ?? "waiting";
  const player = gameState?.player;
  const opponent = gameState?.opponent;
  const activeCard = useMemo(
    () => hand.find((card) => card.id === activeCardId) ?? null,
    [hand, activeCardId],
  );

  useEffect(() => {
    if (!lastCardExpired) return;
    if (lastCardExpired.at === lastProcessedExpiredAtRef.current) return;
    lastProcessedExpiredAtRef.current = lastCardExpired.at;

    setOutcomes((prev) => [
      ...prev,
      {
        cardId: lastCardExpired.cardId,
        outcome: "timeout",
        at: lastCardExpired.at,
      },
    ]);
    showGameNotice("No damage this turn.");
    setActiveCardId(null);
    setAnswerLocked(false);
    pendingCardIdRef.current = null;
  }, [lastCardExpired, showGameNotice]);

  useEffect(() => {
    if (!lastPlayResult) return;
    if (lastPlayResult.at === lastProcessedPlayAtRef.current) return;
    lastProcessedPlayAtRef.current = lastPlayResult.at;

    const cardId = pendingCardIdRef.current ?? "unknown";
    setOutcomes((prev) => [
      ...prev,
      {
        cardId,
        outcome: lastPlayResult.correct ? "correct" : "wrong",
        at: lastPlayResult.at,
      },
    ]);
    if (lastPlayResult.correct) {
      showReaction("player", "happy");
    }
    if (lastPlayResult.cardType === "heal" && lastPlayResult.heal > 0) {
      showGameNotice(`Healed: +${lastPlayResult.heal} HP`);
    } else if (lastPlayResult.cardType === "attack" && lastPlayResult.damage > 0) {
      showGameNotice(`Attack landed: -${lastPlayResult.damage} HP`);
    } else {
      showGameNotice("No damage this turn.");
    }
    setActiveCardId(null);
    setAnswerLocked(false);
    pendingCardIdRef.current = null;
  }, [lastPlayResult, showGameNotice, showReaction]);

  useEffect(() => {
    if (!lastDamageEvent) return;
    if (lastDamageEvent.timestamp === lastDamageTimestampRef.current) return;
    lastDamageTimestampRef.current = lastDamageEvent.timestamp;

    const attackerSide: BattleSide =
      lastDamageEvent.attackerAddress === player?.address ? "player" : "opponent";
    const targetSide: BattleSide =
      lastDamageEvent.targetAddress === player?.address
        ? "player"
        : lastDamageEvent.targetAddress === opponent?.address
          ? "opponent"
          : attackerSide === "player"
            ? "opponent"
            : "player";
    const actionKind = lastDamageEvent.type === "heal" ? "heal" : "attack";
    const attackerCharacterId = attackerSide === "player" ? player?.characterId : opponent?.characterId;
    const shouldSpawnProjectile = actionKind === "attack" && lastDamageEvent.damage > 0;
    const projectileSrc = shouldSpawnProjectile ? getCharacterProjectileSrc(attackerCharacterId) : null;

    setCharacterActionSide(attackerSide);
    const projectileSpawnTimer = setTimeout(() => {
      if (shouldSpawnProjectile) {
        setProjectile({
          id: `${lastDamageEvent.timestamp}`,
          from: attackerSide,
          to: targetSide,
          src: projectileSrc,
        });
      } else {
        setProjectile(null);
      }
    }, 0);

    const actionResetTimer = setTimeout(() => {
      setCharacterActionSide(null);
    }, 360);
    const projectileHitTimer = setTimeout(() => {
      setProjectile(null);
      if (targetSide === "player") {
        setPlayerBaseFx(actionKind === "heal" ? "heal" : "hit");
      } else {
        setOpponentBaseFx(actionKind === "heal" ? "heal" : "hit");
      }
    }, 440);
    const baseFxResetTimer = setTimeout(() => {
      setPlayerBaseFx("idle");
      setOpponentBaseFx("idle");
    }, 840);
    const hurtReactionTimer =
      actionKind === "attack" && lastDamageEvent.damage > 0
        ? setTimeout(() => {
            showReaction(targetSide, "hurt");
          }, 420)
        : null;

    return () => {
      clearTimeout(projectileSpawnTimer);
      clearTimeout(actionResetTimer);
      clearTimeout(projectileHitTimer);
      clearTimeout(baseFxResetTimer);
      if (hurtReactionTimer) {
        clearTimeout(hurtReactionTimer);
      }
    };
  }, [lastDamageEvent, opponent?.address, player?.address, opponent?.characterId, player?.characterId, showReaction]);

  const isPlayable = status === "playing" && connectionState === "connected";
  const hasTerminalResult = Boolean(settlementResult) || Boolean(matchSummaryResult) || Boolean(matchInvalidated);
  const isRoomCancelled = Boolean(lastRoomCancelled);
  const isMatchComplete = hasTerminalResult || isRoomCancelled || status === "finished";
  const isCommittedState = status === "playing" || status === "settling";
  const canSurrenderByState = !isMatchComplete && isCommittedState;
  const canCancelMatch = connectionState === "connected" && !isMatchComplete && (status === "waiting" || status === "depositing");
  const canSurrenderMatch = connectionState === "connected" && canSurrenderByState;

  function onOpenCard(card: Card) {
    if (!isPlayable || activeCardId || isMatchComplete) return;
    setActiveCardId(card.id);
    setSecondsLeft(ANSWER_TIME_SEC);
    setAnswerLocked(false);
    pendingCardIdRef.current = card.id;
    openCard(card.id);
  }

  function onAnswer(optionId: string) {
    if (!activeCard || answerLocked || !isPlayable) return;
    setAnswerLocked(true);
    pendingCardIdRef.current = activeCard.id;
    playCard(activeCard.id, optionId);
  }

  function onCancelMatch() {
    if (!canCancelMatch) return;
    cancelMatch();
  }

  function onOpenSurrenderModal() {
    if (!canSurrenderMatch) return;
    setSurrenderModalOpen(true);
  }

  function onConfirmSurrender() {
    if (!canSurrenderByState) return;
    if (connectionState === "connected") {
      surrender();
      setSurrenderModalOpen(false);
      return;
    }
    setPendingSurrenderAfterReconnect(true);
    reconnect();
    setSurrenderModalOpen(false);
  }

  const playerScore = player?.score ?? 0;
  const opponentScore = opponent?.score ?? 0;
  const playerRoundsWon = player?.roundsWon ?? 0;
  const opponentRoundsWon = opponent?.roundsWon ?? 0;
  const playerCurrentCorrectStreak = player?.currentCorrectStreak ?? 0;
  const opponentCurrentCorrectStreak = opponent?.currentCorrectStreak ?? 0;
  const playerBaseHp = player?.baseHealth ?? 100;
  const opponentBaseHp = opponent?.baseHealth ?? 100;

  const correctCount = outcomes.filter((item) => item.outcome === "correct").length;
  const timeoutCount = outcomes.filter((item) => item.outcome === "timeout").length;
  const wrongCount = outcomes.filter((item) => item.outcome === "wrong").length;

  const winnerAddress =
    settlementResult?.winner ?? matchSummaryResult?.winnerAddress ?? matchInvalidated?.winnerAddress ?? null;
  const matchResultReason = matchSummaryResult?.reason ?? matchInvalidated?.reason ?? null;
  const surrenderedAddress = matchSummaryResult?.surrenderedAddress ?? matchInvalidated?.surrenderedAddress ?? null;
  const didCurrentPlayerSurrender = matchResultReason === "surrender" && surrenderedAddress === address;
  const didOpponentSurrender =
    matchResultReason === "surrender" && Boolean(surrenderedAddress) && surrenderedAddress !== address;
  const isDraw = matchResultReason === "draw";
  const roomCancelledTitle =
    lastRoomCancelled?.reason === "deposit_timeout"
      ? "Deposit timed out"
      : lastRoomCancelled?.reason === "disconnect"
        ? "Match cancelled before battle start"
        : "Match cancelled";
  const roomCancelledSubtitle =
    lastRoomCancelled?.reason === "deposit_timeout"
      ? "Deposit confirmation did not complete in time."
      : lastRoomCancelled?.reason === "disconnect"
        ? "A player disconnected before the battle was ready."
        : "A player cancelled this room before battle start.";
  const settlementText = isRoomCancelled
    ? roomCancelledTitle
    : didCurrentPlayerSurrender
      ? "You Surrendered"
      : didOpponentSurrender
        ? "Opponent Surrendered"
        : winnerAddress
          ? winnerAddress === player?.address
            ? "You Win"
            : "You Lose"
          : isDraw
            ? "Draw"
            : matchInvalidated
              ? "Match Invalidated"
              : "Match Finished";
  const settlementSubtitle = isRoomCancelled
    ? roomCancelledSubtitle
    : matchInvalidated
      ? "Match invalidated."
      : didCurrentPlayerSurrender
        ? "You forfeited this match. Settlement is being resolved."
        : didOpponentSurrender
          ? "Your rival surrendered. Settlement is being resolved."
          : isDraw
            ? "The match ended evenly. Settlement is being resolved."
            : winnerAddress
              ? winnerAddress === address
                ? "Victory secured."
                : "Rival took this round."
              : "Match results are being finalized."
  const settlementStatus = isRoomCancelled ? "Cancelled" : matchInvalidated ? "Invalidated" : settlementResult ? "Settled" : "Pending";
  const settlementStatusStyle = isRoomCancelled
    ? { color: "#6f3a28", background: "rgba(214,174,119,0.2)", border: "1px solid rgba(111,58,40,0.25)" }
    : matchInvalidated
      ? { color: "#8a3f2b", background: "rgba(185,96,62,0.14)", border: "1px solid rgba(138,63,43,0.34)" }
      : settlementResult
        ? { color: "#214335", background: "rgba(103,149,123,0.18)", border: "1px solid rgba(33,67,53,0.28)" }
        : { color: "#6f3a28", background: "rgba(214,174,119,0.2)", border: "1px solid rgba(111,58,40,0.25)" };
  const showWinnerLine = Boolean(winnerAddress && !isRoomCancelled && !didCurrentPlayerSurrender && !didOpponentSurrender && (matchInvalidated || winnerAddress !== address));
  const arenaLabel = `${arenaToken} Arena`;
  const didWin = winnerAddress ? winnerAddress === address : false;
  const challengeStatusLabel = didWin ? "Winner" : "Rematch";
  const challengeDescription = didWin
    ? "I just won in CORA. Think you can beat me?"
    : "I am running it back in CORA. Challenge me.";
  const displaySecondsLeft =
    activeCard && lastCardCountdown && lastCardCountdown.cardId === activeCard.id
      ? Math.max(0, Math.ceil(lastCardCountdown.remainingMs / 1000))
      : secondsLeft;
  const roundsToWin = gameState?.roundsToWin ?? 2;
  const maxRounds = Math.max(1, roundsToWin * 2 - 1);
  const currentRound = Math.min(maxRounds, Math.max(1, gameState?.currentRound ?? 1));
  const roundText = `Round ${currentRound}/${maxRounds}`;
  const remainingMatchClock = formatMatchClock(gameState?.timer?.remainingMs);
  const isSocketRecovering = connectionState === "connecting" || connectionState === "reconnecting";
  const hasSocketIssue = connectionState === "error" || connectionState === "disconnected";
  const isRoomStateLoading = !gameState && isSocketRecovering;
  const isRoomUnavailable = !gameState && hasSocketIssue;
  const presenceOpponentConnected =
    opponent?.address && lastPresenceUpdate?.players
      ? lastPresenceUpdate.players[opponent.address]?.isConnected
      : undefined;
  const opponentIsConnected = presenceOpponentConnected ?? opponent?.isConnected ?? true;
  const showOpponentAwayStatus = connectionState === "connected" && !isMatchComplete && !opponentIsConnected;
  const socketCloseText = lastSocketCloseInfo
    ? `Close code ${lastSocketCloseInfo.code}${lastSocketCloseInfo.reason ? `: ${lastSocketCloseInfo.reason}` : ""}`
    : null;
  const showDisconnectedOverlay =
    Boolean(lastSocketIssueAt) &&
    connectionState !== "connected" &&
    !isMatchComplete &&
    !isRoomCancelled;
  const isPlayStateReady = status === "playing" || status === "settling" || isMatchComplete;
  const shouldShowPlayStateGate = !isPlayStateReady;
  const showRoomGateModal = (isRoomStateLoading || shouldShowPlayStateGate) && !showOpponentAwayStatus && !showDisconnectedOverlay;
  const roomGateTitle = isRoomStateLoading
    ? "Syncing Room State"
    : isRoomUnavailable
      ? "You were disconnected"
    : status === "waiting"
      ? "Waiting For Battle"
      : "Room Locked";
  const roomGateMessage = isRoomStateLoading
    ? "Rejoining battle room after refresh. Waiting for server snapshot."
    : isRoomUnavailable
      ? "Your match is still active. Rejoin to continue."
    : `Current room status: ${getStatusLabel(status)}.`;
  const opponentIdentityLabel = opponent?.address
    ? shortenAddress(opponent.address)
    : isRoomStateLoading
      ? "Syncing..."
      : "Unknown";
  const playerCharacterId = player?.characterId ?? undefined;
  const opponentCharacterId = opponent?.characterId ?? undefined;
  const playerVisual = getCharacterVisual(playerCharacterId);
  const opponentVisual = getCharacterVisual(opponentCharacterId);
  const playerSpriteState = resolveCharacterSpriteState(player?.characterState, characterActionSide === "player");
  const opponentSpriteState = resolveCharacterSpriteState(opponent?.characterState, characterActionSide === "opponent");
  const playerSpriteSrc = getCharacterSpriteSrc(playerCharacterId, playerSpriteState);
  const opponentSpriteSrc = getCharacterSpriteSrc(opponentCharacterId, opponentSpriteState);
  const playerBaseSrc = getCharacterBaseSrc(playerCharacterId, "player");
  const opponentBaseSrc = getCharacterBaseSrc(opponentCharacterId, "opponent");
  const playerReactionSrc = playerReaction
    ? getCharacterExpressionSrc(playerCharacterId, playerReaction.expression)
    : null;
  const opponentReactionSrc = opponentReaction
    ? getCharacterExpressionSrc(opponentCharacterId, opponentReaction.expression)
    : null;
  const hasPlayerSprite = Boolean(playerSpriteSrc && !failedCharacterSprites[playerSpriteSrc]);
  const hasOpponentSprite = Boolean(opponentSpriteSrc && !failedCharacterSprites[opponentSpriteSrc]);
  const hasPlayerBaseSprite = Boolean(playerBaseSrc && !failedBaseSprites[playerBaseSrc]);
  const hasOpponentBaseSprite = Boolean(opponentBaseSrc && !failedBaseSprites[opponentBaseSrc]);
  const hasPlayerReactionSprite = Boolean(playerReactionSrc && !failedCharacterSprites[playerReactionSrc]);
  const hasOpponentReactionSprite = Boolean(opponentReactionSrc && !failedCharacterSprites[opponentReactionSrc]);
  const playerBaseHpPct = Math.max(0, Math.min(100, playerBaseHp));
  const opponentBaseHpPct = Math.max(0, Math.min(100, opponentBaseHp));

  useEffect(() => {
    if (typeof window === "undefined") return;

    function preloadExpressions(characterId?: string) {
      if (!characterId) return;
      for (const expression of CHARACTER_REACTION_EXPRESSIONS) {
        const src = getCharacterExpressionSrc(characterId, expression);
        if (!src) continue;
        const preloader = new window.Image();
        preloader.src = src;
      }
    }

    preloadExpressions(playerCharacterId);
    preloadExpressions(opponentCharacterId);
  }, [playerCharacterId, opponentCharacterId]);

  const challengeLink = useMemo(() => {
    const origin = typeof window === "undefined" ? null : window.location.origin;
    return createChallengeLink({
      origin,
      arenaId,
      token: arenaToken,
      wagerUsd,
      refAddress: address,
    });
  }, [arenaId, arenaToken, wagerUsd, address]);
  const cleanLobbyHref = "/lobby";
  useEffect(() => {
    if (playerSpriteState !== "action") {
      playerActionControls.start({
        scale: 1,
        y: 0,
        transition: { duration: 0.12, ease: [0.22, 1, 0.36, 1] },
      });
      return;
    }

    playerActionControls.start({
      scale: [1, 1.05, 1],
      y: [0, -5, 0],
      transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
    });
  }, [playerSpriteState, playerActionControls]);

  useEffect(() => {
    if (opponentSpriteState !== "action") {
      opponentActionControls.start({
        scale: 1,
        y: 0,
        transition: { duration: 0.12, ease: [0.22, 1, 0.36, 1] },
      });
      return;
    }

    opponentActionControls.start({
      scale: [1, 1.05, 1],
      y: [0, -5, 0],
      transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
    });
  }, [opponentSpriteState, opponentActionControls]);

  useEffect(() => {
    if (playerBaseFx === "hit") {
      playerBaseControls.start({
        x: [0, -8, 7, -5, 3, 0],
        y: [0, -1, 0],
        scale: [1, 1.01, 1],
        transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
      });
      return;
    }
    if (playerBaseFx === "heal") {
      playerBaseControls.start({
        x: 0,
        y: [0, -2, 0],
        scale: [1, 1.04, 1],
        transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
      });
      return;
    }
    playerBaseControls.start({
      x: 0,
      y: 0,
      scale: 1,
      transition: { duration: 0.14, ease: [0.22, 1, 0.36, 1] },
    });
  }, [playerBaseFx, playerBaseControls]);

  useEffect(() => {
    if (opponentBaseFx === "hit") {
      opponentBaseControls.start({
        x: [0, 8, -7, 5, -3, 0],
        y: [0, -1, 0],
        scale: [1, 1.01, 1],
        transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
      });
      return;
    }
    if (opponentBaseFx === "heal") {
      opponentBaseControls.start({
        x: 0,
        y: [0, -2, 0],
        scale: [1, 1.04, 1],
        transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
      });
      return;
    }
    opponentBaseControls.start({
      x: 0,
      y: 0,
      scale: 1,
      transition: { duration: 0.14, ease: [0.22, 1, 0.36, 1] },
    });
  }, [opponentBaseFx, opponentBaseControls]);

  useEffect(() => {
    if (status !== "depositing" || connectionState !== "connected") return;
    if (depositConfirmedRef.current) return;
    if (!preSignedDepositSig) return;

    confirmDeposit(preSignedDepositSig);
    depositConfirmedRef.current = true;
  }, [status, connectionState, preSignedDepositSig, confirmDeposit]);

  useEffect(() => {
    const phase = gameState?.timer?.phase ?? currentPhase;
    if (phase !== "extra_point") return;
    if (extraPointShownRef.current) return;

    extraPointShownRef.current = true;
    showGameNotice("Extra Point - every move matters.", "phase");
  }, [currentPhase, gameState?.timer?.phase, showGameNotice]);

  useEffect(() => {
    if (!isMatchComplete && !isRoomCancelled) return;
    clearLobbyReturnState();
  }, [isMatchComplete, isRoomCancelled]);

  useEffect(() => {
    if (!pendingSurrenderAfterReconnect) return;
    if (connectionState !== "connected") return;

    const timerId = setTimeout(() => {
      if (!canSurrenderByState) {
        setPendingSurrenderAfterReconnect(false);
        return;
      }
      surrender();
      setPendingSurrenderAfterReconnect(false);
    }, 0);
    return () => clearTimeout(timerId);
  }, [pendingSurrenderAfterReconnect, connectionState, canSurrenderByState, surrender]);

  useEffect(() => {
    if (connectionState !== "connected") return;
    if (!opponent?.address) return;

    const previous = previousOpponentConnectedRef.current;
    previousOpponentConnectedRef.current = opponentIsConnected;
    if (previous === null || previous === opponentIsConnected) return;

    const notifyTimer = setTimeout(() => {
      if (opponentIsConnected) {
        showGameNotice("Opponent reconnected", "phase");
      } else {
        showGameNotice("Opponent disconnected", "phase");
      }
    }, 0);

    return () => clearTimeout(notifyTimer);
  }, [connectionState, opponent?.address, opponentIsConnected, showGameNotice]);

  useEffect(() => {
    const previous = previousPlayerStreakRef.current;
    previousPlayerStreakRef.current = playerCurrentCorrectStreak;
    if (playerCurrentCorrectStreak >= 3 && playerCurrentCorrectStreak !== previous) {
      showReaction("player", "confident");
    }
  }, [playerCurrentCorrectStreak, showReaction]);

  useEffect(() => {
    const previous = previousOpponentStreakRef.current;
    previousOpponentStreakRef.current = opponentCurrentCorrectStreak;
    if (opponentCurrentCorrectStreak >= 3 && opponentCurrentCorrectStreak !== previous) {
      showReaction("opponent", "confident");
    }
  }, [opponentCurrentCorrectStreak, showReaction]);

  const alerts: UiAlert[] = [];
  const socketMessage = socketCloseText ?? lastSocketError ?? "Socket disconnected from match server.";
  if (lastSocketIssueAt && !showDisconnectedOverlay) {
    alerts.push({
      id: `socket:${lastSocketIssueAt}`,
      title: "Server Connection Issue",
      message: socketMessage,
      tone: "error",
      autoDismissMs: SOCKET_ALERT_DISPLAY_MS,
      actionLabel: undefined,
      onAction: undefined,
    });
  }
  if (connectionState === "reconnecting" && !showDisconnectedOverlay) {
    alerts.push({
      id: "socket:reconnecting",
      title: "Rejoining room",
      message: "Your match is still active. Rejoining battle room now.",
      tone: "warning",
      autoDismissMs: 0,
    });
  }

  const missingPreSignedDeposit = status === "depositing" && connectionState === "connected" && !preSignedDepositSig;
  if (missingPreSignedDeposit) {
    alerts.push({
      id: "deposit:missing_pre_signed_intent",
      title: "Deposit Sync Error",
      message: "Missing pre-signed deposit intent. Return to lobby and start from match setup.",
      tone: "warning",
      autoDismissMs: 0,
    });
  }
  if (lastRoomCancelled) {
    alerts.push({
      id: `room:cancelled:${lastRoomCancelled.at}`,
      title: roomCancelledTitle,
      message: roomCancelledSubtitle,
      tone: "warning",
      autoDismissMs: 0,
    });
  }

  const visibleAlerts = alerts.filter((alert) => !dismissedAlerts[alert.id]);
  const autoDismissKeys = visibleAlerts
    .filter((alert) => alert.autoDismissMs > 0)
    .map((alert) => `${alert.id}:${alert.autoDismissMs}`)
    .join("|");

  useEffect(() => {
    const timerIds: Array<ReturnType<typeof setTimeout>> = [];

    for (const alert of visibleAlerts) {
      if (alert.autoDismissMs <= 0) continue;
      const timerId = setTimeout(() => {
        setDismissedAlerts((prev) => ({ ...prev, [alert.id]: true }));
      }, alert.autoDismissMs);
      timerIds.push(timerId);
    }

    return () => {
      for (const timerId of timerIds) {
        clearTimeout(timerId);
      }
    };
  }, [autoDismissKeys, visibleAlerts]);

  function dismissAlert(alert: UiAlert) {
    setDismissedAlerts((prev) => ({ ...prev, [alert.id]: true }));
  }

  function markCharacterSpriteFailed(src: string) {
    setFailedCharacterSprites((prev) => {
      if (prev[src]) return prev;
      return { ...prev, [src]: true };
    });
  }

  function markProjectileSpriteFailed(src: string) {
    setFailedProjectileSprites((prev) => {
      if (prev[src]) return prev;
      return { ...prev, [src]: true };
    });
  }

  function markBaseSpriteFailed(src: string) {
    setFailedBaseSprites((prev) => {
      if (prev[src]) return prev;
      return { ...prev, [src]: true };
    });
  }

  async function onCopyChallengeLink() {
    if (!challengeLink) {
      setShareNotice({ text: "Challenge link unavailable on this client.", tone: "error" });
      return;
    }
    try {
      await navigator.clipboard.writeText(challengeLink);
      setShareNotice({ text: "Challenge link copied.", tone: "success" });
    } catch {
      setShareNotice({ text: "Copy failed. Please copy manually from the link below.", tone: "error" });
    }
  }

  async function buildChallengeShareImageFile() {
    if (!challengeLink) return null;
    try {
      const blob = await renderChallengeCardJpg({
        title: "Challenge Me",
        challengerName: "You",
        challengerAddress: address,
        statusLabel: challengeStatusLabel,
        description: challengeDescription,
        token: arenaToken,
        wagerUsd,
        arenaLabel,
        challengeLink,
      });
      const fileName = createChallengeCardFileName({
        title: "Challenge Me",
        challengerName: "You",
        challengerAddress: address,
        statusLabel: challengeStatusLabel,
        description: challengeDescription,
        token: arenaToken,
        wagerUsd,
        arenaLabel,
        challengeLink,
      });
      return new File([blob], fileName, { type: "image/jpeg" });
    } catch {
      setShareNotice({ text: "Failed to generate JPG. Try again.", tone: "error" });
      return null;
    }
  }

  function downloadShareFile(file: File) {
    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function onSaveChallengeJpg() {
    const imageFile = await buildChallengeShareImageFile();
    if (!imageFile) return;
    downloadShareFile(imageFile);
    setShareNotice({ text: "Saved challenge card JPG.", tone: "success" });
  }

  async function onShareChallengeToX() {
    if (!challengeLink) {
      setShareNotice({ text: "Challenge link unavailable on this client.", tone: "error" });
      return;
    }
    const imageFile = await buildChallengeShareImageFile();

    const intent = createChallengeTweetIntent(challengeLink, challengeDescription);
    const popup = window.open(intent, "_blank", "noopener,noreferrer");
    if (!popup) {
      setShareNotice({ text: "Popup blocked. Allow popups and retry.", tone: "error" });
      return;
    }
    if (imageFile) {
      downloadShareFile(imageFile);
      setShareNotice({ text: "Opened X directly. JPG downloaded, attach it to the tweet.", tone: "success" });
      return;
    }
    setShareNotice({ text: "Opened X directly.", tone: "success" });
  }

  useEffect(() => {
    if (!shareNotice) return;
    const id = setTimeout(() => {
      setShareNotice(null);
    }, SHARE_NOTICE_DISPLAY_MS);
    return () => clearTimeout(id);
  }, [shareNotice]);

  if (playGuardError) {
    return (
      <main
        className="grid min-h-[100svh] place-items-center px-4"
        style={{
          background:
            "radial-gradient(circle at 50% 24%, rgba(168,143,104,0.2), transparent 46%), linear-gradient(180deg, #26372f 0%, #1a2822 45%, #111a16 100%)",
        }}
      >
        <div className="frame-cut w-full max-w-lg p-5 text-center" style={{ border: "1px solid rgba(248,214,148,0.35)", background: "rgba(13,24,20,0.9)" }}>
          <p className="font-caprasimo text-3xl text-[var(--tone-cream)]">Match Context Missing</p>
          <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.82)]">{playGuardError}</p>
          <div className="mt-4">
            <Link
              href="/lobby"
              className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
              style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
            >
              Back To Lobby
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (requiresWalletConnect) {
    return (
      <main
        className="grid min-h-[100svh] place-items-center px-4"
        style={{
          background:
            "radial-gradient(circle at 50% 24%, rgba(168,143,104,0.2), transparent 46%), linear-gradient(180deg, #26372f 0%, #1a2822 45%, #111a16 100%)",
        }}
      >
        <div className="frame-cut w-full max-w-md p-5 text-center" style={{ border: "1px solid rgba(248,214,148,0.35)", background: "rgba(13,24,20,0.9)" }}>
          <p className="font-caprasimo text-3xl text-[var(--tone-cream)]">Wallet Required</p>
          <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.82)]">
            Connect Phantom to enter battle and sign match deposit.
          </p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <HydratedWalletButton />
            <Link
              href="/lobby"
              className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
              style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
            >
              Back To Lobby
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-[100svh] px-4 py-4 md:px-6"
      style={{
        background:
          "radial-gradient(circle at 50% 24%, rgba(168,143,104,0.2), transparent 46%), linear-gradient(180deg, #26372f 0%, #1a2822 45%, #111a16 100%)",
      }}
    >
      <div className="fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-2 md:right-6 md:top-6">
        {visibleAlerts.map((alert) => (
          <div
            key={alert.id}
            className="frame-cut px-3 py-2"
            style={{
              border:
                alert.tone === "error"
                  ? "1px solid rgba(186,105,49,0.42)"
                  : "1px solid rgba(248,214,148,0.42)",
              background:
                alert.tone === "error"
                  ? "rgba(43,24,16,0.94)"
                  : "rgba(13,24,20,0.94)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <p
                className="font-gabarito text-xs font-bold uppercase tracking-wide"
                style={{ color: alert.tone === "error" ? "#f8d694" : "#f8d694" }}
              >
                {alert.title}
              </p>
              <button
                type="button"
                onClick={() => dismissAlert(alert)}
                className="font-gabarito text-xs font-bold leading-none text-[var(--tone-cream)] opacity-80"
                aria-label="Close alert"
              >
                X
              </button>
            </div>
            <p
              className="mt-1 break-words font-gabarito text-xs"
              style={{ color: "rgba(244,240,230,0.88)" }}
            >
              {alert.message}
            </p>
            {alert.id.startsWith("socket:") && socketUrl && (
              <p className="mt-1 break-all font-gabarito text-[11px] text-[rgba(244,240,230,0.74)]">
                {socketUrl}
              </p>
            )}
            <div className="mt-2 flex gap-2">
              {alert.actionLabel && alert.onAction && (
                <button
                  type="button"
                  onClick={alert.onAction}
                  className="frame-cut frame-cut-sm px-2 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                  style={{ border: "1px solid rgba(248,214,148,0.35)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
                >
                  {alert.actionLabel}
                </button>
              )}
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[rgba(248,214,148,0.16)]">
              <div
                className="h-full"
                style={{
                  width: "100%",
                  background:
                    alert.tone === "error"
                      ? "linear-gradient(90deg,#d9a85b,#ba6931)"
                      : "linear-gradient(90deg,#d9a85b,#ba6931)",
                  animationName: alert.autoDismissMs > 0 ? "alertDrain" : undefined,
                  animationDuration: alert.autoDismissMs > 0 ? `${alert.autoDismissMs}ms` : undefined,
                  animationTimingFunction: alert.autoDismissMs > 0 ? "linear" : undefined,
                  animationFillMode: alert.autoDismissMs > 0 ? "forwards" : undefined,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="pointer-events-none fixed left-1/2 top-20 z-[60] w-full max-w-sm -translate-x-1/2 px-4">
        <AnimatePresence mode="wait">
          {gameNotice && (
            <motion.div
              key={gameNotice.id}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="frame-cut px-4 py-2 text-center shadow-xl"
              style={{
                border:
                  gameNotice.tone === "phase"
                    ? "1px solid rgba(248,214,148,0.45)"
                    : "1px solid rgba(157,180,150,0.42)",
                background:
                  gameNotice.tone === "phase"
                    ? "linear-gradient(145deg, rgba(46,31,17,0.95), rgba(33,22,13,0.95))"
                    : "linear-gradient(145deg, rgba(19,32,26,0.95), rgba(13,24,20,0.95))",
              }}
            >
              <p className="font-gabarito text-xs font-bold uppercase tracking-[0.12em] text-[var(--tone-cream)]">
                {gameNotice.message}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mx-auto flex min-h-[calc(100svh-2rem)] w-full max-w-7xl flex-col">
        <header className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
          <p className="font-gabarito text-xs uppercase tracking-[0.18em] text-[var(--tone-cream)]/85">
            Battle Room - {roomId}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-xs font-bold uppercase tracking-wide"
              style={{ border: "1px solid rgba(248,214,148,0.32)", background: "rgba(19,32,26,0.86)", color: "var(--tone-cream)" }}
            >
              {roundText}
            </span>
            <span
              className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-xs font-bold uppercase tracking-wide"
              style={{ border: "1px solid rgba(248,214,148,0.32)", background: "rgba(19,32,26,0.86)", color: "var(--tone-cream)" }}
            >
              {remainingMatchClock}
            </span>
            <span
              className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-xs font-bold uppercase tracking-wide"
              style={{ border: "1px solid rgba(248,214,148,0.32)", background: "rgba(19,32,26,0.86)", color: "var(--tone-cream)" }}
            >
              {getStatusLabel(status)} - {connectionState}
            </span>
            <span
              className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-xs font-bold uppercase tracking-wide"
              style={{
                border: "1px solid rgba(39,65,55,0.2)",
                background:
                  (gameState?.timer?.phase ?? currentPhase) === "extra_point"
                    ? "rgba(53,93,63,0.92)"
                    : "rgba(19,32,26,0.86)",
                color: "var(--tone-cream)",
              }}
            >
              {(gameState?.timer?.phase ?? currentPhase) === "extra_point" ? "Phase: Extra Point x2" : "Phase: Normal"}
            </span>
            <span
              className="rounded-full px-2.5 py-1 font-gabarito text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{
                border: "1px solid rgba(248,214,148,0.32)",
                background: opponentIsConnected ? "rgba(39,65,55,0.52)" : "rgba(111,58,40,0.52)",
                color: "var(--tone-cream)",
              }}
            >
              Rival {opponentIsConnected ? "Connected" : "Away"}
            </span>
            {canCancelMatch && (
              <button
                type="button"
                onClick={onCancelMatch}
                className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-xs font-bold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.38)", background: "rgba(19,32,26,0.9)", color: "var(--tone-cream)" }}
              >
                Cancel Match
              </button>
            )}
            {canSurrenderMatch && (
              <button
                type="button"
                onClick={onOpenSurrenderModal}
                className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-xs font-bold uppercase tracking-wide"
                style={{ border: "1px solid rgba(186,105,49,0.45)", background: "rgba(77,42,24,0.9)", color: "var(--tone-cream)" }}
              >
                Surrender
              </button>
            )}
            {(isMatchComplete || isRoomCancelled) && (
              <Link
                href={cleanLobbyHref}
                onClick={clearLobbyReturnState}
                className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-xs font-bold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", background: "rgba(19,32,26,0.86)", color: "var(--tone-cream)" }}
              >
                Return To Lobby
              </Link>
            )}
          </div>
        </header>

        <section
          className="frame-cut relative flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3 md:px-6"
          style={{
            border: "1px solid rgba(248,214,148,0.28)",
            background:
              "radial-gradient(circle at 50% 18%, rgba(248,214,148,0.16), transparent 45%), linear-gradient(160deg, rgba(12,21,17,0.92), rgba(17,29,24,0.94))",
          }}
        >
          <div
            className="relative z-20 grid grid-cols-[1fr_auto_1fr] items-center gap-2 pb-2"
            style={{ borderBottom: "1px solid rgba(248,214,148,0.12)" }}
          >
            <div className="min-w-0">
              <p className="flex min-w-0 flex-wrap items-center gap-1.5 font-gabarito text-xs text-[rgba(244,240,230,0.88)]">
                <span className="font-bold text-[var(--tone-cream)]">You</span>
                <span className="opacity-40">{"\u00B7"}</span>
                <span className="rounded-full px-1.5 py-px text-[10px]" style={{ background: "rgba(39,65,55,0.38)", border: "1px solid rgba(248,214,148,0.18)" }}>Score {playerScore}</span>
                <span className="opacity-40">{"\u00B7"}</span>
                <span className="rounded-full px-1.5 py-px text-[10px]" style={{ background: "rgba(39,65,55,0.38)", border: "1px solid rgba(248,214,148,0.18)" }}>Rounds {playerRoundsWon}</span>
              </p>
              {address && (
                <p className="mt-0.5 font-mono text-[10px] text-[rgba(244,240,230,0.58)]">{shortenAddress(address)}</p>
              )}
            </div>
            <p className="font-caprasimo text-2xl leading-none text-[var(--tone-cream)] drop-shadow-[0_6px_14px_rgba(0,0,0,0.4)] md:text-3xl">VS</p>
            <div className="min-w-0 text-right">
              <p className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 font-gabarito text-xs text-[rgba(244,240,230,0.88)]">
                <span className="font-bold text-[var(--tone-cream)]">Rival</span>
                <span className="opacity-40">{"\u00B7"}</span>
                <span className="rounded-full px-1.5 py-px text-[10px]" style={{ background: "rgba(39,65,55,0.38)", border: "1px solid rgba(248,214,148,0.18)" }}>Score {opponentScore}</span>
                <span className="opacity-40">{"\u00B7"}</span>
                <span className="rounded-full px-1.5 py-px text-[10px]" style={{ background: "rgba(39,65,55,0.38)", border: "1px solid rgba(248,214,148,0.18)" }}>Rounds {opponentRoundsWon}</span>
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-[rgba(244,240,230,0.58)]">{opponentIdentityLabel}</p>
            </div>
          </div>

          <div className="relative min-h-[320px] flex-1 overflow-hidden md:min-h-[380px] lg:min-h-[420px]">
            <div
              className="pointer-events-none absolute inset-x-[6%] bottom-[7%] z-0 h-[28%]"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(248,214,148,0.22) 0%, rgba(82,96,68,0.18) 42%, transparent 72%)",
              }}
            />
            <motion.div
              className="absolute -left-[7%] bottom-[14%] z-0 w-[clamp(220px,30vw,440px)] opacity-90"
              style={{
                aspectRatio: "1700 / 1269",
                filter:
                  playerBaseFx === "hit"
                    ? "drop-shadow(0 0 24px rgba(186,105,49,0.42))"
                    : playerBaseFx === "heal"
                      ? "drop-shadow(0 0 24px rgba(157,180,150,0.45))"
                      : "drop-shadow(0 10px 16px rgba(0,0,0,0.28))",
              }}
              animate={playerBaseControls}
            >
              <div className="relative h-full w-full">
                {hasPlayerBaseSprite && playerBaseSrc ? (
                  <Image
                    src={playerBaseSrc}
                    alt={`${playerCharacterId ?? "player"} base`}
                    fill
                    sizes="(max-width: 768px) 220px, 440px"
                    className="object-contain object-left-bottom"
                    onError={() => markBaseSpriteFailed(playerBaseSrc)}
                  />
                ) : (
                  <div
                    className="grid h-full w-full place-items-center rounded-2xl border"
                    style={{
                      borderColor: "rgba(248,214,148,0.36)",
                      background: "linear-gradient(150deg, rgba(37,63,51,0.9), rgba(18,33,27,0.94))",
                      boxShadow: "0 10px 20px rgba(0,0,0,0.35)",
                    }}
                  >
                    <span className="font-caprasimo text-3xl text-[rgba(248,214,148,0.88)]">{playerVisual.baseGlyph}</span>
                  </div>
                )}
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{
                    background:
                      playerBaseFx === "hit"
                        ? "radial-gradient(circle at 50% 45%, rgba(186,105,49,0.26), rgba(186,105,49,0))"
                        : playerBaseFx === "heal"
                          ? "radial-gradient(circle at 50% 45%, rgba(157,180,150,0.24), rgba(157,180,150,0))"
                          : "transparent",
                  }}
                />
              </div>
            </motion.div>

            <motion.div
              className="absolute -right-[7%] bottom-[14%] z-0 w-[clamp(220px,30vw,440px)] opacity-90"
              style={{
                aspectRatio: "1700 / 1269",
                filter:
                  opponentBaseFx === "hit"
                    ? "drop-shadow(0 0 24px rgba(186,105,49,0.42))"
                    : opponentBaseFx === "heal"
                      ? "drop-shadow(0 0 24px rgba(157,180,150,0.45))"
                      : "drop-shadow(0 10px 16px rgba(0,0,0,0.28))",
              }}
              animate={opponentBaseControls}
            >
              <div className="relative h-full w-full">
                {hasOpponentBaseSprite && opponentBaseSrc ? (
                  <Image
                    src={opponentBaseSrc}
                    alt={`${opponentCharacterId ?? "opponent"} base`}
                    fill
                    sizes="(max-width: 768px) 220px, 440px"
                    className={`object-contain object-right-bottom ${
                      opponentCharacterId?.trim().toLowerCase() === "einstein" ? "" : "-scale-x-100"
                    }`}
                    onError={() => markBaseSpriteFailed(opponentBaseSrc)}
                  />
                ) : (
                  <div
                    className="grid h-full w-full place-items-center rounded-2xl border"
                    style={{
                      borderColor: "rgba(248,214,148,0.36)",
                      background: "linear-gradient(150deg, rgba(37,63,51,0.9), rgba(18,33,27,0.94))",
                      boxShadow: "0 10px 20px rgba(0,0,0,0.35)",
                    }}
                  >
                    <span className="font-caprasimo text-3xl text-[rgba(248,214,148,0.88)]">{opponentVisual.baseGlyph}</span>
                  </div>
                )}
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{
                    background:
                      opponentBaseFx === "hit"
                        ? "radial-gradient(circle at 50% 45%, rgba(186,105,49,0.26), rgba(186,105,49,0))"
                        : opponentBaseFx === "heal"
                          ? "radial-gradient(circle at 50% 45%, rgba(157,180,150,0.24), rgba(157,180,150,0))"
                          : "transparent",
                  }}
                />
              </div>
            </motion.div>

            <div className="absolute left-1 top-2 z-[14] w-[clamp(132px,17vw,190px)] md:left-4 md:top-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.12em] text-[rgba(244,240,230,0.82)]">Base</p>
                <p className="font-mono text-[11px] text-[rgba(244,240,230,0.86)]">{playerBaseHp} / 100</p>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full border border-[rgba(248,214,148,0.34)] bg-[rgba(19,32,26,0.72)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${playerBaseHpPct}%`,
                    background: "linear-gradient(90deg, #d9a85b, #ba6931)",
                  }}
                />
              </div>
            </div>

            <div className="absolute right-1 top-2 z-[14] w-[clamp(132px,17vw,190px)] text-right md:right-4 md:top-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[11px] text-[rgba(244,240,230,0.86)]">{opponentBaseHp} / 100</p>
                <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.12em] text-[rgba(244,240,230,0.82)]">Base</p>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full border border-[rgba(248,214,148,0.34)] bg-[rgba(19,32,26,0.72)]">
                <div
                  className="ml-auto h-full rounded-full"
                  style={{
                    width: `${opponentBaseHpPct}%`,
                    background: "linear-gradient(270deg, #d9a85b, #ba6931)",
                  }}
                />
              </div>
            </div>

            <motion.div
              className={`absolute left-[21%] bottom-[14%] z-[6] aspect-[4/5] w-[clamp(120px,18vw,190px)] transition-all duration-300 ${
                characterActionSide === "player" ? "-translate-y-2 rotate-[-2deg]" : ""
              }`}
              animate={playerActionControls}
            >
              <div className="relative h-full w-full">
                <AnimatePresence>
                  {playerReaction && playerReactionSrc && hasPlayerReactionSprite && (
                    <motion.div
                      key={playerReaction.id}
                      className="pointer-events-none absolute -left-[5.6rem] top-6 z-20 md:-left-[6.2rem]"
                      initial={{ opacity: 0, y: 8, scale: 0.88 }}
                      animate={{ opacity: 1, y: [8, 0, -1], scale: [0.88, 1.04, 1] }}
                      exit={{ opacity: 0, y: -7, scale: 0.96 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div
                        className="relative rounded-[22px] border p-1.5"
                        style={{
                          borderColor: "rgba(248,214,148,0.58)",
                          background: "linear-gradient(150deg, rgba(255,249,235,0.98), rgba(246,228,195,0.98))",
                          boxShadow: "0 12px 22px rgba(0,0,0,0.28)",
                        }}
                      >
                        <div className="relative h-20 w-20 overflow-hidden rounded-[16px] border border-[rgba(111,58,40,0.16)] md:h-[5.5rem] md:w-[5.5rem]">
                          <Image
                            src={playerReactionSrc}
                            alt={`${playerCharacterId ?? "player"} ${playerReaction.expression} reaction`}
                            fill
                            sizes="(max-width: 768px) 80px, 88px"
                            className="object-cover object-center"
                            onError={() => markCharacterSpriteFailed(playerReactionSrc)}
                          />
                        </div>
                        <span
                          className="absolute -right-1 bottom-4 h-3.5 w-3.5 rotate-45 rounded-[2px] border-r border-b"
                          style={{
                            borderColor: "rgba(248,214,148,0.58)",
                            background: "rgba(246,228,195,0.98)",
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {hasPlayerSprite && playerSpriteSrc ? (
                  <Image
                    src={playerSpriteSrc}
                    alt={`${playerCharacterId ?? "player"} ${playerSpriteState} portrait`}
                    fill
                    sizes="(max-width: 768px) 130px, 200px"
                    className="object-contain object-center"
                    onError={() => markCharacterSpriteFailed(playerSpriteSrc)}
                  />
                ) : (
                  <div className="grid h-full place-items-center">
                    <span className="font-caprasimo text-7xl text-[rgba(255,244,221,0.9)] drop-shadow-[0_6px_14px_rgba(0,0,0,0.4)]">
                      {playerVisual.initial}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              className={`absolute right-[21%] bottom-[14%] z-[6] aspect-[4/5] w-[clamp(120px,18vw,190px)] transition-all duration-300 ${
                characterActionSide === "opponent" ? "-translate-y-2 rotate-[2deg]" : ""
              }`}
              animate={opponentActionControls}
            >
              <div className="relative h-full w-full">
                <AnimatePresence>
                  {opponentReaction && opponentReactionSrc && hasOpponentReactionSprite && (
                    <motion.div
                      key={opponentReaction.id}
                      className="pointer-events-none absolute -right-[5.6rem] top-6 z-20 md:-right-[6.2rem]"
                      initial={{ opacity: 0, y: 8, scale: 0.88 }}
                      animate={{ opacity: 1, y: [8, 0, -1], scale: [0.88, 1.04, 1] }}
                      exit={{ opacity: 0, y: -7, scale: 0.96 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div
                        className="relative rounded-[22px] border p-1.5"
                        style={{
                          borderColor: "rgba(248,214,148,0.58)",
                          background: "linear-gradient(150deg, rgba(255,249,235,0.98), rgba(246,228,195,0.98))",
                          boxShadow: "0 12px 22px rgba(0,0,0,0.28)",
                        }}
                      >
                        <div className="relative h-20 w-20 overflow-hidden rounded-[16px] border border-[rgba(111,58,40,0.16)] md:h-[5.5rem] md:w-[5.5rem]">
                          <Image
                            src={opponentReactionSrc}
                            alt={`${opponentCharacterId ?? "opponent"} ${opponentReaction.expression} reaction`}
                            fill
                            sizes="(max-width: 768px) 80px, 88px"
                            className="object-cover object-center"
                            onError={() => markCharacterSpriteFailed(opponentReactionSrc)}
                          />
                        </div>
                        <span
                          className="absolute -left-1 bottom-4 h-3.5 w-3.5 rotate-45 rounded-[2px] border-l border-t"
                          style={{
                            borderColor: "rgba(248,214,148,0.58)",
                            background: "rgba(246,228,195,0.98)",
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {hasOpponentSprite && opponentSpriteSrc ? (
                  <Image
                    src={opponentSpriteSrc}
                    alt={`${opponentCharacterId ?? "opponent"} ${opponentSpriteState} portrait`}
                    fill
                    sizes="(max-width: 768px) 130px, 200px"
                    className="object-contain object-center -scale-x-100"
                    onError={() => markCharacterSpriteFailed(opponentSpriteSrc)}
                  />
                ) : (
                  <div className="grid h-full place-items-center">
                    <span className="font-caprasimo text-7xl text-[rgba(255,244,221,0.9)] drop-shadow-[0_6px_14px_rgba(0,0,0,0.4)]">
                      {opponentVisual.initial}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            {projectile && (
              <motion.div
                key={projectile.id}
                className="pointer-events-none absolute left-1/2 top-[42%] z-[12] h-12 w-12 -translate-x-1/2 -translate-y-1/2"
                initial={{
                  x: projectile.from === "player" ? -180 : 180,
                  y: projectile.from === "player" ? 40 : -40,
                  opacity: 0.22,
                  scale: 0.72,
                }}
                animate={{
                  x: projectile.to === "player" ? -210 : 210,
                  y: projectile.to === "player" ? 10 : -10,
                  opacity: 1,
                  scale: 1,
                }}
                transition={{ duration: 0.42, ease: [0.2, 1, 0.3, 1] }}
              >
                <div className="relative h-full w-full">
                  <div
                    className="absolute inset-0 rounded-full blur-[7px]"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(248,214,148,0.62) 0%, rgba(248,214,148,0.28) 46%, rgba(248,214,148,0) 76%)",
                    }}
                  />
                  {projectile.src && !failedProjectileSprites[projectile.src] ? (
                    <Image
                      src={projectile.src}
                      alt="Projectile effect"
                      fill
                      sizes="48px"
                      className="object-contain object-center drop-shadow-[0_0_8px_rgba(248,214,148,0.38)]"
                      onError={() => markProjectileSpriteFailed(projectile.src!)}
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center">
                      <span className="font-caprasimo text-lg text-[var(--tone-cream)] drop-shadow-[0_0_8px_rgba(248,214,148,0.5)]">
                        {"\u2726"}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

          </div>

          <div className="relative z-20 shrink-0 pb-5 pt-1">
              <p className="mb-2 text-center font-gabarito text-sm text-[rgba(244,240,230,0.86)]">
                {isPlayable ? "Pick a card from your hand." : "Waiting for server state..."}
              </p>

              <div className="mx-auto flex max-w-4xl items-end justify-center gap-2 md:gap-3">
                {Array.from({ length: displaySlots }).map((_, index) => {
                  const card = hand[index] ?? null;
                  const active = card ? activeCardId === card.id : false;
                  const transformClass = getCardTransform(index);
                  const cardDisabled = !card || !isPlayable || Boolean(activeCardId) || isMatchComplete;
                  return (
                    <button
                      key={card?.id ?? `placeholder-${index}`}
                      type="button"
                      onClick={() => {
                        if (card) onOpenCard(card);
                      }}
                      disabled={cardDisabled}
                      className={`relative aspect-[5/7] w-[17vw] min-w-[66px] max-w-[132px] overflow-hidden rounded-[20px] px-2 py-2 text-left transition ${transformClass}`}
                      style={{
                        border: active ? "2px solid rgba(248,214,148,0.95)" : "2px solid rgba(111,58,40,0.52)",
                        background: cardDisabled
                          ? "linear-gradient(165deg, rgba(228,210,181,0.84) 0%, rgba(205,183,156,0.84) 100%)"
                          : "linear-gradient(165deg, #fff7e6 0%, #f6dfbd 100%)",
                        opacity: cardDisabled ? 0.68 : 1,
                        boxShadow: active
                          ? "0 0 0 2px rgba(248,214,148,0.25), 0 16px 28px rgba(0,0,0,0.34)"
                          : "0 12px 22px rgba(0,0,0,0.3)",
                      }}
                    >
                      <div
                        className="pointer-events-none absolute inset-[8%] rounded-2xl"
                        style={{
                          border: "1px solid rgba(111,58,40,0.24)",
                          background:
                            "radial-gradient(circle at 25% 20%, rgba(255,255,255,0.38), transparent 44%), linear-gradient(150deg, rgba(255,245,226,0.64), rgba(241,217,181,0.68))",
                        }}
                      />
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background:
                            "repeating-linear-gradient(135deg, rgba(111,58,40,0.08) 0 6px, rgba(111,58,40,0) 6px 14px)",
                        }}
                      />
                      {card && (
                        <span
                          className="absolute left-1/2 top-[18%] -translate-x-1/2 rounded-full px-2 py-0.5 font-gabarito text-[10px] font-extrabold uppercase tracking-[0.12em]"
                          style={{
                            color: card.type === "heal" ? "#214335" : "#6f3a28",
                            background: card.type === "heal" ? "rgba(216,234,212,0.82)" : "rgba(248,214,148,0.82)",
                            border: "1px solid rgba(111,58,40,0.22)",
                          }}
                        >
                          {card.type === "heal" ? "Heal" : "Attack"}
                        </span>
                      )}
                      <span
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-caprasimo text-4xl"
                        style={{ color: cardDisabled ? "rgba(111,58,40,0.48)" : "rgba(111,58,40,0.82)" }}
                      >
                        ?
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
        </section>
      </div>

      {showRoomGateModal && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(2,6,5,0.62)] p-4 backdrop-blur-[1px]">
          <div
            className="frame-cut w-full max-w-md p-4 md:p-5"
            style={{ border: "1px solid rgba(248,214,148,0.38)", background: "rgba(13,24,20,0.94)" }}
          >
            <p className="font-caprasimo text-3xl text-[var(--tone-cream)] md:text-4xl">{roomGateTitle}</p>
            <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.84)]">{roomGateMessage}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {hasSocketIssue && (
                <button
                  type="button"
                  onClick={reconnect}
                  className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                  style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
                >
                  Rejoin Room
                </button>
              )}
              <Link
                href={cleanLobbyHref}
                onClick={clearLobbyReturnState}
                className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
              >
                Return To Lobby
              </Link>
            </div>
          </div>
        </div>
      )}

      {showDisconnectedOverlay && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(2,6,5,0.82)] p-4 backdrop-blur-[1px]">
          <div
            className="frame-cut w-full max-w-lg p-5 md:p-6"
            style={{ border: "1px solid rgba(248,214,148,0.42)", background: "rgba(13,24,20,0.96)" }}
          >
            <p className="font-caprasimo text-3xl text-[var(--tone-cream)] md:text-4xl">You were disconnected</p>
            <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.86)]">
              Your match is still active. Rejoin to continue, or surrender to end the match.
            </p>
            {pendingSurrenderAfterReconnect && (
              <p className="mt-2 font-gabarito text-xs text-[rgba(244,240,230,0.76)]">
                Rejoining room to submit surrender...
              </p>
            )}
            {!canSurrenderByState && (
              <p className="mt-2 font-gabarito text-xs text-[rgba(244,240,230,0.76)]">
                Surrender is only available after the match is committed.
              </p>
            )}
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={reconnect}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
              >
                Rejoin Room
              </button>
              <button
                type="button"
                onClick={onConfirmSurrender}
                disabled={!canSurrenderByState || pendingSurrenderAfterReconnect}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide disabled:opacity-50"
                style={{ border: "1px solid rgba(186,105,49,0.42)", color: "var(--tone-cream)", background: "rgba(77,42,24,0.92)" }}
              >
                Surrender
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCard && status === "playing" && !isMatchComplete && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(7,12,10,0.65)] p-4">
          <div
            className="relative w-full max-w-xl overflow-hidden rounded-[28px] p-4 md:p-5"
            style={{
              border: "2px solid rgba(248,214,148,0.45)",
              background: "linear-gradient(150deg, #fff6e4 0%, #f3ddb9 100%)",
              boxShadow: "0 24px 42px rgba(0,0,0,0.36)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.38), transparent 42%), radial-gradient(circle at 85% 86%, rgba(111,58,40,0.08), transparent 45%)",
              }}
            />
            <div className="mb-2 flex items-center justify-between">
              <p className="font-gabarito text-[11px] uppercase tracking-[0.18em] text-[#6d8373]">Question</p>
              <p className="font-caprasimo text-4xl text-[#ba6931]">{displaySecondsLeft}</p>
            </div>

            <p className="font-gabarito text-lg font-semibold leading-relaxed text-[#1f2b24]">
              {activeCard.question.text}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {activeCard.question.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={answerLocked}
                  onClick={() => onAnswer(option.id)}
                  className="relative overflow-hidden rounded-2xl px-3 py-3 text-left transition hover:-translate-y-0.5 disabled:opacity-65"
                  style={{
                    border: "2px solid rgba(111,58,40,0.3)",
                    background: "linear-gradient(160deg, rgba(255,250,239,0.96), rgba(243,224,191,0.96))",
                    boxShadow: "0 8px 14px rgba(77,42,24,0.14)",
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(circle at 18% 16%, rgba(255,255,255,0.34), transparent 38%), linear-gradient(180deg, rgba(255,255,255,0.1), rgba(111,58,40,0.03))",
                    }}
                  />
                  <p className="font-gabarito text-xs font-bold uppercase tracking-wider text-[#6d8373]">
                    {option.id}
                  </p>
                  <p className="mt-1 font-gabarito text-sm text-[#1f2b24]">{option.text}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {surrenderModalOpen && canSurrenderMatch && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(2,6,5,0.82)] p-4">
          <div
            className="frame-cut w-full max-w-lg p-5 md:p-6"
            style={{ border: "1px solid rgba(248,214,148,0.42)", background: "rgba(13,24,20,0.96)" }}
          >
            <p className="font-caprasimo text-3xl text-[var(--tone-cream)] md:text-4xl">Surrender match?</p>
            <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.86)]">
              Surrendering means you forfeit this match. Your rival will receive the wager after settlement. You will return to lobby.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSurrenderModalOpen(false)}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
              >
                Keep Playing
              </button>
              <button
                type="button"
                onClick={onConfirmSurrender}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(186,105,49,0.42)", color: "var(--tone-cream)", background: "rgba(77,42,24,0.92)" }}
              >
                Surrender
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isMatchComplete && (
          <motion.div
            key="match-result-backdrop"
            className="fixed inset-0 z-50 grid place-items-center bg-[rgba(2,6,5,0.82)] p-4 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              key="match-result-card"
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="frame-cut w-full max-w-xl p-5 md:p-6"
            style={{
              border: "1px solid rgba(248,214,148,0.42)",
              background:
                "radial-gradient(circle at top, rgba(255,243,215,0.9) 0%, rgba(247,227,190,0.9) 34%, rgba(239,213,170,0.95) 100%)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
            }}
          >
            <div className="text-center">
              <p className="font-caprasimo text-5xl leading-none text-[#1f2b24] md:text-6xl">{settlementText}</p>
              <p className="mt-2 font-gabarito text-sm text-[#4f6759]">{settlementSubtitle}</p>
              <div className="mt-3 flex justify-center">
                <span
                  className="rounded-full px-3 py-1 font-gabarito text-[10px] font-extrabold uppercase tracking-[0.14em]"
                  style={settlementStatusStyle}
                >
                  {settlementStatus}
                </span>
              </div>
              {showWinnerLine && (
                <p className="mt-2 font-gabarito text-xs text-[#5e7768]">Winner: {shortenAddress(winnerAddress ?? "")}</p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div
                className="frame-cut frame-cut-sm p-3 text-center"
                style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,248,236,0.92)" }}
              >
                <p className="font-gabarito text-[10px] uppercase tracking-[0.12em] text-[#6d8373]">Your Rounds</p>
                <p className="font-caprasimo text-3xl text-[#274137]">{playerRoundsWon}</p>
              </div>
              <div
                className="frame-cut frame-cut-sm p-3 text-center"
                style={{ border: "1px solid rgba(111,58,40,0.2)", background: "rgba(255,248,236,0.92)" }}
              >
                <p className="font-gabarito text-[10px] uppercase tracking-[0.12em] text-[#6d8373]">Opponent Rounds</p>
                <p className="font-caprasimo text-3xl text-[#6f3a28]">{opponentRoundsWon}</p>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              <div
                className="frame-cut frame-cut-sm p-2 text-center"
                style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#edf4eb" }}
              >
                <p className="font-gabarito text-[10px] uppercase tracking-[0.12em] text-[#6d8373]">Correct</p>
                <p className="font-caprasimo text-2xl text-[#274137]">{correctCount}</p>
              </div>
              <div
                className="frame-cut frame-cut-sm p-2 text-center"
                style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#f6eee0" }}
              >
                <p className="font-gabarito text-[10px] uppercase tracking-[0.12em] text-[#6d8373]">Timeout</p>
                <p className="font-caprasimo text-2xl text-[#6f3a28]">{timeoutCount}</p>
              </div>
              <div
                className="frame-cut frame-cut-sm p-2 text-center"
                style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#f4e8e2" }}
              >
                <p className="font-gabarito text-[10px] uppercase tracking-[0.12em] text-[#6d8373]">Wrong</p>
                <p className="font-caprasimo text-2xl text-[#7c4a36]">{wrongCount}</p>
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setSettlementDetailsOpen((prev) => !prev)}
                className="font-gabarito text-xs font-bold uppercase tracking-[0.14em] text-[#4f6759] underline decoration-dotted underline-offset-2"
              >
                {settlementDetailsOpen ? "Hide Settlement Details" : "Show Settlement Details"}
              </button>
            </div>

            {settlementDetailsOpen && (
              <div
                className="mt-2 frame-cut frame-cut-sm space-y-1 p-3"
                style={{ border: "1px solid rgba(39,65,55,0.16)", background: "rgba(255,248,236,0.95)" }}
              >
                <p className="font-gabarito text-xs font-bold uppercase tracking-[0.1em] text-[#274137]">
                  Settlement Details
                </p>
                {settlementResult ? (
                  <>
                    <p className="font-gabarito text-xs text-[#5e7768]">
                      Result signed by backend oracle and submitted by backend settlement flow.
                    </p>
                    <p className="break-all font-gabarito text-[11px] text-[#5e7768]">Match ID: {settlementResult.matchId}</p>
                    <p className="break-all font-gabarito text-[11px] text-[#5e7768]">
                      Server Pubkey: {settlementResult.serverPublicKey}
                    </p>
                    <p className="break-all font-gabarito text-[11px] text-[#5e7768]">
                      Settlement Signature: {settlementResult.settlementSignature}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-gabarito text-xs text-[#5e7768]">
                      Waiting for server settlement payload...
                    </p>
                    <p className="break-all font-gabarito text-[11px] text-[#5e7768]">Match ID: unavailable</p>
                    <p className="break-all font-gabarito text-[11px] text-[#5e7768]">Server Pubkey: unavailable</p>
                    <p className="break-all font-gabarito text-[11px] text-[#5e7768]">
                      Settlement Signature: unavailable
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setShareModalOpen(true)}
                className="frame-cut frame-cut-sm px-5 py-3 font-gabarito text-sm font-black uppercase tracking-[0.08em] transition hover:-translate-y-0.5"
                style={{
                  border: "1px solid rgba(111,58,40,0.26)",
                  color: "#fff8e9",
                  background: "linear-gradient(160deg, #6f3a28 0%, #95512f 100%)",
                  boxShadow: "0 10px 14px rgba(64,29,20,0.24)",
                }}
              >
                Blink Share
              </button>
              <Link
                href="/lobby"
                onClick={clearLobbyReturnState}
                className="frame-cut frame-cut-sm px-5 py-3 text-center font-gabarito text-sm font-black uppercase tracking-[0.08em] transition hover:-translate-y-0.5"
                style={{
                  border: "1px solid rgba(39,65,55,0.22)",
                  color: "#274137",
                  background: "rgba(255,248,236,0.96)",
                  boxShadow: "0 10px 14px rgba(33,67,53,0.16)",
                }}
              >
                Back To Lobby
              </Link>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {shareModalOpen && isMatchComplete && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-[rgba(7,12,10,0.72)] p-4">
          <div className="relative w-full max-w-3xl">
            <button
              type="button"
              onClick={() => setShareModalOpen(false)}
              className="absolute right-1 top-1 z-10 frame-cut frame-cut-sm px-2 py-1 font-gabarito text-xs font-extrabold uppercase tracking-wide"
              style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "rgba(255,248,236,0.95)" }}
            >
              Close
            </button>
            <ChallengeShareCard
              title="Challenge Me"
              challengerName="You"
              challengerAddress={address}
              arenaLabel={arenaLabel}
              token={arenaToken}
              wagerUsd={wagerUsd}
              challengeLink={challengeLink}
              description={challengeDescription}
              statusLabel={challengeStatusLabel}
              onCopy={onCopyChallengeLink}
              onSaveJpg={onSaveChallengeJpg}
              onShareX={onShareChallengeToX}
              notice={shareNotice}
            />
          </div>
        </div>
      )}
    </main>
  );
}
