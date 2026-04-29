"use client";

import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AnimatePresence, motion } from "framer-motion";
import { LobbySetup } from "./LobbySetup";
import { CharacterSelect } from "./CharacterSelect";
import { MatchmakingWaiting } from "./MatchmakingWaiting";
import { OpponentFound } from "./OpponentFound";

export type Stat = { label: string; value: number };

export type Scientist = {
  id: string;
  name: string;
  base: string;
  stats: [Stat, Stat];
  accentColor: string;
  portraitBg: string;
  initial: string;
};

export type Arena = {
  id: string;
  token: string;
  label: string;
  accent: string;
  frame: string;
  previewBg: string;
};

export const SCIENTISTS: Scientist[] = [
  {
    id: "turing",
    name: "Alan Turing",
    base: "The Computer",
    stats: [
      { label: "Logic", value: 92 },
      { label: "Computation", value: 88 },
    ],
    accentColor: "#9db496",
    portraitBg: "linear-gradient(160deg, #152920 0%, #274137 60%, #0d1f18 100%)",
    initial: "T",
  },
  {
    id: "curie",
    name: "Marie Curie",
    base: "The Laboratory",
    stats: [
      { label: "Chemistry", value: 95 },
      { label: "Precision", value: 84 },
    ],
    accentColor: "#ba6931",
    portraitBg: "linear-gradient(160deg, #3d1f0a 0%, #5c2e12 60%, #210e04 100%)",
    initial: "C",
  },
  {
    id: "newton",
    name: "Isaac Newton",
    base: "The Observatory",
    stats: [
      { label: "Physics", value: 90 },
      { label: "Gravity", value: 91 },
    ],
    accentColor: "#f8d694",
    portraitBg: "linear-gradient(160deg, #12122a 0%, #1e1e3f 60%, #080814 100%)",
    initial: "N",
  },
];

export const ARENAS: Arena[] = [
  {
    id: "usdc",
    token: "USDC",
    label: "USDC Arena",
    accent: "#9db496",
    frame: "#274137",
    previewBg:
      "radial-gradient(circle at 20% 20%, rgba(157,180,150,0.28), transparent 45%), radial-gradient(circle at 80% 80%, rgba(203,227,193,0.22), transparent 45%), linear-gradient(155deg, #eef6ec 0%, #ddebd8 60%, #d2e2cd 100%)",
  },
  {
    id: "bonk",
    token: "BONK",
    label: "BONK Arena",
    accent: "#f8d694",
    frame: "#6f3a28",
    previewBg:
      "radial-gradient(circle at 22% 24%, rgba(248,214,148,0.38), transparent 48%), radial-gradient(circle at 75% 78%, rgba(186,105,49,0.24), transparent 44%), linear-gradient(150deg, #fff4df 0%, #f7e3bf 58%, #eed2a2 100%)",
  },
];

type Phase = "setup" | "character-select" | "waiting" | "found";
const FIXED_WAGER_USD = "1.00";

const PHASE_VARIANTS = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.02 },
};

export function LobbyScreen() {
  const { publicKey } = useWallet();

  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedArenaId, setSelectedArenaId] = useState<string | null>(null);
  const [selectedScientist, setSelectedScientist] = useState<Scientist | null>(null);

  const selectedArena = useMemo(
    () => ARENAS.find((arena) => arena.id === selectedArenaId) ?? null,
    [selectedArenaId],
  );

  const walletConnected = Boolean(publicKey);
  const walletAddr = publicKey?.toBase58() ?? "Not connected";

  const wagerNumber = Number(FIXED_WAGER_USD);
  const hasValidWager = Number.isFinite(wagerNumber) && wagerNumber > 0;

  const canStart = walletConnected && Boolean(selectedArena) && hasValidWager;
  const canQueue = Boolean(selectedScientist) && Boolean(selectedArena);

  return (
    <div
      className="relative min-h-[100svh] overflow-hidden"
      style={{
        backgroundColor: "#f5f1e8",
        backgroundImage:
          "linear-gradient(rgba(39,65,55,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(39,65,55,0.045) 1px, transparent 1px)",
        backgroundSize: "42px 42px",
      }}
    >
      <AnimatePresence mode="wait">
        {phase === "setup" && (
          <motion.div
            key="setup"
            variants={PHASE_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10"
          >
            <LobbySetup
              walletAddress={walletAddr}
              walletConnected={walletConnected}
              arenas={ARENAS}
              selectedArenaId={selectedArenaId}
              onSelectArena={setSelectedArenaId}
              wagerUsd={FIXED_WAGER_USD}
              canPlay={canStart}
              onPlay={() => {
                if (canStart) {
                  setPhase("character-select");
                }
              }}
            />
          </motion.div>
        )}

        {phase === "character-select" && selectedArena && (
          <motion.div
            key="character-select"
            variants={PHASE_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10"
          >
            <CharacterSelect
              scientists={SCIENTISTS}
              selected={selectedScientist}
              onSelect={setSelectedScientist}
              onBack={() => setPhase("setup")}
              onContinue={() => {
                if (canQueue) {
                  setPhase("waiting");
                }
              }}
              arena={selectedArena}
              wagerUsd={FIXED_WAGER_USD}
              walletAddress={walletAddr}
            />
          </motion.div>
        )}

        {phase === "waiting" && selectedScientist && selectedArena && (
          <motion.div
            key="waiting"
            variants={PHASE_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10"
          >
            <MatchmakingWaiting
              scientist={selectedScientist}
              arena={selectedArena}
              wagerUsd={FIXED_WAGER_USD}
              walletAddress={walletAddr}
              onFound={() => setPhase("found")}
              onCancel={() => setPhase("character-select")}
            />
          </motion.div>
        )}

        {phase === "found" && selectedScientist && selectedArena && (
          <motion.div
            key="found"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="relative z-10"
          >
            <OpponentFound
              myScientist={selectedScientist}
              myWallet={walletAddr}
              arena={selectedArena}
              wagerUsd={FIXED_WAGER_USD}
              scientists={SCIENTISTS}
              onTimeout={() => setPhase("character-select")}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

