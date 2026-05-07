"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
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
const ARENA_TOKEN_BY_ID: Record<string, string> = {
  sol: "SOL",
  bonk: "BONK",
};

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
    return "05:00";
  }
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
  kind: "attack" | "heal";
};

type BaseFxState = "idle" | "hit" | "heal";
type CharacterSpriteState = "stay" | "action";

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
  const scientistId = searchParams.get("scientist");
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
    lastDamageEvent,
    lastPlayResult,
    lastCardCountdown,
    lastCardExpired,
    currentPhase,
    openCard,
    playCard,
    confirmDeposit,
    reconnect,
  } = useMatchSocket({ roomId, address, characterId: scientistId ?? "einstein" });

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(ANSWER_TIME_SEC);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [enemyEventText, setEnemyEventText] = useState<string | null>(null);
  const [characterActionSide, setCharacterActionSide] = useState<BattleSide | null>(null);
  const [projectile, setProjectile] = useState<ProjectileState | null>(null);
  const [playerBaseFx, setPlayerBaseFx] = useState<BaseFxState>("idle");
  const [opponentBaseFx, setOpponentBaseFx] = useState<BaseFxState>("idle");
  const [outcomes, setOutcomes] = useState<MatchOutcome[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});
  const [shareNotice, setShareNotice] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [settlementDetailsOpen, setSettlementDetailsOpen] = useState(false);
  const [phaseToastVisible, setPhaseToastVisible] = useState(false);
  const [failedCharacterSprites, setFailedCharacterSprites] = useState<Record<string, true>>({});

  const pendingCardIdRef = useRef<string | null>(null);
  const lastProcessedPlayAtRef = useRef(0);
  const lastProcessedExpiredAtRef = useRef(0);
  const lastDamageTimestampRef = useRef(0);
  const depositConfirmedRef = useRef(false);
  const extraPointShownRef = useRef(false);
  const playerActionControls = useAnimationControls();
  const opponentActionControls = useAnimationControls();

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
    setEnemyEventText("Time up. Card expired.");
    setActiveCardId(null);
    setAnswerLocked(false);
    pendingCardIdRef.current = null;
  }, [lastCardExpired]);

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
    setEnemyEventText(lastPlayResult.correct ? "Nice hit!" : "No damage this turn.");
    setActiveCardId(null);
    setAnswerLocked(false);
    pendingCardIdRef.current = null;
  }, [lastPlayResult]);

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

    setCharacterActionSide(attackerSide);
    setProjectile({
      id: `${lastDamageEvent.timestamp}`,
      from: attackerSide,
      to: targetSide,
      kind: actionKind,
    });
    setEnemyEventText(
      attackerSide === "player"
        ? actionKind === "heal"
          ? "You healed your base!"
          : "You attacked!"
        : actionKind === "heal"
          ? "Opponent healed!"
          : "Opponent attacked!",
    );

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

    return () => {
      clearTimeout(actionResetTimer);
      clearTimeout(projectileHitTimer);
      clearTimeout(baseFxResetTimer);
    };
  }, [lastDamageEvent, opponent?.address, player?.address]);

  const isPlayable = status === "playing" && connectionState === "connected";
  const isMatchComplete = Boolean(settlementResult) || Boolean(matchInvalidated) || status === "finished";

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

  const playerScore = player?.score ?? 0;
  const opponentScore = opponent?.score ?? 0;
  const playerRoundsWon = player?.roundsWon ?? 0;
  const opponentRoundsWon = opponent?.roundsWon ?? 0;
  const playerBaseHp = player?.baseHealth ?? 100;
  const opponentBaseHp = opponent?.baseHealth ?? 100;

  const correctCount = outcomes.filter((item) => item.outcome === "correct").length;
  const timeoutCount = outcomes.filter((item) => item.outcome === "timeout").length;
  const wrongCount = outcomes.filter((item) => item.outcome === "wrong").length;

  const winnerAddress =
    settlementResult?.winner ?? matchSummaryResult?.winnerAddress ?? matchInvalidated?.winnerAddress ?? null;
  const settlementText = winnerAddress
    ? winnerAddress === player?.address
      ? "You Win"
      : "You Lose"
    : matchInvalidated
      ? "Match Invalidated"
      : "Match Finished";
  const settlementSubtitle = matchInvalidated
    ? "Match invalidated."
    : winnerAddress
      ? winnerAddress === address
        ? "Victory secured."
        : "Rival took this round."
      : "Match results are being finalized."
  const settlementStatus = matchInvalidated ? "Invalidated" : settlementResult ? "Settled" : "Pending";
  const settlementStatusStyle = matchInvalidated
    ? { color: "#8a3f2b", background: "rgba(185,96,62,0.14)", border: "1px solid rgba(138,63,43,0.34)" }
    : settlementResult
      ? { color: "#214335", background: "rgba(103,149,123,0.18)", border: "1px solid rgba(33,67,53,0.28)" }
      : { color: "#6f3a28", background: "rgba(214,174,119,0.2)", border: "1px solid rgba(111,58,40,0.25)" };
  const showWinnerLine = Boolean(winnerAddress && (matchInvalidated || winnerAddress !== address));
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
  const socketCloseText = lastSocketCloseInfo
    ? `Close code ${lastSocketCloseInfo.code}${lastSocketCloseInfo.reason ? `: ${lastSocketCloseInfo.reason}` : ""}`
    : null;
  const isPlayStateReady = status === "playing" || status === "settling" || isMatchComplete;
  const shouldShowPlayStateGate = !isPlayStateReady;
  const opponentIdentityLabel = opponent?.address
    ? shortenAddress(opponent.address)
    : isRoomStateLoading
      ? "Syncing..."
      : "Unknown";
  const opponentMetaLabel = opponent?.address
    ? `Score ${opponentScore} - Rounds ${opponentRoundsWon}`
    : "Waiting for opponent metadata";
  const playerCharacterId = player?.characterId ?? scientistId ?? undefined;
  const opponentCharacterId = opponent?.characterId ?? undefined;
  const playerVisual = getCharacterVisual(playerCharacterId);
  const opponentVisual = getCharacterVisual(opponentCharacterId);
  const playerSpriteState = resolveCharacterSpriteState(player?.characterState, characterActionSide === "player");
  const opponentSpriteState = resolveCharacterSpriteState(opponent?.characterState, characterActionSide === "opponent");
  const playerSpriteSrc = getCharacterSpriteSrc(playerCharacterId, playerSpriteState);
  const opponentSpriteSrc = getCharacterSpriteSrc(opponentCharacterId, opponentSpriteState);
  const hasPlayerSprite = Boolean(playerSpriteSrc && !failedCharacterSprites[playerSpriteSrc]);
  const hasOpponentSprite = Boolean(opponentSpriteSrc && !failedCharacterSprites[opponentSpriteSrc]);
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
  const resumeQueueHref = useMemo(() => {
    const params = new URLSearchParams({ resumeQueue: "1", arena: arenaId });
    if (scientistId) {
      params.set("scientist", scientistId);
    }
    return `/lobby?${params.toString()}`;
  }, [arenaId, scientistId]);
  const historyHref = useMemo(() => {
    const params = new URLSearchParams({
      scope: address ? "wallet" : "arena",
      arena: arenaId,
      token: arenaToken,
    });
    if (address) {
      params.set("address", address);
    }
    return `/history?${params.toString()}`;
  }, [address, arenaId, arenaToken]);

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
    setPhaseToastVisible(true);
    const timerId = setTimeout(() => {
      setPhaseToastVisible(false);
    }, 5000);
    return () => clearTimeout(timerId);
  }, [currentPhase, gameState?.timer?.phase]);

  const alerts: UiAlert[] = [];
  const socketMessage = socketCloseText ?? lastSocketError ?? "Socket disconnected from match server.";
  if (lastSocketIssueAt) {
    alerts.push({
      id: `socket:${lastSocketIssueAt}`,
      title: "Server Connection Issue",
      message: socketMessage,
      tone: "error",
      autoDismissMs: SOCKET_ALERT_DISPLAY_MS,
      actionLabel: hasSocketIssue ? "Retry" : undefined,
      onAction: hasSocketIssue ? reconnect : undefined,
    });
  }
  if (connectionState === "reconnecting") {
    alerts.push({
      id: "socket:reconnecting",
      title: "Reconnecting",
      message: "Restoring room connection. Keep this page open.",
      tone: "warning",
      autoDismissMs: 0,
    });
  }

  const missingPreSignedDeposit = status === "depositing" && connectionState === "connected" && !preSignedDepositSig;
  if (missingPreSignedDeposit) {
    alerts.push({
      id: "deposit:missing_pre_signed_intent",
      title: "Deposit Sync Error",
      message: "Missing pre-signed deposit intent. Return to lobby and re-queue.",
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
        {phaseToastVisible && (
          <div className="frame-cut px-3 py-2" style={{ border: "1px solid rgba(248,214,148,0.35)", background: "rgba(13,24,20,0.92)" }}>
            <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[var(--tone-cream)]">
              Extra Point Activated
            </p>
            <p className="mt-1 font-gabarito text-xs text-[rgba(244,240,230,0.82)]">
              Phase changed. Card effects are now x2.
            </p>
          </div>
        )}
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

      <div className="mx-auto flex min-h-[calc(100svh-2rem)] w-full max-w-7xl flex-col">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-gabarito text-xs uppercase tracking-[0.18em] text-[var(--tone-cream)]/85">
            Battle Room - {roomId}
          </p>
          <div className="flex items-center gap-2">
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
            <Link
              href={resumeQueueHref}
              className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-xs font-bold uppercase tracking-wide"
              style={{ border: "1px solid rgba(248,214,148,0.32)", background: "rgba(19,32,26,0.86)", color: "var(--tone-cream)" }}
            >
              Exit
            </Link>
          </div>
        </header>

        {isRoomStateLoading && (
          <div className="mb-3 frame-cut p-3" style={{ border: "1px solid rgba(248,214,148,0.32)", background: "rgba(13,24,20,0.9)" }}>
            <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[var(--tone-cream)]">
              Syncing room state
            </p>
            <p className="mt-1 font-gabarito text-xs text-[rgba(244,240,230,0.82)]">
              Rejoining battle room after refresh. Waiting for server snapshot.
            </p>
          </div>
        )}

        {hasSocketIssue && !gameState && (
          <div className="mb-3 frame-cut p-3" style={{ border: "1px solid rgba(186,105,49,0.4)", background: "rgba(43,24,16,0.88)" }}>
            <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[#f8d694]">
              Unable to enter battle room
            </p>
            <p className="mt-1 font-gabarito text-xs text-[rgba(244,240,230,0.82)]">
              Connection to this match room failed. Retry socket or return to lobby queue without refreshing.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={reconnect}
                className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
              >
                Retry Room
              </button>
              <Link
                href={resumeQueueHref}
                className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
              >
                Return And Requeue
              </Link>
            </div>
          </div>
        )}

        {shouldShowPlayStateGate && (
          <div className="mb-3 frame-cut p-3" style={{ border: "1px solid rgba(248,214,148,0.32)", background: "rgba(13,24,20,0.9)" }}>
            <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[var(--tone-cream)]">
              Room not in playing state yet
            </p>
            <p className="mt-1 font-gabarito text-xs text-[rgba(244,240,230,0.82)]">
              Current room status: {getStatusLabel(status)}. Keep this page open or return to lobby and resume queue.
            </p>
            <div className="mt-2 flex gap-2">
              {hasSocketIssue && (
                <button
                  type="button"
                  onClick={reconnect}
                  className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                  style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
                >
                  Retry Room
                </button>
              )}
              <Link
                href={resumeQueueHref}
                className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
              >
                Return And Requeue
              </Link>
            </div>
          </div>
        )}

        <section
          className="frame-cut relative flex flex-1 flex-col overflow-hidden px-4 py-5 md:px-6"
          style={{
            border: "1px solid rgba(248,214,148,0.28)",
            background:
              "radial-gradient(circle at 50% 18%, rgba(248,214,148,0.16), transparent 45%), linear-gradient(160deg, rgba(12,21,17,0.92), rgba(17,29,24,0.94))",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-caprasimo text-3xl text-[var(--tone-cream)]">You</p>
              <p className="font-gabarito text-xs text-[rgba(244,240,230,0.78)]">Score {playerScore} - Rounds {playerRoundsWon}</p>
              {address && (
                <p className="mt-1 font-mono text-[11px] text-[rgba(244,240,230,0.74)]">{shortenAddress(address)}</p>
              )}
            </div>
            <p className="font-caprasimo text-5xl text-[var(--tone-cream)] drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]">VS</p>
            <div className="text-right">
              <p className="font-caprasimo text-3xl text-[var(--tone-cream)]">Rival</p>
              <p className="mt-1 font-gabarito text-[11px] text-[rgba(244,240,230,0.78)]">{opponentIdentityLabel}</p>
              <p className="font-gabarito text-xs text-[rgba(244,240,230,0.78)]">{opponentMetaLabel}</p>
            </div>
          </div>

          <div className="relative mt-4 flex-1 min-h-[420px]">
            <div className="absolute left-0 top-2 flex flex-col items-start gap-2">
              <div
                className="grid aspect-square w-24 place-items-center overflow-hidden rounded-xl border"
                style={{
                  borderColor: "rgba(248,214,148,0.36)",
                  background:
                    playerBaseFx === "hit"
                      ? "linear-gradient(150deg, rgba(124,55,38,0.92), rgba(62,31,21,0.95))"
                      : playerBaseFx === "heal"
                        ? "linear-gradient(150deg, rgba(39,93,52,0.92), rgba(24,58,34,0.95))"
                        : "linear-gradient(150deg, rgba(37,63,51,0.9), rgba(18,33,27,0.94))",
                  boxShadow:
                    playerBaseFx === "hit"
                      ? "0 0 0 2px rgba(186,105,49,0.45), 0 10px 20px rgba(0,0,0,0.35)"
                      : playerBaseFx === "heal"
                        ? "0 0 0 2px rgba(157,180,150,0.52), 0 10px 20px rgba(0,0,0,0.35)"
                        : "0 10px 20px rgba(0,0,0,0.35)",
                }}
              >
                <span className="font-caprasimo text-3xl text-[rgba(248,214,148,0.88)]">{playerVisual.baseGlyph}</span>
              </div>
              <div>
                <p className="font-gabarito text-[11px] uppercase tracking-wider text-[rgba(244,240,230,0.72)]">Base HP</p>
                <p className="font-caprasimo text-2xl text-[var(--tone-cream)]">{playerBaseHp}</p>
              </div>
            </div>

            <div className="absolute right-0 top-2 flex flex-col items-end gap-2">
              <div
                className="grid aspect-square w-24 place-items-center overflow-hidden rounded-xl border"
                style={{
                  borderColor: "rgba(248,214,148,0.36)",
                  background:
                    opponentBaseFx === "hit"
                      ? "linear-gradient(150deg, rgba(124,55,38,0.92), rgba(62,31,21,0.95))"
                      : opponentBaseFx === "heal"
                        ? "linear-gradient(150deg, rgba(39,93,52,0.92), rgba(24,58,34,0.95))"
                        : "linear-gradient(150deg, rgba(37,63,51,0.9), rgba(18,33,27,0.94))",
                  boxShadow:
                    opponentBaseFx === "hit"
                      ? "0 0 0 2px rgba(186,105,49,0.45), 0 10px 20px rgba(0,0,0,0.35)"
                      : opponentBaseFx === "heal"
                        ? "0 0 0 2px rgba(157,180,150,0.52), 0 10px 20px rgba(0,0,0,0.35)"
                        : "0 10px 20px rgba(0,0,0,0.35)",
                }}
              >
                <span className="font-caprasimo text-3xl text-[rgba(248,214,148,0.88)]">{opponentVisual.baseGlyph}</span>
              </div>
              <div className="text-right">
                <p className="font-gabarito text-[11px] uppercase tracking-wider text-[rgba(244,240,230,0.72)]">Base HP</p>
                <p className="font-caprasimo text-2xl text-[var(--tone-cream)]">{opponentBaseHp}</p>
              </div>
            </div>

            <motion.div
              className={`absolute left-[21%] top-[12%] aspect-[4/5] w-[clamp(130px,20vw,200px)] transition-all duration-300 ${
                characterActionSide === "player" ? "-translate-y-2 rotate-[-2deg]" : ""
              }`}
              animate={playerActionControls}
            >
              <div className="relative h-full w-full">
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
              className={`absolute right-[21%] top-[12%] aspect-[4/5] w-[clamp(130px,20vw,200px)] transition-all duration-300 ${
                characterActionSide === "opponent" ? "-translate-y-2 rotate-[2deg]" : ""
              }`}
              animate={opponentActionControls}
            >
              <div className="relative h-full w-full">
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
                className="pointer-events-none absolute left-1/2 top-[42%] h-10 w-10 -translate-x-1/2 -translate-y-1/2"
                initial={{
                  x: projectile.from === "player" ? -180 : 180,
                  y: projectile.from === "player" ? 40 : -40,
                  opacity: 0.25,
                  scale: 0.65,
                }}
                animate={{
                  x: projectile.to === "player" ? -210 : 210,
                  y: projectile.to === "player" ? 10 : -10,
                  opacity: 1,
                  scale: 1,
                }}
                transition={{ duration: 0.42, ease: [0.2, 1, 0.3, 1] }}
              >
                <div
                  className="grid h-full w-full place-items-center rounded-lg border"
                  style={{
                    borderColor: projectile.kind === "heal" ? "rgba(157,180,150,0.72)" : "rgba(248,214,148,0.7)",
                    background:
                      projectile.kind === "heal"
                        ? "linear-gradient(145deg, rgba(39,93,52,0.9), rgba(21,52,30,0.95))"
                        : "linear-gradient(145deg, rgba(122,69,41,0.9), rgba(77,42,24,0.95))",
                    boxShadow:
                      projectile.kind === "heal"
                        ? "0 0 18px rgba(157,180,150,0.48)"
                        : "0 0 18px rgba(248,214,148,0.44)",
                  }}
                >
                  <span className="font-caprasimo text-lg text-[var(--tone-cream)]">
                    {projectile.kind === "heal" ? "✚" : "✦"}
                  </span>
                </div>
              </motion.div>
            )}

            <div className="absolute bottom-0 left-1/2 w-full max-w-4xl -translate-x-1/2">
              <p className="mb-2 text-center font-gabarito text-sm text-[rgba(244,240,230,0.86)]">
                {enemyEventText ?? (isPlayable ? "Pick a card from your hand." : "Waiting for server state...")}
              </p>

              <div className="flex items-end justify-center gap-2 md:gap-3">
                {Array.from({ length: displaySlots }).map((_, index) => {
                  const card = hand[index] ?? null;
                  const active = card ? activeCardId === card.id : false;
                  const transformClass = getCardTransform(index);
                  return (
                    <button
                      key={card?.id ?? `placeholder-${index}`}
                      type="button"
                      onClick={() => {
                        if (card) onOpenCard(card);
                      }}
                      disabled={!card || !isPlayable || Boolean(activeCardId) || isMatchComplete}
                      className={`frame-cut relative w-[18vw] min-w-[70px] max-w-[140px] aspect-[5/7] px-2 py-2 text-left transition ${transformClass}`}
                      style={{
                        border: active ? "1px solid rgba(248,214,148,0.88)" : "1px solid rgba(111,58,40,0.42)",
                        background: "linear-gradient(160deg, #fff4dd 0%, #f1dfc1 100%)",
                        opacity: !card || !isPlayable ? 0.62 : 1,
                        boxShadow: "0 8px 16px rgba(0,0,0,0.28)",
                      }}
                    >
                      <span className="font-gabarito text-[10px] uppercase tracking-[0.16em] text-[#6d4f3a]">
                        {card ? card.type : "locked"}
                      </span>
                      <span className="absolute bottom-2 left-2 font-caprasimo text-3xl text-[#6f3a28]">?</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>

      {activeCard && status === "playing" && !isMatchComplete && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(7,12,10,0.65)] p-4">
          <div className="frame-cut w-full max-w-xl p-4 md:p-5" style={{ border: "1px solid rgba(248,214,148,0.36)", background: "linear-gradient(145deg, #fff4dd 0%, #f1dfc1 100%)" }}>
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
                  className="frame-cut px-3 py-3 text-left transition hover:-translate-y-0.5 disabled:opacity-65"
                  style={{ border: "1px solid rgba(111,58,40,0.26)", background: "rgba(255,248,236,0.95)" }}
                >
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

      {isMatchComplete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(2,6,5,0.82)] p-4 backdrop-blur-[1px]">
          <div
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

            <div className="mt-3">
              <Link
                href={historyHref}
                className="inline-flex frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-[0.12em]"
                style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "rgba(255,248,236,0.86)" }}
              >
                View History
              </Link>
            </div>
          </div>
        </div>
      )}

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
