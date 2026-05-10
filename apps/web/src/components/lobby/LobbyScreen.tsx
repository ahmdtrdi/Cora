"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { AnimatePresence, motion } from "framer-motion";
import { LobbySetup } from "./LobbySetup";
import { CharacterSelect } from "./CharacterSelect";
import { MatchmakingWaiting } from "./MatchmakingWaiting";
import { OpponentFound } from "./OpponentFound";
import { getActiveMatchForAddress, getMatchPresenceForAddress, queueMatch } from "@/lib/matchmaking/queueMatch";
import { getRuntimeConfig } from "@/lib/config/runtimeModes";
import { RoomPhaseShell } from "@/components/room/RoomPhaseShell";
import { CharacterSelect as CharacterSelectPanel } from "@/components/character/CharacterSelect";
import { useMatchSocket } from "@/hooks/useMatchSocket";
import {
  getMatchSessionAddress,
  getMatchSessionToken,
  isLiveMatchSession,
  readActiveMatchSession,
  readLobbyDraftSnapshot,
  writeActiveMatchSession,
  writeLobbyDraftSnapshot,
  type ActiveMatchSession,
  type LobbyDraftSnapshot,
} from "@/lib/session/matchSession";
import type {
  CharacterOption,
  CharacterSelectionState,
  OpponentCharacterStatus,
} from "@/components/character/characterTypes";

export type Scientist = {
  id: string;
  name: string;
  base: string;
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
    accentColor: "#9db496",
    portraitBg: "linear-gradient(160deg, #152920 0%, #274137 60%, #0d1f18 100%)",
    initial: "T",
  },
  {
    id: "curie",
    name: "Marie Curie",
    base: "The Radium Reactor",
    accentColor: "#ba6931",
    portraitBg: "linear-gradient(160deg, #3d1f0a 0%, #5c2e12 60%, #210e04 100%)",
    initial: "C",
  },
  {
    id: "einstein",
    name: "Albert Einstein",
    base: "The Relativity Room",
    accentColor: "#f8d694",
    portraitBg: "linear-gradient(160deg, #12122a 0%, #1e1e3f 60%, #080814 100%)",
    initial: "E",
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
const MATCHMAKING_PRESENCE_POLL_MS = 4_000;
const POST_MATCH_FOUND_VERIFY_MS = 1400;
const POST_MATCH_FOUND_PREPARE_MS = 1000;
const PHASE_VARIANTS = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.02 },
};

function shortenAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

type ActiveRoomSnapshot = ActiveMatchSession;

type ActiveMatchSurrenderBridgeProps = {
  roomId: string;
  address: string;
  onSubmitted: () => void;
  onTimeout: () => void;
};

function ActiveMatchSurrenderBridge({
  roomId,
  address,
  onSubmitted,
  onTimeout,
}: ActiveMatchSurrenderBridgeProps) {
  const { connectionState, surrender } = useMatchSocket({ roomId, address });
  const submittedRef = useRef(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!submittedRef.current) {
        onTimeout();
      }
    }, 10_000);
    return () => clearTimeout(timeoutId);
  }, [onTimeout]);

  useEffect(() => {
    if (connectionState !== "connected") return;
    if (submittedRef.current) return;
    submittedRef.current = true;
    surrender();
    onSubmitted();
  }, [connectionState, onSubmitted, surrender]);

  return null;
}

