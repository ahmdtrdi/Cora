"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { HistoryButton } from "@/components/history/HistoryButton";
import { HydratedWalletButton } from "@/components/wallet/HydratedWalletButton";
import { useWalletArenaPlayability } from "@/hooks/useWalletArenaPlayability";
import type { Arena } from "./LobbyScreen";

type LobbySetupProps = {
  walletAddress: string;
  walletConnected: boolean;
  guestMode: boolean;
  guestAddress: string | null;
  arenas: Arena[];
  selectedArenaId: string | null;
  onSelectArena: (arenaId: string) => void;
  wagerUsd: string;
  canPlay: boolean;
  onPlay: () => void;
  onCreateBlinkChallenge: () => void;
  blinkChallengeBusy: boolean;
  hasActiveBlinkChallenge: boolean;
};

function truncateWallet(address: string) {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

function ArenaIcon({ token, active }: { token: string; active: boolean }) {
  const color = active ? "#4d2a18" : "var(--tone-bark)";
  if (token === "SOL") {
    const solColor = active ? "#214335" : "#4f6f5b";
    return (
      <svg width="20" height="20" viewBox="0 0 35 30" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: solColor }}>
        <path d="M6.3 0L0 6.3h28.7l6.3-6.3H6.3zm28.7 11.8L28.7 18.2H0l6.3-6.4h28.7zm-28.7 12L0 30h28.7l6.3-6.3H6.3z" fill="currentColor" />
      </svg>
    );
  }
  if (token === "MEW") {
    const mewColor = active ? "#1f3c3f" : "#3C5C5F";
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: mewColor }}>
        <path
          d="M6.5 9 4.8 5.2a.6.6 0 0 1 .94-.7L9 7.2c.9-.4 1.95-.7 3-.7 1.08 0 2.12.26 3.03.72l3.24-2.73a.6.6 0 0 1 .94.7L17.5 9c1.55 1.44 2.5 3.47 2.5 5.74C20 19.31 16.42 22 12 22s-8-2.69-8-7.26C4 12.47 4.95 10.44 6.5 9Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
      <path d="M12 8.5c-1.5 0-2.8-1.5-3-3.2C8.8 3.5 10.2 2 12 2s3.2 1.5 3 3.3c-.2 1.7-1.5 3.2-3 3.2zM6.5 11.5c-1.2 0-2.4-1.2-2.5-2.8C3.8 7 5 6 6.5 6s2.5 1 2.5 2.7c-.1 1.6-1.3 2.8-2.5 2.8zM17.5 11.5c-1.2 0-2.4-1.2-2.5-2.8C14.8 7 16 6 17.5 6s2.5 1 2.5 2.7c-.1 1.6-1.3 2.8-2.5 2.8zM12 11c2.5 0 4.5 2 5.5 4.5.2.5.5 1 .5 1.5C18 19 15.5 22 12 22s-6-3-6-5c0-.5.3-1 .5-1.5C7.5 13 9.5 11 12 11z" fill="currentColor" />
    </svg>
  );
}

