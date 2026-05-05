"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { Arena, Scientist } from "./LobbyScreen";
import { signDepositIntent } from "@/lib/solana/signDepositIntent";
import { HydratedWalletButton } from "@/components/wallet/HydratedWalletButton";
import { useMatchSocket } from "@/hooks/useMatchSocket";
import { DepositPanel } from "@/components/deposit/DepositPanel";
import type { DepositStatus } from "@/components/deposit/depositTypes";
import { RoomStatusRail } from "@/components/room/RoomStatusRail";
import type { RoomStatusBadge } from "@/components/room/PlayerRoomStatus";

type OpponentFoundProps = {
  myScientist: Scientist;
  scientists: Scientist[];
  myWallet: string;
  roomId: string;
  arena: Arena;
  wagerUsd: string;
  onTimeout: () => void;
};

type SigningState = "idle" | "signing" | "waiting" | "error";

const AGREEMENT_TIMEOUT_SECONDS = 30;

function shortWallet(address: string) {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

export function OpponentFound({
  myScientist,
  scientists,
  myWallet,
  roomId,
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
  const depositIntentConfirmedRef = useRef(false);

  const walletAddress = wallet.publicKey?.toBase58() ?? myWallet;
  const signed = signingState === "waiting";
  const {
    connectionState,
    gameState,
    lastSocketCloseInfo,
    lastSocketError,
    depositUnlockedAt,
    opponentFailedDepositAt,
    confirmDeposit,
    reconnect,
  } = useMatchSocket({
    roomId,
    address: walletAddress,
    characterId: myScientist.id,
  });
  const hasOpponent = Boolean(gameState?.opponent?.address) && !gameState?.opponent.address.includes("Waiting");
  const opponentAddress = hasOpponent ? gameState?.opponent.address ?? null : null;
  const canAttemptSign =
    Boolean(wallet.publicKey) &&
    connectionState === "connected" &&
    signingState !== "signing" &&
    signingState !== "waiting" &&
    !signed;

  const opponentScientist =
    scientists.find((scientist) => scientist.id === gameState?.opponent?.characterId) ?? null;

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
  ]);

  useEffect(() => {
    if (!opponentFailedDepositAt) return;
    const timerId = setTimeout(() => {
      onTimeout();
    }, 1200);
    return () => clearTimeout(timerId);
  }, [opponentFailedDepositAt, onTimeout]);

  useEffect(() => {
    if (!signedDepositSignature) return;
    if (connectionState !== "connected") return;
    if (depositIntentConfirmedRef.current) return;

    confirmDeposit(signedDepositSignature);
    depositIntentConfirmedRef.current = true;
  }, [confirmDeposit, connectionState, signedDepositSignature]);

  async function onSignDeposit() {
    if (!canAttemptSign) return;

    setErrorText(null);
    setErrorVisible(false);
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
      const message = error instanceof Error ? error.message : "Deposit signing failed. Please retry.";
      setSigningState("error");
      setErrorText(message);
      setErrorVisible(true);
    }
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
    if (!wallet.publicKey) return "Connect Phantom wallet first.";
    if (connectionState === "reconnecting") return "Reconnecting to room server...";
    if (connectionState === "error" || connectionState === "disconnected") return "Socket disconnected. Retry connection.";
    if (opponentFailedDepositAt) return "Opponent did not deposit in time. Returning to queue.";
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

      <div className="mb-4 flex w-full justify-end">
        <button
          type="button"
          onClick={() => setShowRoomStatus((value) => !value)}
          className="rounded-full border border-[rgba(248,214,148,0.46)] bg-[rgba(16,26,22,0.5)] px-3 py-1.5 font-gabarito text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--tone-cream)] transition-colors hover:bg-[rgba(16,26,22,0.66)]"
        >
          {showRoomStatus ? "Hide Room Status" : "Show Room Status"}
        </button>
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
              <span className="font-caprasimo text-4xl text-[rgba(255,244,221,0.88)] drop-shadow-sm">
                {myScientist.initial}
              </span>
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
                background: opponentScientist?.portraitBg ?? "linear-gradient(150deg, #5a321f 0%, #7a4529 65%, #3f2418 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
              }}
            >
              <span className="font-caprasimo text-4xl text-[rgba(255,244,221,0.88)] drop-shadow-sm">
                {opponentScientist?.initial ?? "R"}
              </span>
            </div>
            <div className="min-w-0">
              <span className="inline-flex rounded-full border border-[rgba(111,58,40,0.38)] bg-[rgba(255,248,236,0.9)] px-2 py-0.5 font-gabarito text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tone-bark)]">
                Rival
              </span>
              <p className="mt-2 truncate font-caprasimo text-2xl text-[var(--tone-bark)]">
                {opponentScientist?.name ?? "Rival Synced"}
              </p>
              <p className="mt-0.5 truncate font-gabarito text-sm text-[rgba(58,37,24,0.85)]">
                {opponentScientist?.base ?? "Opponent identity confirmed"}
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
          countdownSeconds={secondsLeft}
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
                onClick={reconnect}
                className="btn-game btn-game-secondary px-4 py-2 text-[10px]"
              >
                Retry Connection
              </button>
            ) : null
          }
          cancelSlot={
            <button
              type="button"
              onClick={onTimeout}
              className="btn-game btn-game-secondary px-4 py-2 text-[10px]"
            >
              Cancel Match
            </button>
          }
          extraSlot={
            connectionState === "error" || connectionState === "disconnected" || connectionState === "reconnecting" ? (
              <div className="mt-2 frame-cut px-3 py-2 shadow-xl" style={{ border: "2px solid var(--tone-clay)", background: "var(--warm-surface)" }}>
                <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[var(--tone-bark)]">
                  {connectionState === "reconnecting" ? "Reconnecting to room server" : "Connection issue while waiting"}
                </p>
                <p className="mt-1 break-words font-gabarito text-xs text-[var(--warm-text)]">
                  {connectionState === "reconnecting"
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
