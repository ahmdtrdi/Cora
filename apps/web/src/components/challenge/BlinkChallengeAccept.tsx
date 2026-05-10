"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { HydratedWalletButton } from "@/components/wallet/HydratedWalletButton";
import { BlinkRoomJoiner } from "@/components/challenge/BlinkRoomJoiner";
import { getPrivateChallenge, type PrivateChallenge } from "@/lib/matchmaking/privateChallenge";
import { DepositIntentError, signDepositIntent } from "@/lib/solana/signDepositIntent";
import { writeActiveDepositIntent, writeActiveMatchSession } from "@/lib/session/matchSession";

type BlinkChallengeAcceptProps = {
  roomId: string;
};

type AcceptState = "idle" | "loading" | "signing" | "accepted" | "error";
const FIXED_WAGER_USD = "1.00";
const SOL_WRAPPED_MINT = "SO11111111111111111111111111111111111111112";

function getTokenLabel(tokenMint: string | null | undefined) {
  const token = (tokenMint || "SOL").toUpperCase();
  if (token === SOL_WRAPPED_MINT) return "SOL";
  return token;
}

function getArenaLabel(tokenMint: string | null | undefined) {
  const token = getTokenLabel(tokenMint);
  if (token === "SOL") return "SOL Arena";
  if (token === "BONK") return "BONK Arena";
  if (token === "MEW") return "MEW Arena";
  return `${token} Arena`;
}

