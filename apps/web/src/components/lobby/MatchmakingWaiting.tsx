"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Arena, Scientist } from "./LobbyScreen";

type MatchmakingWaitingProps = {
  scientist: Scientist;
  arena: Arena;
  wagerUsd: string;
  walletAddress: string;
  state: "searching" | "timeout" | "error";
  stage: "finding" | "verifying" | "preparing";
  errorMessage?: string | null;
  onRetry: () => void;
  onCancel: () => void;
};

const SEGMENTS = ["Finding Opponent", "Verifying Wallet", "Preparing Arena"] as const;

const FLAVOR_TEXTS = [
  "Calibrating neural pathways...",
  "Synchronizing knowledge banks...",
  "Locking in the wager escrow...",
  "Analyzing opponent profile...",
];

function shortWallet(address: string) {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

export function MatchmakingWaiting({
  scientist,
  arena,
  wagerUsd,
  walletAddress,
  state,
  stage,
  errorMessage,
  onRetry,
  onCancel,
}: MatchmakingWaitingProps) {
  const [activeLoopProgress, setActiveLoopProgress] = useState(0);
  const [flavorIdx, setFlavorIdx] = useState(0);

  useEffect(() => {
    if (state !== "searching") return;
    let rafId = 0;
    const startedAt = performance.now();
    const durationByStage: Record<"finding" | "verifying" | "preparing", number> = {
      finding: 2600,
      verifying: 2400,
      preparing: 2200,
    };

    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const duration = durationByStage[stage];
      const loop = ((elapsed % duration) / duration) * 0.92 + 0.08;
      setActiveLoopProgress(loop);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    const id = setInterval(() => {
      setFlavorIdx((prev) => (prev + 1) % FLAVOR_TEXTS.length);
    }, 1500);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(id);
    };
  }, [state, stage]);

  const isSearching = state === "searching";
  const stageIndex = stage === "finding" ? 0 : stage === "verifying" ? 1 : 2;
  const title =
    state === "timeout"
      ? "No opponent yet"
      : state === "error"
        ? "Matchmaking failed"
        : stage === "finding"
          ? "Finding your opponent"
          : stage === "verifying"
            ? "Verifying wallet"
            : "Preparing arena";
  const subtitle =
    state === "timeout"
      ? "Queue timed out. You can retry or go back."
      : state === "error"
        ? errorMessage ?? "Unable to reach matchmaking service."
        : null;

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col items-center justify-center px-4 py-8 md:px-6">
      <div className="mb-4 flex w-full justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="btn-game btn-game-secondary px-4 py-2 text-[11px] shadow-sm"
        >
          Cancel
        </button>
      </div>

      <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.26em]" style={{ color: arena.accent }}>
        {arena.label} - ${wagerUsd} {arena.token}
      </p>
      <h1 className="mt-2 font-caprasimo text-4xl text-[var(--tone-bark)] drop-shadow-sm md:text-5xl">{title}</h1>
      {subtitle && (
        <p className="mt-2 font-gabarito text-sm text-[var(--warm-text)]">{subtitle}</p>
      )}

      <div className="mt-8 grid w-full grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <div className="game-card p-6 shadow-xl" style={{ border: "2px solid var(--tone-bark)", background: "var(--warm-surface)" }}>
          <p className="font-caprasimo text-2xl text-[var(--tone-bark)]">{scientist.name}</p>
          <p className="mt-1 font-gabarito text-sm text-[var(--warm-text)]">{scientist.base}</p>
          <p className="mt-4 font-mono text-xs font-semibold text-[var(--tone-forest)]">{shortWallet(walletAddress)}</p>
        </div>

        <div className="grid place-items-center px-6">
          <div className="animate-orb-breath font-caprasimo text-5xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.3)]" style={{ color: arena.accent }}>VS</div>
        </div>

        <div className="game-card grid place-items-center p-6 shadow-xl" style={{ border: "2px dashed var(--tone-clay)", background: "rgba(255,255,255,0.4)" }}>
          <div className="text-center">
            <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--tone-clay)] opacity-80">Scanning</p>
            <p className="mt-2 font-caprasimo text-3xl text-[var(--tone-bark)] opacity-60">Unknown</p>
          </div>
        </div>
      </div>

      <div className="mt-8 w-full">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SEGMENTS.map((segment, idx) => {
            const ratio =
              !isSearching
                ? 0
                : idx < stageIndex
                  ? 1
                  : idx === stageIndex
                    ? activeLoopProgress
                    : 0;
            return (
              <div key={segment}>
                <p className="mb-1.5 font-gabarito text-[11px] font-bold uppercase tracking-wide text-[var(--tone-bark)] opacity-80">{segment}</p>
                <div className="h-2 overflow-hidden rounded-full bg-[rgba(0,0,0,0.15)] shadow-inner">
                  <div
                    className={`h-full rounded-full ${ratio > 0 ? "shimmer-bar" : ""}`}
                    style={{ width: `${ratio * 100}%`, backgroundColor: arena.accent }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex h-10 items-center justify-center">
        {isSearching ? (
          <AnimatePresence mode="wait">
            <motion.p
              key={flavorIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28 }}
              className="font-gabarito text-sm tracking-wide text-[var(--tone-forest)] drop-shadow-sm"
            >
              {FLAVOR_TEXTS[flavorIdx]}
            </motion.p>
          </AnimatePresence>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="btn-game btn-game-primary px-6 py-2 text-sm shadow-md"
          >
            Keep Searching
          </button>
        )}
      </div>
    </div>
  );
}

