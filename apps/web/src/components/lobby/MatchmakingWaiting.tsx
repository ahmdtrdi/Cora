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
    <div className="mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col items-center justify-center px-4 py-8 text-[#1f2b24] md:px-6">
      <div className="mb-4 flex w-full justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-[11px] uppercase tracking-[0.2em]"
          style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "rgba(255,255,255,0.85)" }}
        >
          Cancel
        </button>
      </div>

      <p className="font-gabarito text-[11px] uppercase tracking-[0.26em]" style={{ color: arena.accent }}>
        {arena.label} - ${wagerUsd} {arena.token}
      </p>
      <h1 className="mt-2 font-caprasimo text-4xl text-[#1f2b24] md:text-5xl">{title}</h1>
      {subtitle && (
        <p className="mt-2 font-gabarito text-sm text-[#5e7768]">{subtitle}</p>
      )}

      <div className="mt-8 grid w-full grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <div className="frame-cut p-4" style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.85)" }}>
          <p className="font-caprasimo text-xl text-[#1f2b24]">{scientist.name}</p>
          <p className="mt-1 font-gabarito text-xs text-[#4c6156]">{scientist.base}</p>
          <p className="mt-4 font-gabarito text-xs text-[#6b8274]">{shortWallet(walletAddress)}</p>
        </div>

        <div className="grid place-items-center px-2">
          <div className="font-caprasimo text-3xl" style={{ color: arena.accent }}>VS</div>
        </div>

        <div className="frame-cut grid place-items-center p-4" style={{ border: "1px solid rgba(39,65,55,0.18)", background: "rgba(255,255,255,0.72)" }}>
          <div className="text-center">
            <p className="font-gabarito text-[11px] uppercase tracking-[0.2em] text-[#6b8274]">Scanning</p>
            <p className="mt-2 font-caprasimo text-2xl text-[#1f2b24]">Unknown</p>
          </div>
        </div>
      </div>

      <div className="mt-8 w-full">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
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
                <p className="mb-1 font-gabarito text-[11px] uppercase tracking-wide text-[#6b8274]">{segment}</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(39,65,55,0.14)]">
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

      <div className="mt-5 h-5">
        {isSearching ? (
          <AnimatePresence mode="wait">
            <motion.p
              key={flavorIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28 }}
              className="font-gabarito text-xs text-[#4c6156]"
            >
              {FLAVOR_TEXTS[flavorIdx]}
            </motion.p>
          </AnimatePresence>
        ) : (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={onRetry}
              className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "rgba(255,255,255,0.9)" }}
            >
              Keep Searching
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

