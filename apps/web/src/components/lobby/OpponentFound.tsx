"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { Arena, Scientist } from "./LobbyScreen";

type OpponentFoundProps = {
  myScientist: Scientist;
  myWallet: string;
  arena: Arena;
  wagerUsd: string;
  scientists: Scientist[];
  onTimeout: () => void;
};

const AGREEMENT_TIMEOUT_SECONDS = 15;
const MOCK_ROOM_ID = "mock-room-001";

function shortWallet(address: string) {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

export function OpponentFound({
  myScientist,
  myWallet,
  arena,
  wagerUsd,
  scientists,
  onTimeout,
}: OpponentFoundProps) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(AGREEMENT_TIMEOUT_SECONDS);
  const [hasAgreed, setHasAgreed] = useState(false);

  const enemyScientist = useMemo(
    () => scientists.find((scientist) => scientist.id !== myScientist.id) ?? scientists[0],
    [scientists, myScientist.id],
  );

  useEffect(() => {
    if (hasAgreed) {
      router.push(`/play?roomId=${MOCK_ROOM_ID}`);
      return;
    }
    if (secondsLeft <= 0) {
      onTimeout();
      return;
    }
    const id = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(id);
  }, [hasAgreed, secondsLeft, onTimeout, router]);

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col items-center justify-center px-4 py-8 text-[#1f2b24] md:px-6">
      <p className="font-gabarito text-[11px] uppercase tracking-[0.26em]" style={{ color: arena.accent }}>
        Match found - {arena.label}
      </p>
      <h1 className="mt-2 font-caprasimo text-4xl text-[#1f2b24] md:text-5xl">Opponent found</h1>

      <div className="mt-8 grid w-full grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <div className="frame-cut p-4" style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.85)" }}>
          <p className="font-gabarito text-[11px] uppercase tracking-[0.2em] text-[#6b8274]">You</p>
          <p className="mt-1 font-caprasimo text-xl text-[#1f2b24]">{myScientist.name}</p>
          <p className="mt-1 font-gabarito text-xs text-[#4c6156]">{myScientist.base}</p>
          <p className="mt-4 font-gabarito text-xs text-[#6b8274]">{shortWallet(myWallet)}</p>
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
          <p className="mt-1 font-caprasimo text-xl text-[#1f2b24]">{enemyScientist.name}</p>
          <p className="mt-1 font-gabarito text-xs text-[#4c6156]">{enemyScientist.base}</p>
          <p className="mt-4 font-gabarito text-xs text-[#6b8274]">F3A1z...9C2B</p>
        </motion.div>
      </div>

      <div className="mt-8 text-center">
        <p className="font-gabarito text-xs uppercase tracking-[0.16em] text-[#6b8274]">
          ${wagerUsd} {arena.token} - Confirm deposit intent
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
            onClick={() => setHasAgreed(true)}
            disabled={hasAgreed}
            className="frame-cut frame-cut-sm min-w-[210px] px-5 py-3 font-gabarito text-sm font-extrabold uppercase tracking-wide"
            style={{
              border: `1px solid ${arena.frame}`,
              background: hasAgreed ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.92)",
              color: arena.frame,
              opacity: hasAgreed ? 0.7 : 1,
            }}
          >
            {hasAgreed ? "Signing..." : "Agree To Match"}
          </button>
          <p className="font-gabarito text-xs text-[#6b8274]">
            Auto-cancel in {secondsLeft}s if not confirmed.
          </p>
        </div>
      </div>
    </div>
  );
}

