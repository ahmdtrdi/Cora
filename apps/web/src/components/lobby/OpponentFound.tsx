"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { Arena, Scientist } from "./LobbyScreen";
import { signDepositIntent } from "@/lib/solana/signDepositIntent";
import { HydratedWalletButton } from "@/components/wallet/HydratedWalletButton";
import { useMatchSocket } from "@/hooks/useMatchSocket";

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
  const [uxLockExpired, setUxLockExpired] = useState(false);
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
  });
  const hasOpponent = Boolean(gameState?.opponent?.address) && !gameState?.opponent.address.includes("Waiting");
  const opponentAddress = hasOpponent ? gameState?.opponent.address ?? null : null;
  const deterministicPrimaryAddress = useMemo(() => {
    if (!opponentAddress) return null;
    return [walletAddress, opponentAddress].sort()[0];
  }, [opponentAddress, walletAddress]);
  const requiresTemporaryUnlock =
    Boolean(opponentAddress) &&
    deterministicPrimaryAddress !== null &&
    walletAddress !== deterministicPrimaryAddress;
  const isUxSignLocked =
    !signed &&
    requiresTemporaryUnlock &&
    !depositUnlockedAt &&
    !uxLockExpired;
  const canAttemptSign =
    Boolean(wallet.publicKey) &&
    signingState !== "signing" &&
    signingState !== "waiting" &&
    !isUxSignLocked &&
    !signed;

  const opponentScientist = opponentAddress
    ? scientists[Math.abs(opponentAddress.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % scientists.length]
    : null;

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
    if (!requiresTemporaryUnlock || depositUnlockedAt) return;
    const timerId = setTimeout(() => {
      setUxLockExpired(true);
    }, 5000);
    return () => clearTimeout(timerId);
  }, [depositUnlockedAt, requiresTemporaryUnlock]);

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

  function getButtonLabel() {
    if (signingState === "signing") return "Signing In Wallet...";
    if (signingState === "waiting") return "Waiting For Opponent...";
    return "Sign Deposit";
  }

  function getSignButtonHint() {
    if (!wallet.publicKey) return "Connect Phantom wallet first.";
    if (connectionState === "error" || connectionState === "disconnected") return "Socket disconnected. Retry connection.";
    if (isUxSignLocked) return "Waiting for server unlock...";
    if (opponentFailedDepositAt) return "Opponent did not deposit in time. Returning to queue.";
    if (signingState === "signing") return "Confirm this transaction in Phantom.";
    if (signingState === "waiting") {
      if (depositUnlockedAt) return "Deposit signed. Waiting for opponent confirmation.";
      return "Deposit signed. Waiting for room confirmation.";
    }
    return `Auto-cancel in ${secondsLeft}s if not signed.`;
  }

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col items-center justify-center px-4 py-8 text-[#1f2b24] md:px-6">
      {errorVisible && errorText && (
        <div className="fixed right-4 top-4 z-[70] w-full max-w-sm md:right-6 md:top-6">
          <div
            className="frame-cut px-3 py-2"
            style={{ border: "1px solid rgba(186,105,49,0.34)", background: "rgba(255,250,242,0.97)" }}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[#8f5a1d]">
                Deposit Signing Error
              </p>
              <button
                type="button"
                onClick={() => {
                  setErrorVisible(false);
                  setErrorText(null);
                  setSigningState("idle");
                }}
                className="font-gabarito text-xs font-bold leading-none text-[#7c4a36]"
                aria-label="Close alert"
              >
                X
              </button>
            </div>
            <p className="mt-1 break-words font-gabarito text-xs text-[#73512d]">
              {errorText}
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[rgba(39,65,55,0.14)]">
              <div
                className="h-full"
                style={{
                  width: "100%",
                  background: "linear-gradient(90deg,#d9a85b,#ba6931)",
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
      <p className="font-gabarito text-[11px] uppercase tracking-[0.26em]" style={{ color: arena.accent }}>
        Match found - {arena.label}
      </p>
      <h1 className="mt-2 font-caprasimo text-4xl text-[#1f2b24] md:text-5xl">Opponent found</h1>

      <div className="mt-8 grid w-full grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <div className="frame-cut p-4" style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.85)" }}>
          <p className="font-gabarito text-[11px] uppercase tracking-[0.2em] text-[#6b8274]">You</p>
          <p className="mt-1 font-caprasimo text-xl text-[#1f2b24]">{myScientist.name}</p>
          <p className="mt-1 font-gabarito text-xs text-[#4c6156]">{myScientist.base}</p>
          <p className="mt-4 font-gabarito text-xs text-[#6b8274]">{shortWallet(walletAddress)}</p>
        </div>

        <div className="grid place-items-center px-2">
          <div className="font-caprasimo text-3xl" style={{ color: arena.accent }}>VS</div>
        </div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.34 }}
          className="frame-cut p-4"
          style={{ border: `1px solid ${arena.frame}`, background: "rgba(255,255,255,0.85)" }}
        >
          <p className="font-gabarito text-[11px] uppercase tracking-[0.2em] text-[#6b8274]">Opponent</p>
          <p className="mt-1 font-caprasimo text-xl text-[#1f2b24]">
            {opponentScientist?.name ?? "Syncing Rival..."}
          </p>
          <p className="mt-1 font-gabarito text-xs text-[#4c6156]">
            {opponentScientist?.base ?? "Waiting for opponent identity sync."}
          </p>
          <p className="mt-4 font-gabarito text-xs text-[#6b8274]">
            {opponentAddress ? shortWallet(opponentAddress) : `Room ${roomId}`}
          </p>
        </motion.div>
      </div>

      <div className="mt-8 text-center">
        <p className="font-gabarito text-xs uppercase tracking-[0.16em] text-[#6b8274]">
          ${wagerUsd} {arena.token} - Sign deposit before battle
        </p>
        <div className="mt-3 flex flex-col items-center gap-3">
          <motion.p
            key={secondsLeft}
            initial={{ scale: 1.25, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.24 }}
            className="font-caprasimo text-6xl"
            style={{ color: arena.accent }}
          >
            {secondsLeft}
          </motion.p>
          <button
            type="button"
            onClick={onSignDeposit}
            disabled={!canAttemptSign}
            className="frame-cut frame-cut-sm min-w-[210px] px-5 py-3 font-gabarito text-sm font-extrabold uppercase tracking-wide"
            style={{
              border: `1px solid ${arena.frame}`,
              background: isUxSignLocked
                ? "rgba(214,214,208,0.96)"
                : signed
                  ? "rgba(255,255,255,0.72)"
                  : "rgba(255,255,255,0.92)",
              color: isUxSignLocked ? "#5f695f" : arena.frame,
              opacity: signed ? 0.7 : isUxSignLocked ? 0.95 : 1,
            }}
          >
            {getButtonLabel()}
          </button>
          {!wallet.publicKey && (
            <div className="pt-1">
              <HydratedWalletButton />
            </div>
          )}
          <p className="font-gabarito text-xs text-[#6b8274]">
            {getSignButtonHint()}
          </p>
          {(connectionState === "error" || connectionState === "disconnected") && (
            <div className="mt-2 frame-cut px-3 py-2" style={{ border: "1px solid rgba(186,105,49,0.32)", background: "rgba(255,250,242,0.95)" }}>
              <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[#8f5a1d]">
                Connection issue while waiting
              </p>
              <p className="mt-1 break-words font-gabarito text-xs text-[#73512d]">
                {lastSocketCloseInfo
                  ? `Close code ${lastSocketCloseInfo.code}${lastSocketCloseInfo.reason ? `: ${lastSocketCloseInfo.reason}` : ""}`
                  : lastSocketError ?? "Socket disconnected."}
              </p>
              <button
                type="button"
                onClick={reconnect}
                className="frame-cut frame-cut-sm mt-2 px-3 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "#fffdfa" }}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
