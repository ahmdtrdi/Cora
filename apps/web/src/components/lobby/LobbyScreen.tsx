"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { AnimatePresence, motion } from "framer-motion";
import { LobbySetup } from "./LobbySetup";
import { CharacterSelect } from "./CharacterSelect";
import { MatchmakingWaiting } from "./MatchmakingWaiting";
import { OpponentFound } from "./OpponentFound";
import { queueMatch } from "@/lib/matchmaking/queueMatch";
import { IntegrationModeBanner } from "@/components/ui/IntegrationModeBanner";
import { getRuntimeConfig, isIntegrationMode } from "@/lib/config/runtimeModes";
import { RoomPhaseShell } from "@/components/room/RoomPhaseShell";
import { CharacterSelect as CharacterSelectPanel } from "@/components/character/CharacterSelect";
import type {
  CharacterOption,
  CharacterSelectionState,
  OpponentCharacterStatus,
} from "@/components/character/characterTypes";

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
    id: "sol",
    token: "SOL",
    label: "SOL Arena",
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
type MatchmakingState = "idle" | "searching" | "timeout" | "error";
type MatchmakingStage = "finding" | "verifying" | "preparing";
const FIXED_WAGER_USD = "1.00";
const MATCHMAKING_TIMEOUT_MS = 45_000;
const POST_MATCH_FOUND_VERIFY_MS = 1400;
const POST_MATCH_FOUND_PREPARE_MS = 1000;
const LOBBY_DRAFT_STORAGE_KEY = "cora:lobby-draft";

const PHASE_VARIANTS = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.02 },
};

function shortenAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

type LobbyDraftSnapshot = {
  arenaId?: string | null;
  scientistId?: string | null;
};