export function LobbySetup({
  walletAddress,
  walletConnected,
  guestMode,
  guestAddress,
  arenas,
  selectedArenaId,
  onSelectArena,
  wagerUsd,
  canPlay,
  onPlay,
  onCreateBlinkChallenge,
  blinkChallengeBusy,
  hasActiveBlinkChallenge,
}: LobbySetupProps) {
  const ARENA_ASSET_VERSION = "2026-05-12-arena-refresh-1";
  const COMING_SOON_ARENA_ID = "mew";
  const COMING_SOON_ARENA_IDS = new Set(["bonk", COMING_SOON_ARENA_ID]);
  const NULL_ARENA_IMAGE_URL = `/assets/arena/null.png?v=${ARENA_ASSET_VERSION}`;
  const SOL_ARENA_IMAGE_URL = `/assets/arena/sol.png?v=${ARENA_ASSET_VERSION}`;
  const BONK_ARENA_IMAGE_URL = `/assets/arena/bonk.png?v=${ARENA_ASSET_VERSION}`;
  const MEW_ARENA_IMAGE_URL = `/assets/arena/mew.png?v=${ARENA_ASSET_VERSION}`;
  const rightBoardBackground =
    "radial-gradient(circle at 58% 42%, rgba(248,214,148,0.16), transparent 36%), linear-gradient(145deg, #10231b 0%, #18392d 48%, #0d1a14 100%)";
  const selectedArena = arenas.find((arena) => arena.id === selectedArenaId) ?? null;
  const mewArena = {
    id: COMING_SOON_ARENA_ID,
    token: "MEW",
    label: "MEW Arena",
    accent: "#b6afa1",
    frame: "#3C5C5F",
    previewBg:
      "radial-gradient(circle at 22% 24%, rgba(218,212,203,0.42), transparent 48%), radial-gradient(circle at 75% 78%, rgba(149,141,128,0.24), transparent 44%), linear-gradient(150deg, #f3efe7 0%, #ddd6ca 58%, #cbc3b7 100%)",
  } satisfies Arena;
  const selectedArenaDisplay = selectedArena ?? (selectedArenaId === COMING_SOON_ARENA_ID ? mewArena : null);
  const comingSoonArenaVisible = selectedArenaId !== null && COMING_SOON_ARENA_IDS.has(selectedArenaId);
  const actionDisabled = comingSoonArenaVisible || !canPlay;
  const actionLabel = comingSoonArenaVisible ? "Coming Soon" : "Pick Scientist";
  const guestAddressLabel = guestAddress ? `Guest ${truncateWallet(guestAddress)}` : "Guest";
  const identityLabel = guestMode ? guestAddressLabel : walletConnected ? truncateWallet(walletAddress) : "Wallet not connected";
  let arenaImageUrl = NULL_ARENA_IMAGE_URL;
  if (selectedArenaDisplay?.token === "SOL") {
    arenaImageUrl = SOL_ARENA_IMAGE_URL;
  } else if (selectedArenaDisplay?.token === "BONK") {
    arenaImageUrl = BONK_ARENA_IMAGE_URL;
  } else if (selectedArenaDisplay?.token === "MEW") {
    arenaImageUrl = MEW_ARENA_IMAGE_URL;
  }
  const [displayedArenaImageUrl, setDisplayedArenaImageUrl] = useState<string>(arenaImageUrl);
  const [loadedArenaImageUrls, setLoadedArenaImageUrls] = useState<Record<string, true>>({
    [arenaImageUrl]: true,
  });
  const incomingArenaImageUrl = arenaImageUrl !== displayedArenaImageUrl ? arenaImageUrl : null;
  const incomingArenaImageReady = incomingArenaImageUrl ? Boolean(loadedArenaImageUrls[incomingArenaImageUrl]) : false;

  const playabilityEnabled = !guestMode && walletConnected && Boolean(selectedArena) && !comingSoonArenaVisible;
  const { playability, loading, error } = useWalletArenaPlayability({
    address: walletConnected ? walletAddress : "",
    arenaId: selectedArena?.id ?? "",
    token: selectedArena?.token ?? "SOL",
    enabled: playabilityEnabled,
  });

  const tokenBalanceLabel = selectedArenaDisplay ? `${selectedArenaDisplay.token} Balance` : "Token Balance";
  const tokenBalanceValue = !selectedArenaDisplay
    ? "--"
    : comingSoonArenaVisible
      ? "Coming Soon"
    : guestMode
      ? "Practice only"
    : !walletConnected
      ? "--"
      : loading
        ? "Inspecting..."
        : error || !playability?.reliable
          ? "Unavailable"
          : (playability.tokenBalance ?? "--");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const preloads = [NULL_ARENA_IMAGE_URL, SOL_ARENA_IMAGE_URL, BONK_ARENA_IMAGE_URL, MEW_ARENA_IMAGE_URL];
    for (const url of preloads) {
      const image = new window.Image();
      image.onload = () => {
        setLoadedArenaImageUrls((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
      };
      image.onerror = () => {
        setLoadedArenaImageUrls((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
      };
      image.src = url;
    }
  }, []);

  useEffect(() => {
    if (!incomingArenaImageUrl || typeof window === "undefined") return;
    if (loadedArenaImageUrls[incomingArenaImageUrl]) return;

    let cancelled = false;
    const image = new window.Image();
    const targetUrl = incomingArenaImageUrl;
    const markLoaded = () => {
      if (cancelled) return;
      setLoadedArenaImageUrls((prev) => (prev[targetUrl] ? prev : { ...prev, [targetUrl]: true }));
    };

    image.onload = markLoaded;
    image.onerror = markLoaded;
    image.src = targetUrl;
    if (image.complete) {
      markLoaded();
    }

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [incomingArenaImageUrl, loadedArenaImageUrls]);

  useEffect(() => {
    if (!incomingArenaImageUrl || !incomingArenaImageReady) return;
    const id = setTimeout(() => {
      setDisplayedArenaImageUrl(incomingArenaImageUrl);
    }, 320);
    return () => clearTimeout(id);
  }, [incomingArenaImageReady, incomingArenaImageUrl]);

  return (
    <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col px-4 py-5 md:px-6 md:py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div
          className="frame-cut frame-cut-sm inline-flex items-center gap-3 px-3 py-2 shadow-lg"
          style={{
            border: "2px solid var(--tone-bark)",
            background: "linear-gradient(180deg, #1b3429 0%, #14271f 100%)",
            boxShadow: "inset 0 1px 0 rgba(203,227,193,0.2)",
          }}
        >
          <div className="h-6 w-6 rounded-full border border-[var(--tone-teal)] bg-[var(--tone-clay)]" />
          <p className="font-mono text-xs font-semibold tracking-wide text-[var(--tone-cream)]">
            {identityLabel}
          </p>
        </div>

        <div className="inline-flex items-center gap-2">
          <div
            className="frame-cut frame-cut-sm inline-flex items-center gap-2 px-3 py-2 shadow-lg"
            style={{
              border: "2px solid var(--tone-bark)",
              background: "linear-gradient(180deg, #1b3429 0%, #14271f 100%)",
              boxShadow: "inset 0 1px 0 rgba(203,227,193,0.2)",
            }}
          >
            <span className="font-gabarito text-xs font-bold uppercase tracking-wider text-[var(--tone-mint)] opacity-90">
              Wager ${wagerUsd || "0"}
              {selectedArenaDisplay ? ` · ${selectedArenaDisplay.token}` : ""}
            </span>
          </div>
          <div
            className="frame-cut frame-cut-sm inline-flex items-center gap-2 px-3 py-2 shadow-lg"
            style={{
              border: "2px solid var(--tone-bark)",
              background: "linear-gradient(180deg, #1b3429 0%, #14271f 100%)",
              boxShadow: "inset 0 1px 0 rgba(203,227,193,0.2)",
            }}
          >
            <span className="font-gabarito text-xs font-bold uppercase tracking-wider text-[var(--tone-mint)] opacity-90">
              {guestMode ? "Guest Mode" : `${tokenBalanceLabel}: ${tokenBalanceValue}`}
            </span>
          </div>
        </div>

        <HistoryButton label="History Coming Soon" />
      </header>

      <div
        className="game-card mt-2 flex w-full flex-col overflow-hidden shadow-2xl md:flex-row"
        style={{
          border: "3px solid var(--tone-bark)",
          background: "linear-gradient(180deg, #e7d8bb 0%, #dccaa7 100%)",
          boxShadow: "0 6px 0 rgba(111,58,40,0.35), 0 24px 55px rgba(8,15,12,0.45)",
        }}
      >
        <section
          className="w-full shrink-0 border-b p-5 md:w-[320px] md:border-b-0 md:border-r"
          style={{
            borderColor: "rgba(111,58,40,0.34)",
            background: "linear-gradient(180deg, #fff8e8 0%, #f3e6c9 100%)",
            boxShadow: "inset -1px 0 0 rgba(111,58,40,0.2), inset 0 1px 0 rgba(255,255,255,0.55)",
          }}
        >
          <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--tone-bark)] opacity-80">
            Arena Token
          </p>
          <p className="mb-4 mt-1 font-gabarito text-xs text-[var(--warm-text)]">Select your battleground</p>
          <div className="space-y-3">
            {arenas.map((arena) => {
              const active = selectedArenaId === arena.id;
              const flavor = arena.token === "SOL" ? "The Classic Arena" : "Meme Battleground";

              return (
                <button
                  key={arena.id}
                  type="button"
                  onClick={() => onSelectArena(arena.id)}
                  className={`frame-cut relative w-full px-4 py-3 text-left transition-all duration-200 ${
                    !active ? "opacity-90 hover:-translate-y-0.5" : "-translate-y-1 shadow-lg"
                  }`}
                  style={{
                    border: `2.5px solid ${active ? arena.accent : "rgba(111,58,40,0.28)"}`,
                    background: active
                      ? arena.token === "SOL"
                        ? "linear-gradient(180deg, #eef6ec 0%, #d2e2cd 100%)"
                        : "linear-gradient(180deg, #fff1cf 0%, #f8d694 100%)"
                      : "linear-gradient(180deg, #fffaf0 0%, #efe3c8 100%)",
                    boxShadow: active
                      ? `0 8px 0 rgba(111,58,40,0.22), 0 14px 24px ${arena.accent}55`
                      : "0 5px 0 rgba(111,58,40,0.14), 0 10px 20px rgba(111,58,40,0.08)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-inner transition-colors duration-200"
                      style={{ background: arena.previewBg, border: `1.5px solid ${arena.accent}` }}
                    >
                      <ArenaIcon token={arena.token} active={active} />
                    </div>
                    <div>
                      <p
                        className="font-gabarito text-base font-bold tracking-wide"
                        style={{ color: active ? "#4d2a18" : "var(--tone-bark)" }}
                      >
                        {arena.token}
                      </p>
                      <p className="font-gabarito text-[10px] uppercase tracking-wide text-[var(--warm-text)] opacity-80">
                        {flavor}
                      </p>
                    </div>
                  </div>
                  {active && (
                    <div
                      className="absolute right-4 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-xs font-black text-[#143324]"
                      style={{ border: "1px solid rgba(17,44,35,0.45)", background: "#d7f0d4" }}
                    >
                      {"\u2713"}
                    </div>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onSelectArena(COMING_SOON_ARENA_ID)}
              className={`frame-cut relative w-full px-4 py-3 text-left transition-all duration-200 ${
                selectedArenaId === COMING_SOON_ARENA_ID ? "-translate-y-1 shadow-lg" : "opacity-85 hover:-translate-y-0.5"
              }`}
              style={{
                border: `2.5px solid ${
                  selectedArenaId === COMING_SOON_ARENA_ID ? "#85A1A5" : "rgba(111,58,40,0.28)"
                }`,
                background:
                  selectedArenaId === COMING_SOON_ARENA_ID
                    ? "linear-gradient(180deg, #c8d8da 0%, #9db8bc 45%, #85A1A5 100%)"
                    : "linear-gradient(180deg, #fffaf0 0%, #efe3c8 100%)",
                boxShadow:
                  selectedArenaId === COMING_SOON_ARENA_ID
                    ? "0 8px 0 rgba(60,92,95,0.24), 0 14px 24px rgba(60,92,95,0.22)"
                    : "0 5px 0 rgba(111,58,40,0.14), 0 10px 20px rgba(111,58,40,0.08)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-inner"
                  style={{
                    background:
                      selectedArenaId === COMING_SOON_ARENA_ID
                        ? "linear-gradient(180deg, #c8d8da 0%, #9db8bc 45%, #85A1A5 100%)"
                        : mewArena.previewBg,
                    border: `1.5px solid ${selectedArenaId === COMING_SOON_ARENA_ID ? "#3C5C5F" : mewArena.accent}`,
                  }}
                >
                  <ArenaIcon token="MEW" active={selectedArenaId === COMING_SOON_ARENA_ID} />
                </div>
                <div>
                  <p
                    className="font-gabarito text-base font-bold tracking-wide"
                    style={{ color: selectedArenaId === COMING_SOON_ARENA_ID ? "#173235" : "var(--tone-bark)" }}
                  >
                    MEW
                  </p>
                  <p
                    className="font-gabarito text-[10px] uppercase tracking-wide"
                    style={{ color: selectedArenaId === COMING_SOON_ARENA_ID ? "rgba(23,50,53,0.76)" : "var(--warm-text)" }}
                  >
                    Meme Battleground
                  </p>
                </div>
              </div>
              {selectedArenaId === COMING_SOON_ARENA_ID && (
                <div
                  className="absolute right-4 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-xs font-black text-[#173235]"
                  style={{ border: "1px solid rgba(60,92,95,0.45)", background: "rgba(248,250,248,0.75)" }}
                >
                  {"\u2713"}
                </div>
              )}
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="frame-cut relative w-full cursor-not-allowed px-4 py-3 text-left opacity-65 grayscale"
              style={{
                border: "2.5px dashed rgba(111,58,40,0.18)",
                background: "linear-gradient(180deg, #efebe3 0%, #ded7ca 100%)",
                boxShadow: "0 5px 0 rgba(111,58,40,0.06), 0 10px 18px rgba(111,58,40,0.04)",
              }}
            >
              <p className="font-gabarito text-sm font-bold uppercase tracking-[0.18em] text-[rgba(77,42,24,0.56)]">
                and more to come
              </p>
            </button>
          </div>
        </section>

        <section
          className="relative flex min-h-[400px] grow flex-col justify-between overflow-hidden p-6 md:min-h-[500px] md:p-8"
          style={{ background: rightBoardBackground }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `url('${displayedArenaImageUrl}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          {incomingArenaImageUrl && (
            <div
              className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ease-out ${
                incomingArenaImageReady ? "opacity-100" : "opacity-0"
              }`}
              style={{
                backgroundImage: `url('${incomingArenaImageUrl}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_28%,rgba(0,0,0,0.58)_100%)]" />
          <div className="arena-grid pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay" />
          {selectedArena && (
            <div
              className="pointer-events-none absolute -right-20 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full blur-3xl"
              style={{ background: `${selectedArena.accent}4d` }}
            />
          )}

          <div className="pointer-events-none absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 text-center font-caprasimo text-[30rem] text-white opacity-[0.04] mix-blend-overlay">
            C
          </div>

          <div className="relative z-10 max-w-lg">
            <p
              className="font-gabarito text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--tone-cream)] opacity-90"
              style={{ textShadow: "0 4px 18px rgba(0,0,0,0.78), 0 2px 4px rgba(0,0,0,0.56)" }}
            >
              Pre-Match Lobby
            </p>
            <h1
              className="mt-2 font-caprasimo text-4xl leading-none text-[#fffaf0] md:text-5xl"
              style={{ textShadow: "0 10px 30px rgba(0,0,0,0.82), 0 3px 6px rgba(0,0,0,0.58)" }}
            >
              Choose Your Arena
            </h1>
            <p
              className="mt-3 max-w-md font-gabarito text-sm text-[var(--tone-cream)]"
              style={{ textShadow: "0 4px 18px rgba(0,0,0,0.78), 0 2px 4px rgba(0,0,0,0.56)" }}
            >
              {selectedArenaDisplay ? `Selected: ${selectedArenaDisplay.token} Arena` : "Pick SOL, BONK, or MEW, lock the wager, then draft your scientist."}
            </p>
          </div>

          <div className="relative z-10 mt-auto flex w-full flex-col items-end justify-end pt-12">
            <div className="flex w-full shrink-0 flex-col items-center md:w-auto md:items-end">
              {!selectedArenaDisplay && (
                <p className="mb-2 font-gabarito text-xs text-[var(--tone-cream)] opacity-80">Select a token to continue</p>
              )}
              {selectedArenaDisplay && !walletConnected && !guestMode && (
                <p className="mb-2 font-gabarito text-xs text-[var(--tone-cream)] opacity-80">Connect wallet to draft</p>
              )}
              <motion.button
                whileHover={!actionDisabled ? { y: -2 } : undefined}
                whileTap={!actionDisabled ? { scale: 0.98 } : undefined}
                type="button"
                onClick={() => {
                  if (!actionDisabled) {
                    onPlay();
                  }
                }}
                disabled={actionDisabled}
                className={`btn-game btn-game-primary w-full px-10 py-4 text-base shadow-2xl transition-all md:w-auto ${
                  actionDisabled ? "cursor-not-allowed opacity-50 grayscale" : ""
                }`}
              >
                {actionLabel}
              </motion.button>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-4 flex w-full flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {!walletConnected && !guestMode && (
            <>
              <p className="font-gabarito text-xs text-[#6f3a28]">
                Connect wallet to unlock queue and deposit signing.
              </p>
              <HydratedWalletButton />
            </>
          )}
          {!walletConnected && guestMode && (
            <>
              <p className="font-gabarito text-xs text-[#6f3a28]">
                You entered as guest. Please connect your wallet to unlock deposits and all possibilities of CORA.
              </p>
              <HydratedWalletButton />
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onCreateBlinkChallenge}
          disabled={!selectedArena || comingSoonArenaVisible || !walletConnected || blinkChallengeBusy}
          className={`btn-game btn-game-secondary shrink-0 px-5 py-2 text-xs shadow-md ${
            !selectedArena || comingSoonArenaVisible || !walletConnected || blinkChallengeBusy ? "opacity-50" : ""
          }`}
        >
          {blinkChallengeBusy ? "Opening Blink..." : hasActiveBlinkChallenge ? "View Active Blink" : "Create Blink Challenge"}
        </button>
      </div>
    </div>
  );
}
