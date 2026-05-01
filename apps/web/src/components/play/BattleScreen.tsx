"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { Card, GameStatus } from "@shared/websocket";
import { useMatchSocket } from "../../hooks/useMatchSocket";
import { signSettlementReleaseIntent } from "@/lib/solana/signDepositIntent";
import { HydratedWalletButton } from "@/components/wallet/HydratedWalletButton";
import { createChallengeLink, createChallengeTweetIntent } from "@/lib/challenge/createChallengeLink";
import { ChallengeShareCard } from "@/components/challenge/ChallengeShareCard";
import { createChallengeCardFileName, renderChallengeCardJpg } from "@/lib/challenge/renderChallengeCardJpg";
import { IntegrationModeBanner } from "@/components/ui/IntegrationModeBanner";
import { getRuntimeConfig, isIntegrationMode } from "@/lib/config/runtimeModes";

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
const ROUNDS_TO_WIN = 2;
const MAX_ROUNDS = ROUNDS_TO_WIN * 2 - 1;
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

function getOutcomeColor(outcome: MatchOutcome["outcome"]) {
  if (outcome === "correct") return "#d8ead4";
  if (outcome === "timeout") return "#efe8d5";
  return "#f2ddd4";
}

function getOutcomeLabel(outcome: MatchOutcome["outcome"]) {
  if (outcome === "correct") return "Correct";
  if (outcome === "timeout") return "Timeout";
  return "Wrong";
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

export function BattleScreen() {
  const runtimeConfig = getRuntimeConfig();
  const showIntegrationBanner = isIntegrationMode(runtimeConfig);
  const searchParams = useSearchParams();
  const roomIdParam = searchParams.get("roomId");
  const queryAddress = searchParams.get("address");
  const arenaIdParam = searchParams.get("arena");
  const tokenParam = searchParams.get("token");
  const wagerParam = searchParams.get("wager");
  const roomId = roomIdParam ?? "";
  const arenaId = arenaIdParam ?? "sol";
  const arenaToken = tokenParam ?? ARENA_TOKEN_BY_ID[arenaId] ?? "SOL";
  const wagerUsd = wagerParam ?? FIXED_WAGER_USD;
  const preSignedDepositSig = searchParams.get("depositSig");
  const scientistId = searchParams.get("scientist");
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey } = wallet;

  const devAddressFallbackEnabled = runtimeConfig.allowDevAddressFallback;
  const fallbackAddress =
    devAddressFallbackEnabled ? queryAddress ?? `dev-preview-${roomId}` : null;
  const address = publicKey?.toBase58() ?? fallbackAddress ?? "";
  const requiresWalletConnect = !address;
  const hasValidWagerParam = Number.isFinite(Number(wagerParam)) && Number(wagerParam) > 0;
  const playGuardError = !roomIdParam
    ? "Missing roomId. Return to lobby and enter the match from the found flow."
    : !arenaIdParam || !tokenParam || !hasValidWagerParam
      ? "Missing arena/token/wager match context. Return to lobby and re-queue."
      : null;

  const {
    connectionState,
    socketUrl,
    lastSocketError,
    lastSocketCloseInfo,
    lastSocketIssueAt,
    gameState,
    settlementResult,
    matchInvalidated,
    lastDamageEvent,
    lastPlayResult,
    lastCardCountdown,
    lastCardExpired,
    openCard,
    playCard,
    confirmDeposit,
    reconnect,
  } = useMatchSocket({ roomId, address });

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(ANSWER_TIME_SEC);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [enemyAttackFlash, setEnemyAttackFlash] = useState(false);
  const [enemyEventText, setEnemyEventText] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<MatchOutcome[]>([]);
  const [releaseState, setReleaseState] = useState<"idle" | "signing" | "submitting" | "success" | "error">("idle");
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseSignature, setReleaseSignature] = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});
  const [shareNotice, setShareNotice] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const pendingCardIdRef = useRef<string | null>(null);
  const lastProcessedPlayAtRef = useRef(0);
  const lastProcessedExpiredAtRef = useRef(0);
  const lastDamageTimestampRef = useRef(0);
  const depositConfirmedRef = useRef(false);

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

    const enemyAttacked = lastDamageEvent.attackerAddress !== player?.address;
    if (enemyAttacked) {
      setTimeout(() => {
        setEnemyAttackFlash(true);
        setEnemyEventText("Opponent attacked!");
        setTimeout(() => setEnemyAttackFlash(false), 420);
      }, 0);
      return;
    }
    setTimeout(() => {
      setEnemyEventText("You attacked!");
    }, 0);
  }, [lastDamageEvent, player?.address]);

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

  async function onConfirmFundRelease() {
    if (!settlementResult) return;
    if (releaseState === "signing" || releaseState === "submitting" || releaseState === "success") {
      return;
    }

    setReleaseError(null);

    const settlementMode = runtimeConfig.settlementMode;
    if (settlementMode === "mock") {
      setReleaseState("submitting");
      const mockSignature = `mock-release-${Date.now()}`;
      setReleaseSignature(mockSignature);
      setReleaseState("success");
      return;
    }

    if (!wallet.publicKey) {
      setReleaseState("error");
      setReleaseError("Connect wallet to confirm fund release.");
      return;
    }

    setReleaseState("signing");

    try {
      const signature = await signSettlementReleaseIntent({
        connection,
        wallet,
        matchId: settlementResult.matchId,
        winner: settlementResult.winner,
      });
      setReleaseState("submitting");
      setReleaseSignature(signature);
      setReleaseState("success");
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "";
      const lower = rawMessage.toLowerCase();
      const message = lower.includes("declined")
        ? "Wallet request declined. Approve release confirmation to continue."
        : lower.includes("insufficient")
          ? "Insufficient balance for fees. Top up wallet and retry."
          : "Release confirmation failed. Retry or return to lobby.";
      setReleaseState("error");
      setReleaseError(message);
    }
  }

  function getReleaseButtonLabel() {
    if (releaseState === "signing") return "Signing In Wallet...";
    if (releaseState === "submitting") return "Submitting Confirmation...";
    if (releaseState === "success") return "Release Confirmed";
    return "Confirm Fund Release";
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

  const settlementText = settlementResult
    ? settlementResult.winner === player?.address
      ? "You Win"
      : "You Lose"
    : matchInvalidated
      ? "Match Invalidated"
      : "Match Finished";
  const winnerAddress = settlementResult?.winner ?? matchInvalidated?.winnerAddress ?? null;
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
  const totalCompletedRounds = playerRoundsWon + opponentRoundsWon;
  const currentRound = isMatchComplete
    ? Math.min(MAX_ROUNDS, Math.max(1, totalCompletedRounds))
    : Math.min(MAX_ROUNDS, totalCompletedRounds + 1);
  const roundText = `Round ${currentRound}/${MAX_ROUNDS}`;
  const remainingMatchClock = formatMatchClock(gameState?.timer?.remainingMs);
  const hasSocketIssue = connectionState === "error" || connectionState === "disconnected";
  const socketCloseText = lastSocketCloseInfo
    ? `Close code ${lastSocketCloseInfo.code}${lastSocketCloseInfo.reason ? `: ${lastSocketCloseInfo.reason}` : ""}`
    : null;
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

  useEffect(() => {
    if (status !== "depositing" || connectionState !== "connected") return;
    if (depositConfirmedRef.current) return;
    if (!preSignedDepositSig) return;

    confirmDeposit(preSignedDepositSig);
    depositConfirmedRef.current = true;
  }, [status, connectionState, preSignedDepositSig, confirmDeposit]);
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

  if (releaseError) {
    alerts.push({
      id: `release:${releaseError}`,
      title: "Settlement Error",
      message: releaseError,
      tone: "warning",
      autoDismissMs: 12000,
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
    if (alert.id.startsWith("release:")) {
      setReleaseError(null);
      setReleaseState("idle");
    }
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
          backgroundColor: "#f5f1e8",
          backgroundImage:
            "linear-gradient(rgba(39,65,55,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(39,65,55,0.05) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      >
        {showIntegrationBanner && (
          <IntegrationModeBanner
            depositMode={runtimeConfig.depositMode}
            settlementMode={runtimeConfig.settlementMode}
          />
        )}
        <div className="frame-cut w-full max-w-lg p-5 text-center" style={{ border: "1px solid rgba(186,105,49,0.32)", background: "#fffdfa" }}>
          <p className="font-caprasimo text-3xl text-[#1f2b24]">Match Context Missing</p>
          <p className="mt-2 font-gabarito text-sm text-[#73512d]">{playGuardError}</p>
          <div className="mt-4">
            <Link
              href="/lobby"
              className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
              style={{ border: "1px solid rgba(39,65,55,0.22)", color: "#274137", background: "rgba(255,255,255,0.9)" }}
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
          backgroundColor: "#f5f1e8",
          backgroundImage:
            "linear-gradient(rgba(39,65,55,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(39,65,55,0.05) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      >
        {showIntegrationBanner && (
          <IntegrationModeBanner
            depositMode={runtimeConfig.depositMode}
            settlementMode={runtimeConfig.settlementMode}
          />
        )}
        <div className="frame-cut w-full max-w-md p-5 text-center" style={{ border: "1px solid rgba(39,65,55,0.22)", background: "#fffdfa" }}>
          <p className="font-caprasimo text-3xl text-[#1f2b24]">Wallet Required</p>
          <p className="mt-2 font-gabarito text-sm text-[#4f6759]">
            Connect Phantom to enter battle and sign match deposit.
          </p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <HydratedWalletButton />
            <Link
              href="/lobby"
              className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
              style={{ border: "1px solid rgba(39,65,55,0.22)", color: "#274137", background: "rgba(255,255,255,0.9)" }}
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
        backgroundColor: "#f5f1e8",
        backgroundImage:
          "linear-gradient(rgba(39,65,55,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(39,65,55,0.05) 1px, transparent 1px)",
        backgroundSize: "42px 42px",
      }}
    >
      {showIntegrationBanner && (
        <IntegrationModeBanner
          depositMode={runtimeConfig.depositMode}
          settlementMode={runtimeConfig.settlementMode}
        />
      )}
      <div className="fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-2 md:right-6 md:top-6">
        {visibleAlerts.map((alert) => (
          <div
            key={alert.id}
            className="frame-cut px-3 py-2"
            style={{
              border:
                alert.tone === "error"
                  ? "1px solid rgba(138,63,43,0.34)"
                  : "1px solid rgba(186,105,49,0.34)",
              background:
                alert.tone === "error"
                  ? "rgba(255,245,241,0.97)"
                  : "rgba(255,250,242,0.97)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <p
                className="font-gabarito text-xs font-bold uppercase tracking-wide"
                style={{ color: alert.tone === "error" ? "#8a3f2b" : "#8f5a1d" }}
              >
                {alert.title}
              </p>
              <button
                type="button"
                onClick={() => dismissAlert(alert)}
                className="font-gabarito text-xs font-bold leading-none text-[#7c4a36]"
                aria-label="Close alert"
              >
                X
              </button>
            </div>
            <p
              className="mt-1 break-words font-gabarito text-xs"
              style={{ color: alert.tone === "error" ? "#6f3a28" : "#73512d" }}
            >
              {alert.message}
            </p>
            {alert.id.startsWith("socket:") && socketUrl && (
              <p className="mt-1 break-all font-gabarito text-[11px] text-[#7c4a36]">
                {socketUrl}
              </p>
            )}
            <div className="mt-2 flex gap-2">
              {alert.actionLabel && alert.onAction && (
                <button
                  type="button"
                  onClick={alert.onAction}
                  className="frame-cut frame-cut-sm px-2 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                  style={{ border: "1px solid rgba(39,65,55,0.22)", color: "#274137", background: "#fffdfa" }}
                >
                  {alert.actionLabel}
                </button>
              )}
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[rgba(39,65,55,0.14)]">
              <div
                className="h-full"
                style={{
                  width: "100%",
                  background:
                    alert.tone === "error"
                      ? "linear-gradient(90deg,#c96d47,#8a3f2b)"
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
          <p className="font-gabarito text-xs uppercase tracking-[0.18em] text-[#5e7768]">
            Battle Room - {roomId}
          </p>
          <div className="flex items-center gap-2">
            <span
              className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-xs font-bold uppercase tracking-wide"
              style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.9)", color: "#274137" }}
            >
              {roundText}
            </span>
            <span
              className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-xs font-bold uppercase tracking-wide"
              style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.9)", color: "#274137" }}
            >
              {remainingMatchClock}
            </span>
            <span
              className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-xs font-bold uppercase tracking-wide"
              style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.9)", color: "#274137" }}
            >
              {getStatusLabel(status)} - {connectionState}
            </span>
            <Link
              href={resumeQueueHref}
              className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-xs font-bold uppercase tracking-wide"
              style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.9)", color: "#274137" }}
            >
              Exit
            </Link>
          </div>
        </header>

        {hasSocketIssue && !gameState && (
          <div className="mb-3 frame-cut p-3" style={{ border: "1px solid rgba(186,105,49,0.32)", background: "rgba(255,250,242,0.95)" }}>
            <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[#8f5a1d]">
              Unable to enter battle room
            </p>
            <p className="mt-1 font-gabarito text-xs text-[#73512d]">
              Connection to this match room failed. Retry socket or return to lobby queue without refreshing.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={reconnect}
                className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "#fffdfa" }}
              >
                Retry Room
              </button>
              <Link
                href={resumeQueueHref}
                className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "#fffdfa" }}
              >
                Return And Requeue
              </Link>
            </div>
          </div>
        )}

        <section
          className="frame-cut relative flex flex-1 flex-col overflow-hidden px-4 py-5 md:px-6"
          style={{ border: "1px solid rgba(39,65,55,0.18)", background: "rgba(255,255,255,0.84)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-caprasimo text-3xl text-[#1f2b24]">You</p>
              <p className="font-gabarito text-xs text-[#5e7768]">Score {playerScore} - Rounds {playerRoundsWon}</p>
            </div>
            <p className="font-caprasimo text-4xl text-[#7a8f82]">VS</p>
            <div className="text-right">
              <p className="font-caprasimo text-3xl text-[#1f2b24]">Opponent</p>
              <p className="font-gabarito text-[11px] text-[#5e7768]">{shortenAddress(opponent?.address)}</p>
              <p className="font-gabarito text-xs text-[#5e7768]">Score {opponentScore} - Rounds {opponentRoundsWon}</p>
            </div>
          </div>

          <div className="relative mt-5 flex-1">
            <div className="absolute left-0 top-6 flex items-start gap-3">
              <div
                className="frame-cut h-44 w-20"
                style={{ border: "1px solid rgba(39,65,55,0.2)", background: enemyAttackFlash ? "#f3e0d8" : "#ebe5d7" }}
              />
              <div>
                <p className="font-gabarito text-[11px] uppercase tracking-wider text-[#5e7768]">Base HP</p>
                <p className="font-caprasimo text-2xl text-[#274137]">{playerBaseHp}</p>
              </div>
            </div>

            <div className="absolute right-0 top-6 flex items-start gap-3">
              <div className="text-right">
                <p className="font-gabarito text-[11px] uppercase tracking-wider text-[#5e7768]">Base HP</p>
                <p className="font-caprasimo text-2xl text-[#6f3a28]">{opponentBaseHp}</p>
              </div>
              <div
                className="frame-cut h-44 w-20"
                style={{ border: "1px solid rgba(39,65,55,0.2)", background: enemyAttackFlash ? "#f3d8d0" : "#ebe5d7" }}
              />
            </div>

            <div className="absolute left-[22%] top-[22%] grid h-24 w-24 place-items-center rounded-full border border-[rgba(39,65,55,0.26)] bg-[rgba(255,255,255,0.88)]">
              <p className="font-gabarito text-sm font-semibold uppercase tracking-wider text-[#5e7768]">You</p>
            </div>

            <div className="absolute right-[22%] top-[22%] grid h-24 w-24 place-items-center rounded-full border border-[rgba(39,65,55,0.26)] bg-[rgba(255,255,255,0.88)]">
              <p className="font-gabarito text-sm font-semibold uppercase tracking-wider text-[#5e7768]">Enemy</p>
            </div>

            <div className="absolute bottom-0 left-1/2 w-full max-w-4xl -translate-x-1/2">
              <p className="mb-2 text-center font-gabarito text-sm text-[#4f6759]">
                {enemyEventText ?? (isPlayable ? "Pick a card from the center deck." : "Waiting for server state...")}
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
                        border: active ? "1px solid #274137" : "1px solid rgba(39,65,55,0.2)",
                        background: "#e9e3d7",
                        opacity: !card || !isPlayable ? 0.6 : 1,
                      }}
                    >
                      <span className="font-gabarito text-[10px] uppercase tracking-[0.16em] text-[#6d8373]">
                        {card ? card.type : "locked"}
                      </span>
                      <span className="absolute bottom-2 left-2 font-caprasimo text-3xl text-[#51675a]">?</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>

      {activeCard && status === "playing" && !isMatchComplete && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(20,30,24,0.35)] p-4">
          <div className="frame-cut w-full max-w-xl p-4 md:p-5" style={{ border: "1px solid rgba(39,65,55,0.22)", background: "#f5f1e8" }}>
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
                  style={{ border: "1px solid rgba(39,65,55,0.22)", background: "#fffdfa" }}
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(20,30,24,0.42)] p-4">
          <div className="frame-cut w-full max-w-xl p-5" style={{ border: "1px solid rgba(39,65,55,0.22)", background: "#f5f1e8" }}>
            <p className="font-caprasimo text-4xl text-[#1f2b24]">{settlementText}</p>
            <p className="mt-1 font-gabarito text-sm text-[#4f6759]">Resolved turns: {outcomes.length}</p>
            {winnerAddress && (
              <p className="mt-1 font-gabarito text-xs text-[#5e7768]">Winner: {shortenAddress(winnerAddress)}</p>
            )}
            {settlementResult && (
              <p className="mt-1 break-all font-gabarito text-[11px] text-[#5e7768]">
                Match ID: {settlementResult.matchId}
              </p>
            )}
            {matchInvalidated && (
              <p className="mt-2 font-gabarito text-xs text-[#8a3f2b]">
                Settlement halted by anti-cheat verification.
              </p>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="frame-cut frame-cut-sm p-2" style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#edf4eb" }}>
                <p className="font-gabarito text-[10px] uppercase tracking-wider text-[#6d8373]">Correct</p>
                <p className="font-caprasimo text-2xl text-[#274137]">{correctCount}</p>
              </div>
              <div className="frame-cut frame-cut-sm p-2" style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#f6eee0" }}>
                <p className="font-gabarito text-[10px] uppercase tracking-wider text-[#6d8373]">Timeout</p>
                <p className="font-caprasimo text-2xl text-[#6f3a28]">{timeoutCount}</p>
              </div>
              <div className="frame-cut frame-cut-sm p-2" style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#f4e8e2" }}>
                <p className="font-gabarito text-[10px] uppercase tracking-wider text-[#6d8373]">Wrong</p>
                <p className="font-caprasimo text-2xl text-[#7c4a36]">{wrongCount}</p>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="frame-cut frame-cut-sm p-2" style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#fffdfa" }}>
                <p className="font-gabarito text-[10px] uppercase tracking-wider text-[#6d8373]">Your Rounds</p>
                <p className="font-caprasimo text-2xl text-[#274137]">{playerRoundsWon}</p>
              </div>
              <div className="frame-cut frame-cut-sm p-2" style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#fffdfa" }}>
                <p className="font-gabarito text-[10px] uppercase tracking-wider text-[#6d8373]">Opponent Rounds</p>
                <p className="font-caprasimo text-2xl text-[#6f3a28]">{opponentRoundsWon}</p>
              </div>
            </div>

            <div className="mt-4 max-h-40 space-y-2 overflow-auto">
              {outcomes.map((item, index) => (
                <div
                  key={`${item.cardId}-${item.at}`}
                  className="frame-cut frame-cut-sm flex items-center justify-between px-3 py-2"
                  style={{ border: "1px solid rgba(39,65,55,0.16)", background: getOutcomeColor(item.outcome) }}
                >
                  <p className="font-gabarito text-xs text-[#274137]">Turn {index + 1}</p>
                  <p className="font-gabarito text-xs font-semibold uppercase tracking-wide text-[#5e7768]">
                    {getOutcomeLabel(item.outcome)}
                  </p>
                </div>
              ))}
            </div>

            {settlementResult && (
              <div className="mt-4 frame-cut frame-cut-sm p-3" style={{ border: "1px solid rgba(39,65,55,0.16)", background: "#fffdfa" }}>
                <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[#274137]">
                  Fund Release Confirmation
                </p>
                <p className="mt-1 font-gabarito text-xs text-[#5e7768]">
                  Confirm release intent after winner announcement.
                </p>
                <button
                  type="button"
                  onClick={onConfirmFundRelease}
                  disabled={releaseState === "signing" || releaseState === "submitting" || releaseState === "success"}
                  className="frame-cut frame-cut-sm mt-3 px-3 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                  style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "rgba(255,255,255,0.9)" }}
                >
                  {getReleaseButtonLabel()}
                </button>
                {releaseSignature && (
                  <p className="mt-2 break-all font-gabarito text-[11px] text-[#5e7768]">
                    Signature: {releaseSignature}
                  </p>
                )}
                {!wallet.publicKey && (
                  <div className="mt-2">
                    <HydratedWalletButton />
                  </div>
                )}
              </div>
            )}

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShareModalOpen(true)}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "rgba(255,255,255,0.9)" }}
              >
                Blink Share
              </button>
            </div>

            <div className="mt-5 flex gap-2">
              <Link
                href="/lobby"
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(39,65,55,0.22)", color: "#274137", background: "rgba(255,255,255,0.88)" }}
              >
                Back To Lobby
              </Link>
            </div>
          </div>
        </div>
      )}

      {shareModalOpen && isMatchComplete && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-[rgba(20,30,24,0.45)] p-4">
          <div className="relative w-full max-w-3xl">
            <button
              type="button"
              onClick={() => setShareModalOpen(false)}
              className="absolute right-1 top-1 z-10 frame-cut frame-cut-sm px-2 py-1 font-gabarito text-xs font-extrabold uppercase tracking-wide"
              style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "rgba(255,255,255,0.92)" }}
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
