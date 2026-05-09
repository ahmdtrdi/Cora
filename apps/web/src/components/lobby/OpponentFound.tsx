"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { Arena, Scientist } from "./LobbyScreen";
import { signDepositIntent } from "@/lib/solana/signDepositIntent";
import { HydratedWalletButton } from "@/components/wallet/HydratedWalletButton";
import { useMatchSocket } from "@/hooks/useMatchSocket";
import { useWalletArenaPlayability } from "@/hooks/useWalletArenaPlayability";
import { DepositPanel } from "@/components/deposit/DepositPanel";
import type { DepositStatus } from "@/components/deposit/depositTypes";
import { RoomStatusRail } from "@/components/room/RoomStatusRail";
import type { RoomStatusBadge } from "@/components/room/PlayerRoomStatus";

type OpponentFoundProps = {
  myScientist: Scientist;
  myWallet: string;
  roomId: string;
  matchRole?: "playerA" | "playerB" | null;
  arena: Arena;
  wagerUsd: string;
  onTimeout: () => void;
};

type SigningState = "idle" | "signing" | "waiting" | "error";

const AGREEMENT_TIMEOUT_SECONDS = 30;
const PHANTOM_SIGNING_WARNING_MS = 20_000;

function shortWallet(address: string) {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

function getRoomCancelledMessage(reason?: "player_cancelled" | "deposit_timeout" | "disconnect") {
  if (reason === "deposit_timeout") return "Deposit timed out. Returning to lobby.";
  if (reason === "disconnect") return "Match cancelled before battle start. Returning to lobby.";
  return "Match cancelled. Returning to lobby.";
}

export function OpponentFound({
  myScientist,
  myWallet,
  roomId,
  matchRole,
  arena,
  wagerUsd,
  onTimeout,
}: OpponentFoundProps) {
  const router = useRouter();
  const { connection } = useConnection();
  const wallet = useWallet();
  const [secondsLeft, setSecondsLeft] = useState(AGREEMENT_TIMEOUT_SECONDS);
  const [signingState, setSigningState] = useState<SigningState>("idle");
  const [signedDepositSignature, setSignedDepositSignature] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [errorVisible, setErrorVisible] = useState(false);
  const [showRoomStatus, setShowRoomStatus] = useState(false);
  const [isRetryingConnection, setIsRetryingConnection] = useState(false);
  const [retryConnectionFailed, setRetryConnectionFailed] = useState(false);
  const [walletApprovalTakingLong, setWalletApprovalTakingLong] = useState(false);
  const [myExpressionUnavailable, setMyExpressionUnavailable] = useState(false);
  const depositIntentConfirmedRef = useRef(false);
  const lastHandledDepositUnlockAtRef = useRef<number | null>(null);
  const cancelFiredRef = useRef(false);
  const myHappyExpressionSrc = useMemo(
    () => `/assets/characters/${myScientist.id.trim().toLowerCase()}/exp/happy.png`,
    [myScientist.id],
  );

  const walletAddress = wallet.publicKey?.toBase58() ?? myWallet;
  const signed = signingState === "waiting";
  const {
    connectionState,
    gameState,
    lastSocketCloseInfo,
    lastSocketError,
    depositUnlockedAt,
    opponentFailedDepositAt,
    lastRoomCancelled,
    lastMatchFound,
    confirmDeposit,
    reconnect,
  } = useMatchSocket({
    roomId,
    address: walletAddress,
    characterId: myScientist.id,
  });
  const hasOpponent = Boolean(gameState?.opponent?.address) && !gameState?.opponent.address.includes("Waiting");
  const opponentAddress = hasOpponent ? gameState?.opponent.address ?? null : null;
  const socketRole =
    lastMatchFound?.roomId === roomId && (lastMatchFound.role === "playerA" || lastMatchFound.role === "playerB")
      ? lastMatchFound.role
      : null;
  const effectiveRole = matchRole ?? socketRole;
  const isPlayerBWaitingUnlock =
    effectiveRole === "playerB" && !depositUnlockedAt && !signedDepositSignature && signingState !== "signing";
  const isPlayerAWaitingForPlayerB =
    effectiveRole === "playerA" && signingState === "waiting" && Boolean(signedDepositSignature);
  const shouldShowCountdown = !isPlayerBWaitingUnlock && signingState !== "waiting";
  const canAttemptSign =
    Boolean(wallet.publicKey) &&
    signingState !== "signing" &&
    signingState !== "waiting" &&
    !isPlayerBWaitingUnlock &&
    !signed;
  const reassignedRoomId =
    lastMatchFound?.roomId && lastMatchFound.roomId !== roomId ? lastMatchFound.roomId : null;
  const {
    statusLabel: playabilityLabel,
    statusTone: playabilityTone,
  } = useWalletArenaPlayability({
    address: wallet.publicKey?.toBase58() ?? "",
    arenaId: arena.id,
    token: arena.token,
    enabled: Boolean(wallet.publicKey),
  });
  const roomCancelledNotice = useMemo(
    () => (lastRoomCancelled ? getRoomCancelledMessage(lastRoomCancelled.reason) : null),
    [lastRoomCancelled],
  );

  useEffect(() => {
    if (signingState === "waiting" && gameState?.status === "playing" && signedDepositSignature) {
      const params = new URLSearchParams({
        roomId,
        address: walletAddress,
        arena: arena.id,
        token: arena.token,
        wager: wagerUsd,
        scientist: myScientist.id,
      });
      if (signedDepositSignature) {
        params.set("depositSig", signedDepositSignature);
      }
      router.push(`/play?${params.toString()}`);
      return;
    }

    if (isPlayerBWaitingUnlock || signingState === "waiting") return;

    if (secondsLeft <= 0) {
      onTimeout();
      return;
    }

    const id = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(id);
  }, [
    signed,
    signingState,
    secondsLeft,
    onTimeout,
    router,
    walletAddress,
    roomId,
    arena.id,
    arena.token,
    wagerUsd,
    myScientist.id,
    signedDepositSignature,
    gameState?.status,
    isPlayerBWaitingUnlock,
  ]);

  useEffect(() => {
    if (!lastRoomCancelled) return;
    const timerId = setTimeout(() => {
      onTimeout();
    }, 1800);
    return () => clearTimeout(timerId);
  }, [lastRoomCancelled, onTimeout]);

  useEffect(() => {
    if (!opponentFailedDepositAt) return;
    onTimeout();
  }, [opponentFailedDepositAt, onTimeout]);

  useEffect(() => {
    if (!signedDepositSignature) return;
    if (connectionState !== "connected") return;
    if (depositIntentConfirmedRef.current) return;

    confirmDeposit(signedDepositSignature);
    depositIntentConfirmedRef.current = true;
  }, [confirmDeposit, connectionState, signedDepositSignature]);

  useEffect(() => {
    if (effectiveRole !== "playerB") return;
    if (!depositUnlockedAt) return;
    if (lastHandledDepositUnlockAtRef.current === depositUnlockedAt) return;
    lastHandledDepositUnlockAtRef.current = depositUnlockedAt;
    setSecondsLeft(AGREEMENT_TIMEOUT_SECONDS);
  }, [depositUnlockedAt, effectiveRole]);

  useEffect(() => {
    if (signingState !== "signing") {
      setWalletApprovalTakingLong(false);
      return;
    }

    const timerId = setTimeout(() => {
      setWalletApprovalTakingLong(true);
    }, PHANTOM_SIGNING_WARNING_MS);

    return () => clearTimeout(timerId);
  }, [signingState]);

  // Clear retry-in-progress flag once the socket settles to any non-reconnecting state.
  useEffect(() => {
    if (!isRetryingConnection) return;
    if (connectionState === "reconnecting") return;
    setIsRetryingConnection(false);
    if (connectionState === "error" || connectionState === "disconnected") {
      setRetryConnectionFailed(true);
    }
  }, [connectionState, isRetryingConnection]);

  async function onSignDeposit() {
    console.info("[OpponentFound] Deposit click", {
      roomId,
      role: effectiveRole ?? "unknown",
      connectionState,
      hasWallet: Boolean(wallet.publicKey),
      canAttemptSign,
      playerBLocked: isPlayerBWaitingUnlock,
      depositUnlockedAt,
      countdownSeconds: secondsLeft,
      signingState,
    });
    if (!canAttemptSign) return;

    setErrorText(null);
    setErrorVisible(false);
    setWalletApprovalTakingLong(false);
    setSigningState("signing");

    try {
      const signature = await signDepositIntent({
        connection,
        wallet,
        roomId,
        token: arena.token,
        wagerUsd,
      });

      if (!signature) {
        throw new Error("Missing transaction signature");
      }

      setSignedDepositSignature(signature);
      setSigningState("waiting");
    } catch (error) {
      console.error("[OpponentFound] Deposit signing failed", {
        roomId,
        role: effectiveRole ?? "unknown",
        connectionState,
        error,
      });
      const message = error instanceof Error ? error.message : "Deposit signing failed. Please retry.";
      setSigningState("error");
      setErrorText(message);
      setErrorVisible(true);
    }
  }

  function onCancelMatch() {
    // Ref guard prevents multiple rapid clicks from firing onTimeout() more than once
    // before the component unmounts (state updates are async, refs are synchronous).
    if (cancelFiredRef.current) return;
    cancelFiredRef.current = true;
    onTimeout();
  }

  function onRetryConnection() {
    if (isRetryingConnection) return;
    setIsRetryingConnection(true);
    setRetryConnectionFailed(false);
    reconnect();
  }

  useEffect(() => {
    if (!errorVisible) return;
    const timerId = setTimeout(() => {
      setErrorVisible(false);
      setErrorText(null);
      setSigningState("idle");
    }, 12000);
    return () => clearTimeout(timerId);
  }, [errorVisible]);

  function getDepositHint() {
    if (reassignedRoomId) {
      return `Server reassigned to room ${reassignedRoomId}. Return to queue to continue sync.`;
    }
    if (!wallet.publicKey) return "Connect Phantom wallet first.";
    if (isPlayerBWaitingUnlock) return "Waiting for Player A to deposit first.";
    if (isPlayerAWaitingForPlayerB) return "Deposit signed. Waiting for Player B.";
    if (effectiveRole === "playerB" && depositUnlockedAt && signingState === "idle") {
      return "Player A deposited. Your turn to sign.";
    }
    if (connectionState === "reconnecting") return "Reconnecting to room server...";
    if (connectionState === "error" || connectionState === "disconnected") return "Socket disconnected. Retry connection.";
    if (lastRoomCancelled) return getRoomCancelledMessage(lastRoomCancelled.reason);
    if (opponentFailedDepositAt) return "Opponent did not deposit in time. Returning to lobby.";
    if (walletApprovalTakingLong) {
      return "Phantom approval has been open for a while. Close the old prompt if needed, then retry for a fresh transaction.";
    }
    if (signingState === "signing") return "Confirm this transaction in Phantom.";
    if (signingState === "waiting") {
      if (depositUnlockedAt) return "Deposit signed. Waiting for opponent confirmation.";
      return "Deposit signed. Waiting for room confirmation.";
    }
    return `Auto-cancel in ${secondsLeft}s if not signed.`;
  }

  function getDepositStatus(): DepositStatus {
    if (opponentFailedDepositAt) return "opponent_failed";
    if (signingState === "error") return "error";
    if (!wallet.publicKey) return "wallet_required";
    if (signingState === "signing") return "signing";
    if (gameState?.status === "playing" && signedDepositSignature) return "confirmed";
    if (signingState === "waiting") return "waiting_opponent";
    if (signedDepositSignature) return "submitted";
    return "idle";
  }

  function getPrimaryButtonLabel() {
    if (isPlayerBWaitingUnlock) return "Waiting For Player A...";
    if (isPlayerAWaitingForPlayerB) return "Waiting For Player B...";
    if (signingState === "signing") return "Signing In Wallet...";
    if (signingState === "waiting") return "Waiting For Opponent...";
    if (signingState === "error") return "Retry Deposit";
    return "Sign Deposit";
  }

  function getPlayerBadges(): RoomStatusBadge[] {
    if (gameState?.status === "playing") {
      return ["connected", "matched", "deposited", "ready"];
    }
    if (signedDepositSignature) {
      return ["connected", "matched", "deposited"];
    }
    if (signingState === "signing") {
      return ["connected", "matched", "selecting"];
    }
    return ["connected", "matched", "selecting"];
  }

  function getOpponentBadges(): RoomStatusBadge[] {
    if (opponentFailedDepositAt) return ["connected", "matched"];
    if (gameState?.status === "playing") return ["connected", "matched", "deposited", "ready"];
    if (depositUnlockedAt || signingState === "waiting") return ["connected", "matched", "deposited"];
    return ["connected", "matched", "selecting"];
  }

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col items-center justify-center px-4 py-8 md:px-6">
      {/* Opponent failed to deposit popup */}
      {opponentFailedDepositAt && (
        <div className="fixed left-1/2 top-6 z-[80] w-full max-w-md -translate-x-1/2">
          <div
            className="frame-cut px-4 py-3 shadow-2xl backdrop-blur-md"
            style={{
              border: "2px solid #c0392b",
              background: "linear-gradient(145deg, #2c1810 0%, #3d1f14 100%)",
            }}
          >
            <p className="font-caprasimo text-base text-[#e74c3c]">
              Match Cancelled
            </p>
            <p className="mt-1 font-gabarito text-sm text-[rgba(244,240,230,0.9)]">
              Your opponent did not sign the deposit in time. Returning to character select...
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.15)]">
              <div
                className="h-full"
                style={{
                  width: "100%",
                  background: "#e74c3c",
                  animationName: "alertDrain",
                  animationDuration: "3500ms",
                  animationTimingFunction: "linear",
                  animationFillMode: "forwards",
                }}
              />
            </div>
          </div>
        </div>
      )}
      {roomCancelledNotice && (
        <div className="fixed left-1/2 top-6 z-[80] w-full max-w-md -translate-x-1/2">
          <div
            className="frame-cut px-4 py-3 shadow-2xl backdrop-blur-md"
            style={{
              border: "2px solid rgba(186,105,49,0.86)",
              background: "linear-gradient(145deg, #2c1810 0%, #3d2315 100%)",
            }}
          >
            <p className="font-caprasimo text-base text-[#f8d694]">Match cancelled</p>
            <p className="mt-1 font-gabarito text-sm text-[rgba(244,240,230,0.9)]">{roomCancelledNotice}</p>
          </div>
        </div>
      )}
      {errorVisible && errorText && (
        <div className="fixed right-4 top-4 z-[70] w-full max-w-sm md:right-6 md:top-6">
          <div
            className="frame-cut px-3 py-2 shadow-xl backdrop-blur-md"
            style={{
              border: "2px solid var(--tone-clay)",
              background: "linear-gradient(145deg, #fff4dd 0%, #f1dfc1 100%)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[var(--tone-bark)]">
                Deposit Signing Error
              </p>
              <button
                type="button"
                onClick={() => {
                  setErrorVisible(false);
                  setErrorText(null);
                  setSigningState("idle");
                }}
                className="font-gabarito text-xs font-bold leading-none text-[var(--tone-bark)] opacity-60 hover:opacity-100"
                aria-label="Close alert"
              >
                X
              </button>
            </div>
            <p className="mt-1 break-words font-gabarito text-xs text-[var(--warm-text)]">
              {errorText}
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[rgba(0,0,0,0.15)]">
              <div
                className="h-full"
                style={{
                  width: "100%",
                  background: "var(--tone-clay)",
                  animationName: "alertDrain",
                  animationDuration: "12000ms",
                  animationTimingFunction: "linear",
                  animationFillMode: "forwards",
                }}
              />
            </div>
          </div>
        </div>
      )}
      {walletApprovalTakingLong && signingState === "signing" && (
        <div className="fixed left-1/2 top-6 z-[80] w-full max-w-md -translate-x-1/2">
          <div
            className="frame-cut px-4 py-3 shadow-2xl backdrop-blur-md"
            style={{
              border: "2px solid var(--tone-clay)",
              background: "linear-gradient(145deg, #fff4dd 0%, #f1dfc1 100%)",
            }}
          >
            <p className="font-caprasimo text-base text-[var(--tone-bark)]">
              Phantom Taking Too Long
            </p>
            <p className="mt-1 font-gabarito text-sm text-[var(--warm-text)]">
              If the wallet popup has been sitting open, the transaction can expire. Close the old prompt and retry to get a fresh deposit transaction.
            </p>
          </div>
        </div>
      )}

      <div className="mb-4 flex w-full items-center justify-between gap-2">
        <span
          className="frame-cut frame-cut-sm px-3 py-1.5 font-gabarito text-[11px] font-bold uppercase tracking-wide"
          style={{
            border: playabilityTone === "warning" ? "1px solid rgba(186,105,49,0.75)" : "1px solid rgba(157,180,150,0.58)",
            color: playabilityTone === "warning" ? "#f8d694" : "#d8ead4",
            background: "rgba(16,26,22,0.72)",
          }}
        >
          {playabilityLabel}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRoomStatus((value) => !value)}
            className="rounded-full border border-[rgba(248,214,148,0.46)] bg-[rgba(16,26,22,0.5)] px-3 py-1.5 font-gabarito text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--tone-cream)] transition-colors hover:bg-[rgba(16,26,22,0.66)]"
          >
            {showRoomStatus ? "Hide Room Status" : "Show Room Status"}
          </button>
        </div>
      </div>

      <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.26em] text-[var(--tone-cream)]/90">
        {arena.label} · ${wagerUsd} {arena.token}
      </p>
      <h1 className="mt-2 text-center font-caprasimo text-4xl text-[var(--tone-cream)] drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)] md:text-5xl">
        Rival Locked
      </h1>
      <p className="mt-2 text-center font-gabarito text-sm text-[rgba(244,240,230,0.9)]">
        Sign the deposit before the timer expires.
      </p>

      <div className="mt-8 grid w-full grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <div
          className="relative overflow-hidden rounded-2xl p-5 shadow-xl"
          style={{
            border: "2px solid rgba(111,58,40,0.62)",
            background: "linear-gradient(145deg, #fff4dd 0%, #f1dfc1 100%)",
            boxShadow: "0 14px 30px rgba(0,0,0,0.34)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(248,214,148,0.2),transparent_52%)]" />
          <div className="relative flex items-center gap-4">
            <div
              className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl"
              style={{
                border: "2px solid rgba(111,58,40,0.6)",
                background: myScientist.portraitBg,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
              }}
            >
              {!myExpressionUnavailable ? (
                <div className="relative h-full w-full">
                  <Image
                    src={myHappyExpressionSrc}
                    alt={`${myScientist.name} happy expression`}
                    fill
                    sizes="80px"
                    className="object-cover object-center"
                    onError={() => setMyExpressionUnavailable(true)}
                  />
                </div>
              ) : (
                <span className="font-caprasimo text-4xl text-[rgba(255,244,221,0.88)] drop-shadow-sm">
                  {myScientist.initial}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <span className="inline-flex rounded-full border border-[rgba(111,58,40,0.38)] bg-[rgba(255,248,236,0.9)] px-2 py-0.5 font-gabarito text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tone-bark)]">
                You
              </span>
              <p className="mt-2 truncate font-caprasimo text-2xl text-[var(--tone-bark)]">{myScientist.name}</p>
              <p className="mt-0.5 truncate font-gabarito text-sm text-[rgba(58,37,24,0.85)]">{myScientist.base}</p>
              <p className="mt-2 font-mono text-xs font-semibold text-[var(--tone-forest)]">{shortWallet(walletAddress)}</p>
            </div>
          </div>
        </div>

        <div className="grid place-items-center px-6">
          <div className="animate-orb-breath font-caprasimo text-6xl leading-none text-[var(--tone-cream)] drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" style={{ textShadow: "0 0 20px rgba(248,214,148,0.28)" }}>
            VS
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-2xl p-5 shadow-xl"
          style={{
            border: "2px solid rgba(111,58,40,0.62)",
            background: "linear-gradient(145deg, #fff4dd 0%, #f1dfc1 100%)",
            boxShadow: "0 14px 30px rgba(0,0,0,0.34)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_25%,rgba(157,180,150,0.17),transparent_50%)]" />
          <div className="relative flex items-center gap-4">
            <div
              className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl"
              style={{
                border: "2px solid rgba(111,58,40,0.6)",
                background: "linear-gradient(150deg, #5a321f 0%, #7a4529 65%, #3f2418 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
              }}
            >
              <span className="font-caprasimo text-4xl text-[rgba(255,244,221,0.88)] drop-shadow-sm">
                ?
              </span>
            </div>
            <div className="min-w-0">
              <span className="inline-flex rounded-full border border-[rgba(111,58,40,0.38)] bg-[rgba(255,248,236,0.9)] px-2 py-0.5 font-gabarito text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tone-bark)]">
                Rival
              </span>
              <p className="mt-2 truncate font-caprasimo text-2xl text-[var(--tone-bark)]">
                Your Rival
              </p>
              <p className="mt-0.5 truncate font-gabarito text-sm text-[rgba(58,37,24,0.85)]">
                Character revealed when battle starts.
              </p>
              <p className="mt-2 font-mono text-xs font-semibold text-[var(--tone-forest)]">
                {opponentAddress ? shortWallet(opponentAddress) : `Room ${roomId}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        className="mt-8 w-full rounded-2xl border p-4 shadow-xl md:p-5"
        style={{
          borderColor: "rgba(248,214,148,0.35)",
          background: "linear-gradient(160deg, rgba(12,21,17,0.72), rgba(19,32,26,0.72))",
        }}
      >
        <DepositPanel
          token={arena.token}
          wagerUsd={wagerUsd}
          status={getDepositStatus()}
          helperText={getDepositHint()}
          countdownSeconds={shouldShowCountdown ? secondsLeft : undefined}
          signature={signedDepositSignature}
          canPrimaryAction={canAttemptSign}
          primaryActionLabel={getPrimaryButtonLabel()}
          onPrimaryAction={onSignDeposit}
          walletSlot={
            !wallet.publicKey ? (
              <div className="pt-1">
                <HydratedWalletButton />
              </div>
            ) : null
          }
          retrySlot={
            connectionState === "error" || connectionState === "disconnected" || connectionState === "reconnecting" ? (
              <button
                type="button"
                onClick={onRetryConnection}
                disabled={isRetryingConnection}
                className={`btn-game btn-game-secondary px-3 py-1.5 text-[10px] shadow-sm ${
                  isRetryingConnection ? "cursor-not-allowed opacity-55" : ""
                }`}
              >
                {isRetryingConnection ? "Retrying..." : "Retry Connection"}
              </button>
            ) : null
          }
          cancelSlot={
            <button
              type="button"
              onClick={onCancelMatch}
              disabled={cancelFiredRef.current}
              className={`btn-game btn-game-secondary px-3 py-1.5 text-[10px] shadow-sm ${
                cancelFiredRef.current ? "cursor-not-allowed opacity-55" : ""
              }`}
            >
              {cancelFiredRef.current ? "Leaving..." : "Cancel Match"}
            </button>
          }
          extraSlot={
            connectionState === "error" || connectionState === "disconnected" || connectionState === "reconnecting" || retryConnectionFailed ? (
              <div className="mt-2 frame-cut px-3 py-2 shadow-xl" style={{ border: `2px solid ${retryConnectionFailed ? "#c0392b" : "var(--tone-clay)"}`, background: retryConnectionFailed ? "linear-gradient(145deg, #2c1810 0%, #3d1f14 100%)" : "var(--warm-surface)" }}>
                <p className={`font-gabarito text-xs font-bold uppercase tracking-wide ${retryConnectionFailed ? "text-[#e74c3c]" : "text-[var(--tone-bark)]"}`}>
                  {retryConnectionFailed
                    ? "Couldn't connect"
                    : connectionState === "reconnecting"
                    ? "Reconnecting to room server"
                    : "Connection issue while waiting"}
                </p>
                <p className="mt-1 break-words font-gabarito text-xs text-[var(--warm-text)]">
                  {retryConnectionFailed
                    ? "Unable to reach the room server. Check your connection and try again, or cancel to return to the lobby."
                    : connectionState === "reconnecting"
                    ? "Trying to restore room state. Keep this page open."
                    : lastSocketCloseInfo
                    ? `Close code ${lastSocketCloseInfo.code}${lastSocketCloseInfo.reason ? `: ${lastSocketCloseInfo.reason}` : ""}`
                    : lastSocketError ?? "Socket disconnected."}
                </p>
              </div>
            ) : null
          }
        />
      </div>

      {showRoomStatus && (
        <div
          className="mt-5 w-full rounded-2xl border p-4 shadow-lg"
          style={{
            borderColor: "rgba(248,214,148,0.32)",
            background: "linear-gradient(160deg, rgba(12,21,17,0.62), rgba(19,32,26,0.62))",
          }}
        >
          <RoomStatusRail
            rows={[
              {
                id: "you",
                label: "You",
                subtitle: signedDepositSignature ? "Deposit signature submitted" : "Waiting for wallet signature",
                badges: getPlayerBadges(),
              },
              {
                id: "opponent",
                label: "Opponent",
                subtitle: opponentFailedDepositAt ? "Deposit failed or timed out" : "Waiting for opponent deposit",
                badges: getOpponentBadges(),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