export function LobbyScreen() {
  const runtimeConfig = getRuntimeConfig();
  const router = useRouter();
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
  const [matchedRole, setMatchedRole] = useState<"playerA" | "playerB" | null>(null);
  const [matchmakingState, setMatchmakingState] = useState<MatchmakingState>("idle");
  const [matchmakingStage, setMatchmakingStage] = useState<MatchmakingStage>("finding");
  const [matchmakingError, setMatchmakingError] = useState<string | null>(null);
  const [activeMatchBannerSnapshot, setActiveMatchBannerSnapshot] = useState<ActiveRoomSnapshot | null>(null);
  const [activeMatchSurrenderSnapshot, setActiveMatchSurrenderSnapshot] = useState<ActiveRoomSnapshot | null>(null);
  const [activeMatchSurrenderModalOpen, setActiveMatchSurrenderModalOpen] = useState(false);
  const [activeMatchToast, setActiveMatchToast] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [pendingErRecovery, setPendingErRecovery] = useState(false);
  const [erSettling, setErSettling] = useState(false);
  const matchmakingAbortRef = useRef<AbortController | null>(null);
  const matchmakingRequestIdRef = useRef(0);
  const userCancelledRef = useRef(false);
  const foundTransitionTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const autoRequeueStartedRef = useRef(false);
  const queueSelfHealInFlightRef = useRef(false);
  const draftHydratedRef = useRef(false);
  const activeRoomHydratedRef = useRef(false);
  const activeRoomLookupAbortRef = useRef<AbortController | null>(null);

  const selectedArena = useMemo(
    () => ARENAS.find((arena) => arena.id === selectedArenaId) ?? null,
    [selectedArenaId],
  );
  const characterOptions = useMemo<CharacterOption[]>(
    () => SCIENTISTS.map((scientist) => ({ ...scientist })),
    [],
  );
  const previewEnabled = runtimeConfig.allowDevRoomPreview;
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
  const isSelectingCharacterPreview =
    previewEnabled &&
    previewPhase === "selecting_character" &&
    Boolean(selectedArena);

  const walletConnected = Boolean(publicKey);
  const walletAddress = publicKey?.toBase58() ?? "";
  const walletAddr = walletAddress || "Not connected";
  const activeMatchBannerArena =
    activeMatchBannerSnapshot?.arenaId ? ARENAS.find((arena) => arena.id === activeMatchBannerSnapshot.arenaId) ?? null : null;
  const activeMatchBannerToken = getMatchSessionToken(activeMatchBannerSnapshot) ?? activeMatchBannerArena?.token ?? "SOL";
  const activeMatchBannerWager = activeMatchBannerSnapshot?.wagerUsd ?? FIXED_WAGER_USD;
  const canSurrenderActiveMatch = activeMatchBannerSnapshot?.canSurrenderByState === true;

  const wagerNumber = Number(FIXED_WAGER_USD);
  const hasValidWager = Number.isFinite(wagerNumber) && wagerNumber > 0;

  const canStart = walletConnected && Boolean(selectedArena) && hasValidWager;
  const canQueue = Boolean(selectedScientist) && Boolean(selectedArena);
  const waitingMissingContext = phase === "waiting" && (!selectedArena || !selectedScientist);
  const foundMissingContext =
    phase === "found" && (!selectedArena || !selectedScientist || !matchedRoomId);
  const phaseContextIssue = useMemo(() => (
    waitingMissingContext
      ? {
        title: "Queue session missing context",
        detail: "Room setup was refreshed before queue state finished syncing.",
      }
      : foundMissingContext
        ? {
          title: "Match room context missing",
          detail: "Opponent-found state lost required room data. Return to character select and re-queue.",
        }
        : null
  ), [foundMissingContext, waitingMissingContext]);
  const showPendingErRecovery = pendingErRecovery && Boolean(walletAddress);
  const showErSettling = erSettling && Boolean(phaseContextIssue) && Boolean(matchedRoomId) && Boolean(walletAddress);

  const clearFoundTransitionTimers = useCallback(() => {
    for (const timerId of foundTransitionTimeoutsRef.current) {
      clearTimeout(timerId);
    }
    foundTransitionTimeoutsRef.current = [];
  }, []);

  const openRecoveredRoom = useCallback((snapshot: {
    roomId: string;
    role?: "playerA" | "playerB" | null;
    status?: string | null;
    arenaId?: string | null;
    token?: string | null;
    wagerUsd?: string | null;
    scientistId?: string | null;
  }) => {
    const nextArenaId =
      snapshot.arenaId && ARENAS.some((arena) => arena.id === snapshot.arenaId)
        ? snapshot.arenaId
        : selectedArenaId;
    const nextScientistId = snapshot.scientistId ?? selectedScientist?.id ?? null;
    const nextScientist =
      nextScientistId ? SCIENTISTS.find((scientist) => scientist.id === nextScientistId) ?? null : null;
    const nextArena = nextArenaId ? ARENAS.find((arena) => arena.id === nextArenaId) ?? null : null;

    if (nextArenaId && nextArenaId !== selectedArenaId) {
      setSelectedArenaId(nextArenaId);
    }
    if (nextScientist && nextScientist.id !== selectedScientist?.id) {
      setSelectedScientist(nextScientist);
    }

    setMatchedRoomId(snapshot.roomId);
    setMatchedRole(snapshot.role ?? null);
    setMatchmakingState("idle");
    setMatchmakingStage("finding");
    setMatchmakingError(null);
    setActiveMatchBannerSnapshot(null);
    setActiveMatchSurrenderSnapshot(null);
    setActiveMatchSurrenderModalOpen(false);
    setPendingErRecovery(false);
    clearFoundTransitionTimers();

    writeActiveMatchSession({
      walletAddress,
      address: walletAddress,
      roomId: snapshot.roomId,
      role: snapshot.role ?? null,
      arenaId: nextArenaId ?? null,
      scientistId: nextScientist?.id ?? null,
      status: snapshot.status ?? null,
      token: snapshot.token ?? nextArena?.token ?? null,
      arenaToken: snapshot.token ?? nextArena?.token ?? null,
      wagerUsd: snapshot.wagerUsd ?? FIXED_WAGER_USD,
    });

    if (snapshot.status === "playing") {
      const params = new URLSearchParams({
        roomId: snapshot.roomId,
        arena: nextArenaId ?? "sol",
      });
      if (nextScientist?.id) {
        params.set("scientist", nextScientist.id);
      }
      router.replace(`/play?${params.toString()}`);
      return;
    }

    setPhase("found");
  }, [
    clearFoundTransitionTimers,
    router,
    selectedArenaId,
    selectedScientist,
    setMatchedRoomId,
    setMatchedRole,
    setMatchmakingError,
    setMatchmakingStage,
    setMatchmakingState,
    setPhase,
    setSelectedArenaId,
    setSelectedScientist,
    walletAddress,
  ]);

  const clearActiveMatchBanner = useCallback(() => {
    writeActiveMatchSession(null);
    setActiveMatchBannerSnapshot(null);
    setActiveMatchSurrenderSnapshot(null);
    setActiveMatchSurrenderModalOpen(false);
  }, []);

  const handleRejoinActiveMatch = useCallback(() => {
    if (!activeMatchBannerSnapshot?.roomId) return;
    writeActiveMatchSession(activeMatchBannerSnapshot);
    const params = new URLSearchParams({
      roomId: activeMatchBannerSnapshot.roomId,
      arena: activeMatchBannerSnapshot.arenaId ?? "sol",
    });
    setActiveMatchBannerSnapshot(null);
    setActiveMatchSurrenderSnapshot(null);
    setActiveMatchSurrenderModalOpen(false);
    router.push(`/play?${params.toString()}`);
  }, [
    activeMatchBannerSnapshot,
    router,
  ]);

  const handleConfirmActiveMatchSurrender = useCallback(() => {
    if (!activeMatchBannerSnapshot?.roomId) return;
    const surrenderAddress = getMatchSessionAddress(activeMatchBannerSnapshot) || walletAddress;
    if (!surrenderAddress) {
      clearActiveMatchBanner();
      setActiveMatchToast({ text: "Could not connect - try rejoining instead", tone: "error" });
      return;
    }

    setActiveMatchSurrenderModalOpen(false);
    setActiveMatchSurrenderSnapshot({
      ...activeMatchBannerSnapshot,
      walletAddress: surrenderAddress,
      address: surrenderAddress,
    });
  }, [activeMatchBannerSnapshot, clearActiveMatchBanner, walletAddress]);

  const handleActiveMatchSurrenderSubmitted = useCallback(() => {
    clearActiveMatchBanner();
    setActiveMatchToast({ text: "Surrender submitted", tone: "success" });
  }, [clearActiveMatchBanner]);

  const handleActiveMatchSurrenderTimeout = useCallback(() => {
    clearActiveMatchBanner();
    setActiveMatchToast({ text: "Could not connect - try rejoining instead", tone: "error" });
  }, [clearActiveMatchBanner]);

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
    setMatchedRole(null);
    clearFoundTransitionTimers();

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, MATCHMAKING_TIMEOUT_MS);

    try {
      const { roomId, role, alreadyInRoom, status } = await queueMatch({
        address: walletAddress,
        tokenMint: selectedArena?.token,
        signal: controller.signal,
      });

      if (requestId !== matchmakingRequestIdRef.current) return;

      if (alreadyInRoom) {
        openRecoveredRoom({
          roomId,
          role: role ?? null,
          status: status ?? null,
          arenaId: selectedArena?.id ?? null,
          token: selectedArena?.token ?? null,
          wagerUsd: FIXED_WAGER_USD,
          scientistId: selectedScientist?.id ?? null,
        });
        return;
      }

      setMatchedRoomId(roomId);
      setMatchedRole(role ?? null);
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
    selectedArena,
    selectedScientist,
    clearFoundTransitionTimers,
    openRecoveredRoom,
    setMatchmakingState,
    setMatchmakingError,
    setMatchedRoomId,
    setMatchedRole,
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
    writeActiveMatchSession(null);
    setMatchedRole(null);
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
    if (!activeMatchToast) return;
    const timeoutId = setTimeout(() => {
      setActiveMatchToast(null);
    }, 5000);
    return () => clearTimeout(timeoutId);
  }, [activeMatchToast]);

  useEffect(() => {
    if (phase !== "waiting") return;
    if (matchmakingState !== "searching") return;
    if (!walletAddress) return;

    let cancelled = false;

    const pollPresence = async () => {
      try {
        const presence = await getMatchPresenceForAddress(walletAddress);
        if (cancelled) return;

        if (presence.inRoom && presence.roomId) {
          openRecoveredRoom({
            roomId: presence.roomId,
            role: presence.role ?? null,
            status: presence.status ?? null,
            arenaId: selectedArena?.id ?? null,
            token: selectedArena?.token ?? null,
            wagerUsd: FIXED_WAGER_USD,
            scientistId: selectedScientist?.id ?? null,
          });
          return;
        }

        if (presence.queued || queueSelfHealInFlightRef.current) {
          return;
        }

        queueSelfHealInFlightRef.current = true;
        console.warn("[LobbyScreen] Queue presence lost on backend; restarting matchmaking request.");
        matchmakingAbortRef.current?.abort();
        await startMatchmakingSearch();
      } catch (error) {
        if (!cancelled) {
          console.warn("[LobbyScreen] Queue presence check failed.", error);
        }
      } finally {
        queueSelfHealInFlightRef.current = false;
      }
    };

    void pollPresence();
    const intervalId = setInterval(() => {
      void pollPresence();
    }, MATCHMAKING_PRESENCE_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      queueSelfHealInFlightRef.current = false;
    };
  }, [
    matchmakingState,
    openRecoveredRoom,
    phase,
    selectedArena?.id,
    selectedArena?.token,
    selectedScientist?.id,
    startMatchmakingSearch,
    walletAddress,
  ]);

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
      const snapshot = readLobbyDraftSnapshot();
      if (!snapshot) return;

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
    if (activeRoomHydratedRef.current) return;
    activeRoomHydratedRef.current = true;

    const snapshot = readActiveMatchSession();
    if (!snapshot) return;

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

      if (isLiveMatchSession(snapshot)) {
        setActiveMatchBannerSnapshot(snapshot);
      }
    });
  }, [selectedArenaId, selectedScientist]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const snapshot: LobbyDraftSnapshot = {
      arenaId: selectedArenaId,
      scientistId: selectedScientist?.id ?? null,
    };
    writeLobbyDraftSnapshot(snapshot);
  }, [selectedArenaId, selectedScientist?.id]);

  useEffect(() => {
    if (!walletAddress) {
      activeRoomLookupAbortRef.current?.abort();
      activeRoomLookupAbortRef.current = null;
      return;
    }

    const storedSnapshot = readActiveMatchSession();
    const storedSnapshotAddress = getMatchSessionAddress(storedSnapshot);
    const isStoredDepositingSnapshot =
      storedSnapshot?.status === "depositing" && Boolean(storedSnapshot.roomId) && phase === "setup";

    if (storedSnapshot && storedSnapshotAddress && storedSnapshotAddress !== walletAddress) {
      writeActiveMatchSession(null);
      queueMicrotask(() => {
        setActiveMatchBannerSnapshot(null);
        setPendingErRecovery(false);
      });
    } else if (storedSnapshot?.roomId && phase === "setup") {
      if (isLiveMatchSession(storedSnapshot)) {
        queueMicrotask(() => {
          setActiveMatchBannerSnapshot(storedSnapshot);
        });
      } else if (isStoredDepositingSnapshot) {
        queueMicrotask(() => {
          setPendingErRecovery(true);
        });
      } else {
        queueMicrotask(() => {
          openRecoveredRoom(storedSnapshot);
        });
      }
    }

    const controller = new AbortController();
    activeRoomLookupAbortRef.current?.abort();
    activeRoomLookupAbortRef.current = controller;

    void (async () => {
      let pollAttempts = 0;

      const clearRecoveryToSetup = (toastText?: string) => {
        writeActiveMatchSession(null);
        setPendingErRecovery(false);
        setMatchedRoomId(null);
        setMatchedRole(null);
        setMatchmakingState("idle");
        setMatchmakingStage("finding");
        setMatchmakingError(null);
        setActiveMatchBannerSnapshot(null);
        setPhase("setup");
        if (toastText) {
          setActiveMatchToast({ text: toastText, tone: "error" });
        }
      };

      try {
        while (!controller.signal.aborted) {
          try {
            const activeMatch = await getActiveMatchForAddress(walletAddress, controller.signal);
            if (controller.signal.aborted) return;

            if (!activeMatch.inRoom || !activeMatch.roomId) {
              const snapshot = readActiveMatchSession();
              if (getMatchSessionAddress(snapshot) === walletAddress) {
                writeActiveMatchSession(null);
                setActiveMatchBannerSnapshot(null);
              }

              if (isStoredDepositingSnapshot) {
                clearRecoveryToSetup();
              } else {
                setPendingErRecovery(false);
              }
              return;
            }

            const latestSnapshot = readActiveMatchSession();
            if (activeMatch.status === "playing") {
              const liveSnapshot: ActiveRoomSnapshot = {
                walletAddress,
                address: walletAddress,
                roomId: activeMatch.roomId,
                role: activeMatch.role ?? latestSnapshot?.role ?? null,
                arenaId: latestSnapshot?.arenaId ?? selectedArenaId,
                scientistId: latestSnapshot?.scientistId ?? selectedScientist?.id ?? null,
                status: "playing",
                token: getMatchSessionToken(latestSnapshot) ?? selectedArena?.token ?? null,
                arenaToken: getMatchSessionToken(latestSnapshot) ?? selectedArena?.token ?? null,
                wagerUsd: latestSnapshot?.wagerUsd ?? FIXED_WAGER_USD,
                canSurrenderByState: latestSnapshot?.canSurrenderByState ?? false,
              };
              writeActiveMatchSession(liveSnapshot);
              setActiveMatchBannerSnapshot(liveSnapshot);

              if (isStoredDepositingSnapshot) {
                openRecoveredRoom(liveSnapshot);
              }
              return;
            }

            if (isStoredDepositingSnapshot) {
              if (activeMatch.status === "finished") {
                clearRecoveryToSetup();
                return;
              }

              setPendingErRecovery(true);
            } else {
              openRecoveredRoom({
                roomId: activeMatch.roomId,
                role: activeMatch.role ?? latestSnapshot?.role ?? null,
                status: activeMatch.status ?? latestSnapshot?.status ?? null,
                arenaId: latestSnapshot?.arenaId ?? selectedArenaId,
                token: getMatchSessionToken(latestSnapshot) ?? selectedArena?.token ?? null,
                wagerUsd: latestSnapshot?.wagerUsd ?? FIXED_WAGER_USD,
                scientistId: latestSnapshot?.scientistId ?? selectedScientist?.id ?? null,
              });
              return;
            }

            pollAttempts = 0;
          } catch (error) {
            if (controller.signal.aborted) return;

            if (!isStoredDepositingSnapshot) {
              throw error;
            }

            pollAttempts += 1;
            if (pollAttempts >= 5) {
              console.warn("Failed to confirm pending match status.", error);
              clearRecoveryToSetup("Could not confirm match status");
              return;
            }
          }

          await new Promise<void>((resolve) => {
            const timeoutId = setTimeout(resolve, 2000);
            controller.signal.addEventListener("abort", () => {
              clearTimeout(timeoutId);
              resolve();
            }, { once: true });
          });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("Failed to restore active room.", error);
      } finally {
        if (activeRoomLookupAbortRef.current === controller) {
          activeRoomLookupAbortRef.current = null;
        }
      }
    })();

    return () => {
      controller.abort();
      if (activeRoomLookupAbortRef.current === controller) {
        activeRoomLookupAbortRef.current = null;
      }
    };
  }, [walletAddress, phase, openRecoveredRoom, selectedArena, selectedArenaId, selectedScientist]);

  useEffect(() => {
    if (phase === "found" && pendingErRecovery) {
      queueMicrotask(() => {
        setPendingErRecovery(false);
      });
    }
  }, [pendingErRecovery, phase]);

  useEffect(() => {
    if (!phaseContextIssue || !matchedRoomId || !walletAddress) return;

    let cancelled = false;
    let inFlight = false;

    const pollMatchSettlement = async () => {
      if (inFlight) return;
      inFlight = true;

      try {
        const activeMatch = await getActiveMatchForAddress(walletAddress);
        if (cancelled) return;

        if (!activeMatch.inRoom || activeMatch.status !== "depositing") {
          setErSettling(false);
        } else {
          setErSettling(true);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to poll ER settlement state.", error);
        }
      } finally {
        inFlight = false;
      }
    };

    queueMicrotask(() => {
      if (!cancelled) {
        setErSettling(true);
      }
    });
    void pollMatchSettlement();
    const intervalId = setInterval(() => {
      void pollMatchSettlement();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [matchedRoomId, phaseContextIssue, walletAddress]);

  useEffect(() => {
    if (!walletAddress || !matchedRoomId) return;
    writeActiveMatchSession({
      walletAddress,
      address: walletAddress,
      roomId: matchedRoomId,
      role: matchedRole,
      arenaId: selectedArena?.id ?? null,
      scientistId: selectedScientist?.id ?? null,
      status: phase === "found" ? "depositing" : null,
      token: selectedArena?.token ?? null,
      arenaToken: selectedArena?.token ?? null,
      wagerUsd: FIXED_WAGER_USD,
    });
  }, [walletAddress, matchedRoomId, matchedRole, selectedArena?.id, selectedArena?.token, selectedScientist?.id, phase]);

  return (
    <div
      className="relative min-h-[100svh] overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 30%, rgba(168,143,104,0.22), transparent 45%), linear-gradient(180deg, #2b3a32 0%, #223229 50%, #1a251f 100%)",
      }}
    >
      {activeMatchSurrenderSnapshot?.roomId && getMatchSessionAddress(activeMatchSurrenderSnapshot) && (
        <ActiveMatchSurrenderBridge
          roomId={activeMatchSurrenderSnapshot.roomId}
          address={getMatchSessionAddress(activeMatchSurrenderSnapshot)}
          onSubmitted={handleActiveMatchSurrenderSubmitted}
          onTimeout={handleActiveMatchSurrenderTimeout}
        />
      )}
      {activeMatchBannerSnapshot && (
        <div className="fixed inset-x-0 top-0 z-[90] p-3 md:p-4">
          <div
            className="mx-auto w-full max-w-5xl frame-cut px-4 py-3 shadow-2xl md:px-5"
            style={{
              border: "1px solid rgba(248,214,148,0.36)",
              background:
                "linear-gradient(140deg, rgba(12,21,17,0.97) 0%, rgba(18,31,25,0.97) 52%, rgba(28,45,37,0.97) 100%)",
            }}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-gabarito text-[11px] font-black uppercase tracking-[0.2em] text-[rgba(248,214,148,0.82)]">
                  {"\u2694"} You have an active match
                </p>
                <p className="mt-1 font-gabarito text-sm text-[rgba(244,240,230,0.9)]">
                  {activeMatchBannerArena?.label ?? "Arena battle"} - ${activeMatchBannerWager} {activeMatchBannerToken}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRejoinActiveMatch}
                  className="btn-game btn-game-primary px-4 py-2 text-xs shadow-xl"
                >
                  Rejoin Match
                </button>
                {canSurrenderActiveMatch && (
                  <button
                    type="button"
                    onClick={() => setActiveMatchSurrenderModalOpen(true)}
                    className="btn-game btn-game-secondary px-4 py-2 text-xs shadow-xl"
                  >
                    Surrender Match
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {activeMatchToast && (
        <div className="fixed left-1/2 top-24 z-[100] w-full max-w-md -translate-x-1/2 px-4">
          <div
            className="frame-cut px-4 py-3 shadow-2xl backdrop-blur-md"
            style={{
              border:
                activeMatchToast.tone === "success"
                  ? "2px solid rgba(157,180,150,0.7)"
                  : "2px solid rgba(186,105,49,0.78)",
              background:
                activeMatchToast.tone === "success"
                  ? "linear-gradient(145deg, #1b2d25 0%, #274137 100%)"
                  : "linear-gradient(145deg, #2c1810 0%, #3d2315 100%)",
            }}
          >
            <p className="font-gabarito text-sm font-bold text-[rgba(244,240,230,0.92)]">{activeMatchToast.text}</p>
          </div>
        </div>
      )}
      {activeMatchSurrenderModalOpen && activeMatchBannerSnapshot && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-[rgba(2,6,5,0.82)] p-4">
          <div
            className="frame-cut w-full max-w-lg p-5 md:p-6"
            style={{ border: "1px solid rgba(248,214,148,0.42)", background: "rgba(13,24,20,0.96)" }}
          >
            <p className="font-caprasimo text-3xl text-[var(--tone-cream)] md:text-4xl">Surrender match?</p>
            <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.86)]">
              Surrendering ends the match. Your rival receives the wager. Confirm?
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setActiveMatchSurrenderModalOpen(false)}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmActiveMatchSurrender}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(186,105,49,0.42)", color: "var(--tone-cream)", background: "rgba(77,42,24,0.92)" }}
              >
                Confirm Surrender
              </button>
            </div>
          </div>
        </div>
      )}
      {activeMatchSurrenderSnapshot && (
        <div className="fixed inset-0 z-[96] grid place-items-center bg-[rgba(2,6,5,0.82)] p-4">
          <div
            className="frame-cut w-full max-w-md p-5 text-center md:p-6"
            style={{ border: "1px solid rgba(248,214,148,0.42)", background: "rgba(13,24,20,0.96)" }}
          >
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[rgba(248,214,148,0.24)] border-t-[var(--tone-cream)]" />
            <p className="mt-4 font-caprasimo text-2xl text-[var(--tone-cream)]">Connecting to room...</p>
            <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.78)]">
              Submitting surrender as soon as the match socket reconnects.
            </p>
          </div>
        </div>
      )}
      {/* Background World Elements */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="paper-grain absolute inset-0 opacity-25" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_32%,rgba(12,18,15,0.72)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,24,20,0.26)_0%,rgba(9,13,11,0.42)_100%)]" />

        {/* Warm Spotlight Glow behind the modal */}
        <div className="absolute left-1/2 top-1/2 h-[860px] w-[860px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--tone-clay)] opacity-14 mix-blend-screen blur-[160px]" />

        {/* Ambient floating doodles */}
        <div className="absolute left-[8%] top-[14%] opacity-20 md:left-[11%] md:top-[11%]">
          <div className="animate-float-card text-6xl drop-shadow-md" style={{ transform: "rotate(-12deg)" }}>
            <div className="h-6 w-6 rounded-full border border-[rgba(248,214,148,0.38)] bg-[rgba(248,214,148,0.14)]" />
          </div>
        </div>
        <div className="absolute right-[9%] top-[20%] opacity-20 md:right-[14%] md:top-[17%]" style={{ animationDelay: "0.4s" }}>
          <div className="animate-float-card text-5xl drop-shadow-md" style={{ transform: "rotate(15deg)" }}>
            <div className="h-5 w-5 rounded-full border border-[rgba(157,180,150,0.42)] bg-[rgba(157,180,150,0.15)]" />
          </div>
        </div>
        <div className="absolute bottom-[17%] left-[10%] opacity-20 md:bottom-[20%] md:left-[15%]" style={{ animationDelay: "1.2s" }}>
          <div className="animate-float-card text-5xl drop-shadow-md" style={{ transform: "rotate(-8deg)" }}>
            <div className="h-5 w-5 rounded-full border border-[rgba(203,227,193,0.42)] bg-[rgba(203,227,193,0.16)]" />
          </div>
        </div>
        <div className="absolute bottom-[21%] right-[10%] opacity-20 md:bottom-[24%] md:right-[13%]" style={{ animationDelay: "0.8s" }}>
          <div className="animate-float-card text-6xl drop-shadow-md" style={{ transform: "rotate(6deg)" }}>
            <div className="h-6 w-6 rounded-full border border-[rgba(186,105,49,0.4)] bg-[rgba(186,105,49,0.14)]" />
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[45rem] font-caprasimo text-[var(--tone-bark)] opacity-[0.04]">
          C
        </div>
        <div className="animate-sparkle absolute left-[30%] top-[20%] h-2 w-2 rounded-full bg-[var(--tone-clay)] opacity-45" />
        <div className="animate-sparkle absolute bottom-[25%] right-[25%] h-3 w-3 rounded-full bg-[var(--tone-teal)] opacity-45" style={{ animationDelay: "1s" }} />
        <div className="animate-sparkle absolute left-[20%] top-[50%] h-1.5 w-1.5 rounded-full bg-[var(--tone-sage)] opacity-60" style={{ animationDelay: "0.5s" }} />
      </div>
      {challengeMode && (
        <div className="fixed right-4 top-4 z-[70] w-full max-w-sm md:right-6 md:top-6">
          <div
            className="frame-cut px-3 py-2 shadow-xl backdrop-blur-md"
            style={{ border: "2px solid var(--tone-clay)", background: "var(--warm-surface)" }}
          >
            <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[var(--tone-bark)]">
              Challenge Received
            </p>
            <p className="mt-1 font-gabarito text-xs text-[var(--warm-text)]">
              {challengedBy ? `From ${shortenAddress(challengedBy)}` : "A rival challenged you."}
            </p>
            <p className="mt-1 font-mono text-xs font-semibold text-[var(--tone-forest)]">
              {requestedToken ?? "SOL"} arena - ${requestedWager ?? FIXED_WAGER_USD}
            </p>
          </div>
        </div>
      )}
      {!walletConnected && (phase === "waiting" || phase === "found") && (
        <div className="fixed left-4 top-4 z-[70] w-full max-w-sm md:left-6 md:top-6">
          <div
            className="frame-cut px-3 py-2 shadow-xl backdrop-blur-md"
            style={{ border: "2px solid var(--tone-bark)", background: "var(--warm-surface)" }}
          >
            <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[var(--tone-bark)]">
              Wallet disconnected
            </p>
            <p className="mt-1 font-gabarito text-xs text-[var(--warm-text)]">
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
                style={{ border: `1px solid ${selectedArena.frame}`, color: selectedArena.frame, background: "var(--color-surface)" }}
              >
                {selectedArena.label}
              </span>
              <span
                className="frame-cut frame-cut-sm px-3 py-2 font-mono text-xs font-semibold tracking-wide text-[var(--tone-cream)]"
                style={{ border: "1px solid var(--tone-bark)", background: "var(--color-surface)" }}
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
        showPendingErRecovery ? (
          <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-3xl items-center justify-center px-4 py-8 md:px-6">
            <div
              className="game-card w-full p-6 text-center shadow-2xl md:p-8"
              style={{
                border: "1px solid rgba(248,214,148,0.36)",
                background:
                  "linear-gradient(140deg, rgba(12,21,17,0.97) 0%, rgba(18,31,25,0.97) 52%, rgba(28,45,37,0.97) 100%)",
              }}
            >
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[rgba(248,214,148,0.24)] border-t-[var(--tone-cream)]" />
              <p className="mt-4 font-caprasimo text-3xl text-[var(--tone-cream)]">Confirming your match...</p>
              <div className="mt-3 inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(248,214,148,0.18)] bg-[rgba(248,214,148,0.08)] px-3 py-1">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--tone-cream)]" />
                <span className="font-gabarito text-xs font-black uppercase tracking-[0.18em] text-[rgba(248,214,148,0.88)]">
                  Escrow resolver is settling
                </span>
              </div>
              <p className="mt-4 font-gabarito text-sm text-[rgba(244,240,230,0.78)]">
                We&apos;re waiting for the latest room state before sending you back into the lobby.
              </p>
            </div>
          </div>
        ) : phaseContextIssue ? (
          <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-3xl items-center justify-center px-4 py-8 md:px-6">
            <div
              className="game-card w-full p-6 md:p-8 shadow-2xl"
              style={{ border: "2px solid var(--tone-bark)", background: "var(--warm-surface)" }}
            >
              <p className="font-caprasimo text-3xl text-[var(--tone-bark)]">{phaseContextIssue.title}</p>
              <p className="mt-2 font-gabarito text-sm text-[var(--warm-text)]">{phaseContextIssue.detail}</p>
              {showErSettling && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[rgba(60,92,95,0.16)] bg-[rgba(60,92,95,0.08)] px-3 py-1">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#3C5C5F]" />
                  <span className="font-gabarito text-xs font-black uppercase tracking-[0.18em] text-[#3C5C5F]">
                    Settling match...
                  </span>
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={showErSettling}
                  onClick={() => {
                    writeActiveMatchSession(null);
                    setMatchedRoomId(null);
                    setMatchedRole(null);
                    setMatchmakingState("idle");
                    setMatchmakingStage("finding");
                    setMatchmakingError(null);
                    setPhase("character-select");
                  }}
                  className={`btn-game btn-game-primary px-4 py-2 text-xs ${showErSettling ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  Back To Character Select
                </button>
                <button
                  type="button"
                  disabled={showErSettling}
                  onClick={() => {
                    setMatchedRoomId(null);
                    setMatchedRole(null);
                    setSelectedScientist(initialScientist);
                    setMatchmakingState("idle");
                    setMatchmakingStage("finding");
                    setMatchmakingError(null);
                    setPhase("setup");
                  }}
                  className={`btn-game btn-game-secondary px-4 py-2 text-xs ${showErSettling ? "cursor-not-allowed opacity-60" : ""}`}
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
                  myWallet={walletAddr}
                  roomId={matchedRoomId}
                  matchRole={matchedRole}
                  arena={selectedArena}
                  wagerUsd={FIXED_WAGER_USD}
                  onTimeout={() => {
                    // Fully reset matchmaking state — abort any hanging HTTP request,
                    // clear timers, and go back to character-select so the user can
                    // re-queue cleanly without phantom queue entries.
                    matchmakingAbortRef.current?.abort();
                    matchmakingAbortRef.current = null;
                    clearFoundTransitionTimers();
                    writeActiveMatchSession(null);
                    setMatchedRoomId(null);
                    setMatchedRole(null);
                    setMatchmakingState("idle");
                    setMatchmakingStage("finding");
                    setMatchmakingError(null);
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