function shortAddress(address: string | null | undefined) {
  if (!address) return "Unknown";
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

function classifyError(error: unknown) {
  if (error instanceof DepositIntentError) {
    if (error.code === "wallet_declined") return "You cancelled the transaction in your wallet.";
    if (error.code === "insufficient_balance") return "Insufficient Balance";
    return error.message;
  }
  return error instanceof Error ? error.message : "Challenge accept failed.";
}

export function BlinkChallengeAccept({ roomId }: BlinkChallengeAcceptProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [challenge, setChallenge] = useState<PrivateChallenge | null>(null);
  const [state, setState] = useState<AcceptState>("loading");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [acceptedSignature, setAcceptedSignature] = useState<string | null>(null);
  const walletAddress = wallet.publicKey?.toBase58() ?? "";
  const isCreator = Boolean(walletAddress && challenge?.creatorWallet === walletAddress);
  const isAcceptedByWallet = Boolean(walletAddress && challenge?.opponentWallet === walletAddress);
  const canAccept = Boolean(wallet.publicKey) && challenge?.status === "PENDING" && !isCreator && state !== "signing";
  const tokenLabel = getTokenLabel(challenge?.tokenMint);
  const arenaLabel = useMemo(() => getArenaLabel(challenge?.tokenMint), [challenge?.tokenMint]);
  const wagerUsd = FIXED_WAGER_USD;

  useEffect(() => {
    const controller = new AbortController();
    getPrivateChallenge(roomId, controller.signal)
      .then((next) => {
        setChallenge(next);
        setState("idle");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setErrorText(error instanceof Error ? error.message : "Challenge not found.");
        setState("error");
      });
    return () => controller.abort();
  }, [roomId]);

  async function onAcceptChallenge() {
    if (!canAccept || !challenge) return;
    setState("signing");
    setErrorText(null);
    try {
      const signature = await signDepositIntent({
        connection,
        wallet,
        roomId,
        token: challenge.tokenMint,
        wagerUsd,
      });
      setAcceptedSignature(signature);
      writeActiveMatchSession({
        walletAddress,
        address: walletAddress,
        roomId,
        role: "playerB",
        arenaId: "sol",
        scientistId: "einstein",
        status: "depositing",
        token: challenge.tokenMint,
        arenaToken: challenge.tokenMint,
        wagerUsd,
      });
      writeActiveDepositIntent({ roomId, address: walletAddress, signature });
      setState("accepted");
    } catch (error) {
      setErrorText(classifyError(error));
      setState("error");
    }
  }

  if ((state === "accepted" && walletAddress) || (isAcceptedByWallet && walletAddress)) {
    return (
      <BlinkRoomJoiner
        roomId={roomId}
        address={walletAddress}
        role="playerB"
        arenaId="sol"
        scientistId="einstein"
        token={challenge?.tokenMint}
        wagerUsd={wagerUsd}
        depositConfirmSignature={acceptedSignature}
        title="Challenge Accepted"
        subtitle={acceptedSignature ? "Your wager is locked. Waiting for creator to join." : "Rejoining your accepted Blink match."}
      />
    );
  }

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[linear-gradient(145deg,#10231b_0%,#18392d_52%,#0d1a14_100%)] px-4 py-8 md:px-6">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="paper-grain absolute inset-0 opacity-25" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_28%,rgba(8,15,12,0.64)_100%)]" />
        <div className="absolute left-1/2 top-1/2 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--tone-sage)] opacity-16 blur-[150px]" />
      </div>
      <main className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-3xl items-center">
        <section
          className="game-card w-full p-6 shadow-2xl md:p-8"
          style={{ border: "2px solid var(--tone-bark)", background: "linear-gradient(180deg, #fff8e8 0%, #f3e6c9 100%)" }}
        >
          <p className="font-gabarito text-[11px] font-black uppercase tracking-[0.22em] text-[var(--tone-clay)]">
            CORA Blink Challenge
          </p>
          <h1 className="mt-2 font-caprasimo text-4xl leading-none text-[var(--tone-bark)] md:text-5xl">
            Accept The Challenge
          </h1>
          <p className="mt-3 font-gabarito text-sm text-[var(--warm-text)]">
            Sign once to lock your wager. The creator already funded the open challenge.
          </p>

          <div className="mt-6 grid gap-3 rounded-2xl border border-[rgba(111,58,40,0.24)] bg-[rgba(255,255,255,0.36)] p-4 font-gabarito text-sm text-[var(--warm-text)]">
            <p><span className="font-bold text-[var(--tone-bark)]">Room:</span> {roomId}</p>
            <p><span className="font-bold text-[var(--tone-bark)]">Creator:</span> {shortAddress(challenge?.creatorWallet)}</p>
            <p><span className="font-bold text-[var(--tone-bark)]">Arena:</span> {arenaLabel}</p>
            <p><span className="font-bold text-[var(--tone-bark)]">Token:</span> {tokenLabel}</p>
            <p><span className="font-bold text-[var(--tone-bark)]">Status:</span> {challenge?.status ?? state}</p>
            <p><span className="font-bold text-[var(--tone-bark)]">Wager:</span> ${wagerUsd}</p>
          </div>

          {errorText && (
            <div className="mt-4 frame-cut px-4 py-3" style={{ border: "2px solid var(--tone-clay)", background: "#fff4dd" }}>
              <p className="font-gabarito text-sm font-bold text-[var(--tone-bark)]">{errorText}</p>
            </div>
          )}

          {isCreator && (
            <div className="mt-4 frame-cut px-4 py-3" style={{ border: "2px solid var(--tone-clay)", background: "#fff4dd" }}>
              <p className="font-gabarito text-sm font-bold text-[var(--tone-bark)]">
                This is your own challenge. Share it with another wallet to accept.
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!wallet.publicKey && <HydratedWalletButton />}
            <button
              type="button"
              onClick={onAcceptChallenge}
              disabled={!canAccept}
              className={`btn-game btn-game-primary px-5 py-3 text-xs ${!canAccept ? "cursor-not-allowed opacity-50 grayscale" : ""}`}
            >
              {state === "signing" ? "Signing In Wallet..." : "Accept & Lock Wager"}
            </button>
            <a
              href="/lobby"
              className="btn-game btn-game-secondary px-5 py-3 text-xs"
              style={{
                borderColor: "rgba(111,58,40,0.42)",
                boxShadow: "0 4px 0 rgba(111,58,40,0.22)",
                color: "rgba(111,58,40,0.42)",
              }}
            >
              Back To Lobby
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