export function LobbyScreen() {
  const runtimeConfig = getRuntimeConfig();
  const showIntegrationBanner = isIntegrationMode(runtimeConfig);
  const searchParams = useSearchParams();
  const { publicKey } = useWallet();
  const challengeMode = searchParams.get("challenge") === "1";
  const challengedBy = searchParams.get("ref");
  const requestedArena = searchParams.get("arena");
  const requestedToken = searchParams.get("token");
  const requestedWager = searchParams.get("wager");
  const requestedScientist = searchParams.get("scientist");
  const previewPhase = searchParams.get("previewPhase");
  const previewSelectStateParam = searchParams.get("previewSelectState");
  const previewOpponentStatusParam = searchParams.get("previewOpponentStatus");
  const resumeQueue = searchParams.get("resumeQueue") === "1";
  const hasRequestedArena = requestedArena ? ARENAS.some((arena) => arena.id === requestedArena) : false;
  const initialScientist =
    requestedScientist ? SCIENTISTS.find((scientist) => scientist.id === requestedScientist) ?? null : null;

  const [phase, setPhase] = useState<Phase>(() => (resumeQueue && hasRequestedArena ? "character-select" : "setup"));
  const [selectedArenaId, setSelectedArenaId] = useState<string | null>(() => {
    if (!requestedArena) return null;
    return ARENAS.some((arena) => arena.id === requestedArena) ? requestedArena : null;
  });
  const [selectedScientist, setSelectedScientist] = useState<Scientist | null>(initialScientist);
  const [matchedRoomId, setMatchedRoomId] = useState<string | null>(null);
  const [matchmakingState, setMatchmakingState] = useState<MatchmakingState>("idle");
  const [matchmakingStage, setMatchmakingStage] = useState<MatchmakingStage>("finding");
  const [matchmakingError, setMatchmakingError] = useState<string | null>(null);
  const matchmakingAbortRef = useRef<AbortController | null>(null);
  const matchmakingRequestIdRef = useRef(0);
  const userCancelledRef = useRef(false);
  const foundTransitionTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const autoRequeueStartedRef = useRef(false);
  const draftHydratedRef = useRef(false);

  const selectedArena = useMemo(
    () => ARENAS.find((arena) => arena.id === selectedArenaId) ?? null,
    [selectedArenaId],
  );
  const characterOptions = useMemo<CharacterOption[]>(
    () => SCIENTISTS.map((scientist) => ({ ...scientist, stats: [...scientist.stats] })),
    [],
  );
  const previewSelectionState: CharacterSelectionState =
    previewSelectStateParam === "selected" ||
    previewSelectStateParam === "locked" ||
    previewSelectStateParam === "auto_assigned" ||
    previewSelectStateParam === "expired"
      ? previewSelectStateParam
      : "idle";
  const previewOpponentStatus: OpponentCharacterStatus =
    previewOpponentStatusParam === "hidden" ||
    previewOpponentStatusParam === "picked" ||
    previewOpponentStatusParam === "locked" ||
    previewOpponentStatusParam === "auto_assigned"
      ? previewOpponentStatusParam
      : "waiting";
  const previewSelectionId =
    previewSelectionState === "auto_assigned" ? undefined : selectedScientist?.id;
  const previewAutoAssignedCharacterId =
    previewSelectionState === "auto_assigned"
      ? selectedScientist?.id ?? SCIENTISTS[0]?.id
      : undefined;
  const isSelectingCharacterPreview = previewPhase === "selecting_character" && Boolean(selectedArena);

  const walletConnected = Boolean(publicKey);
  const walletAddress = publicKey?.toBase58() ?? "";
  const walletAddr = walletAddress || "Not connected";

  const wagerNumber = Number(FIXED_WAGER_USD);
  const hasValidWager = Number.isFinite(wagerNumber) && wagerNumber > 0;

  const canStart = walletConnected && Boolean(selectedArena) && hasValidWager;
  const canQueue = Boolean(selectedScientist) && Boolean(selectedArena);
  const waitingMissingContext = phase === "waiting" && (!selectedArena || !selectedScientist);
  const foundMissingContext =
    phase === "found" && (!selectedArena || !selectedScientist || !matchedRoomId);
  const phaseContextIssue = waitingMissingContext
    ? {
        title: "Queue session missing context",
        detail: "Room setup was refreshed before queue state finished syncing.",
      }
    : foundMissingContext
      ? {
          title: "Match room context missing",
          detail: "Opponent-found state lost required room data. Return to character select and re-queue.",
        }
      : null;

  const clearFoundTransitionTimers = useCallback(() => {
    for (const timerId of foundTransitionTimeoutsRef.current) {
      clearTimeout(timerId);
    }
    foundTransitionTimeoutsRef.current = [];
  }, []);

  const startMatchmakingSearch = useCallback(async () => {
    if (!walletAddress) {
      setMatchmakingState("error");
      setMatchmakingError("Connect wallet before entering queue.");
      return;
    }

    matchmakingAbortRef.current?.abort();
    userCancelledRef.current = false;

    const controller = new AbortController();
    matchmakingAbortRef.current = controller;
    const requestId = ++matchmakingRequestIdRef.current;
    let timedOut = false;

    setMatchmakingState("searching");
    setMatchmakingStage("finding");
    setMatchmakingError(null);
    setMatchedRoomId(null);
    clearFoundTransitionTimers();

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, MATCHMAKING_TIMEOUT_MS);

    try {
      const { roomId } = await queueMatch({
        address: walletAddress,
        signal: controller.signal,
      });

      if (requestId !== matchmakingRequestIdRef.current) return;
      setMatchedRoomId(roomId);
      setMatchmakingState("searching");
      setMatchmakingStage("verifying");
      clearFoundTransitionTimers();

      const verifyTimer = setTimeout(() => {
        if (requestId !== matchmakingRequestIdRef.current) return;
        setMatchmakingStage("preparing");

        const prepareTimer = setTimeout(() => {
          if (requestId !== matchmakingRequestIdRef.current) return;
          setMatchmakingState("idle");
          setPhase("found");
        }, POST_MATCH_FOUND_PREPARE_MS);
        foundTransitionTimeoutsRef.current.push(prepareTimer);
      }, POST_MATCH_FOUND_VERIFY_MS);

      foundTransitionTimeoutsRef.current.push(verifyTimer);
    } catch (error) {
      if (requestId !== matchmakingRequestIdRef.current) return;
      if (controller.signal.aborted) {
        if (userCancelledRef.current) return;
        if (timedOut) {
          setMatchmakingState("timeout");
          setMatchmakingStage("finding");
          setMatchmakingError("No opponent found yet. Retry to keep searching.");
        }
        return;
      }

      const message = error instanceof Error ? error.message : "Failed to queue matchmaking.";
      setMatchmakingState("error");
      setMatchmakingStage("finding");
      setMatchmakingError(message);
    } finally {
      clearTimeout(timeoutId);
      if (matchmakingAbortRef.current === controller) {
        matchmakingAbortRef.current = null;
      }
    }
  }, [
    walletAddress,
    clearFoundTransitionTimers,
    setMatchmakingState,
    setMatchmakingError,
    setMatchedRoomId,
    setMatchmakingStage,
    setPhase,
  ]);

  function beginMatchmaking() {
    setMatchmakingState("searching");
    setMatchmakingStage("finding");
    setMatchmakingError(null);
    setPhase("waiting");
    void startMatchmakingSearch();
  }

  function cancelMatchmaking() {
    userCancelledRef.current = true;
    matchmakingAbortRef.current?.abort();
    clearFoundTransitionTimers();
    setMatchmakingState("idle");
    setMatchmakingStage("finding");
    setMatchmakingError(null);
    setPhase("character-select");
  }

  useEffect(() => {
    return () => {
      matchmakingAbortRef.current?.abort();
      for (const timerId of foundTransitionTimeoutsRef.current) {
        clearTimeout(timerId);
      }
      foundTransitionTimeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!resumeQueue || autoRequeueStartedRef.current) return;
    if (phase !== "character-select") return;
    if (!canQueue || matchmakingState !== "idle") return;

    const timeoutId = setTimeout(() => {
      autoRequeueStartedRef.current = true;
      setMatchmakingState("searching");
      setMatchmakingStage("finding");
      setMatchmakingError(null);
      setPhase("waiting");
      void startMatchmakingSearch();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [resumeQueue, phase, canQueue, matchmakingState, startMatchmakingSearch]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (draftHydratedRef.current) return;
    draftHydratedRef.current = true;
    try {
      const raw = window.sessionStorage.getItem(LOBBY_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const snapshot = JSON.parse(raw) as LobbyDraftSnapshot;

      queueMicrotask(() => {
        if (!selectedArenaId && snapshot.arenaId && ARENAS.some((arena) => arena.id === snapshot.arenaId)) {
          setSelectedArenaId(snapshot.arenaId);
        }

        if (!selectedScientist && snapshot.scientistId) {
          const restoredScientist = SCIENTISTS.find((scientist) => scientist.id === snapshot.scientistId) ?? null;
          if (restoredScientist) {
            setSelectedScientist(restoredScientist);
          }
        }
      });
    } catch {
      // Ignore malformed draft state.
    }
  }, [selectedArenaId, selectedScientist]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const snapshot: LobbyDraftSnapshot = {
      arenaId: selectedArenaId,
      scientistId: selectedScientist?.id ?? null,
    };
    window.sessionStorage.setItem(LOBBY_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
  }, [selectedArenaId, selectedScientist?.id]);

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
      {showIntegrationBanner && (
        <IntegrationModeBanner
          depositMode={runtimeConfig.depositMode}
          settlementMode={runtimeConfig.settlementMode}
        />
      )}
      {challengeMode && (
        <div className="fixed right-4 top-4 z-[70] w-full max-w-sm md:right-6 md:top-6">
          <div
            className="frame-cut px-3 py-2"
            style={{ border: "1px solid rgba(39,65,55,0.26)", background: "rgba(255,255,255,0.95)" }}
          >
            <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[#274137]">
              Challenge Received
            </p>
            <p className="mt-1 font-gabarito text-xs text-[#4f6759]">
              {challengedBy ? `From ${shortenAddress(challengedBy)}` : "A rival challenged you."}
            </p>
            <p className="mt-1 font-gabarito text-xs text-[#5e7768]">
              {requestedToken ?? "SOL"} arena - ${requestedWager ?? FIXED_WAGER_USD}
            </p>
          </div>
        </div>
      )}
      {!walletConnected && (phase === "waiting" || phase === "found") && (
        <div className="fixed left-4 top-4 z-[70] w-full max-w-sm md:left-6 md:top-6">
          <div
            className="frame-cut px-3 py-2"
            style={{ border: "1px solid rgba(186,105,49,0.34)", background: "rgba(255,250,242,0.97)" }}
          >
            <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[#8f5a1d]">
              Wallet disconnected
            </p>
            <p className="mt-1 font-gabarito text-xs text-[#73512d]">
              Reconnect wallet before continuing queue or deposit confirmation.
            </p>
          </div>
        </div>
      )}
      {isSelectingCharacterPreview && selectedArena && (
        <RoomPhaseShell
          phase="selecting_character"
          title="Lock your character"
          subtitle="Preview-only phase shell. Final flow is not wired yet."
          statusSlot={
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-semibold uppercase tracking-wide"
                style={{ border: `1px solid ${selectedArena.frame}`, color: selectedArena.frame, background: "rgba(255,255,255,0.82)" }}
              >
                {selectedArena.label}
              </span>
              <span
                className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-semibold uppercase tracking-wide text-[#6f3a28]"
                style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.82)" }}
              >
                ${FIXED_WAGER_USD} {selectedArena.token}
              </span>
            </div>
          }
        >
          <CharacterSelectPanel
            mode="post_deposit"
            characters={characterOptions}
            selectedCharacterId={previewSelectionId}
            selectionState={previewSelectionState}
            autoAssignedCharacterId={previewAutoAssignedCharacterId}
            neutralDefaultCharacterId={SCIENTISTS[0]?.id}
            deadlineMs={18_000}
            opponentStatus={previewOpponentStatus}
            onSelect={(characterId) => {
              const next = SCIENTISTS.find((scientist) => scientist.id === characterId) ?? null;
              setSelectedScientist(next);
            }}
          />
        </RoomPhaseShell>
      )}
      {!isSelectingCharacterPreview && (
      phaseContextIssue ? (
        <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-3xl items-center justify-center px-4 py-8 md:px-6">
          <div
            className="frame-cut w-full p-5 md:p-6"
            style={{ border: "1px solid rgba(186,105,49,0.32)", background: "rgba(255,250,242,0.96)" }}
          >
            <p className="font-caprasimo text-3xl text-[#1f2b24]">{phaseContextIssue.title}</p>
            <p className="mt-2 font-gabarito text-sm text-[#73512d]">{phaseContextIssue.detail}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setMatchedRoomId(null);
                  setMatchmakingState("idle");
                  setMatchmakingStage("finding");
                  setMatchmakingError(null);
                  setPhase("character-select");
                }}
                className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "#fffdfa" }}
              >
                Back To Character Select
              </button>
              <button
                type="button"
                onClick={() => {
                  setMatchedRoomId(null);
                  setSelectedScientist(initialScientist);
                  setMatchmakingState("idle");
                  setMatchmakingStage("finding");
                  setMatchmakingError(null);
                  setPhase("setup");
                }}
                className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "#fffdfa" }}
              >
                Restart Lobby
              </button>
            </div>
          </div>
        </div>
      ) : (
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
                  beginMatchmaking();
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
              state={matchmakingState === "idle" ? "searching" : matchmakingState}
              stage={matchmakingStage}
              errorMessage={matchmakingError}
              onRetry={() => {
                void startMatchmakingSearch();
              }}
              onCancel={cancelMatchmaking}
            />
          </motion.div>
        )}

        {phase === "found" && selectedScientist && selectedArena && matchedRoomId && (
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
              scientists={SCIENTISTS}
              myWallet={walletAddr}
              roomId={matchedRoomId}
              arena={selectedArena}
              wagerUsd={FIXED_WAGER_USD}
              onTimeout={() => {
                setMatchedRoomId(null);
                setPhase("character-select");
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      )
      )}
    </div>
  );
}

