"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { HydratedWalletButton } from "@/components/wallet/HydratedWalletButton";
import { ChallengeShareCard } from "@/components/challenge/ChallengeShareCard";
import { createChallengeLink, createChallengeTweetIntent } from "@/lib/challenge/createChallengeLink";
import { createChallengeCardFileName, renderChallengeCardJpg } from "@/lib/challenge/renderChallengeCardJpg";
import { useWalletArenaPlayability } from "@/hooks/useWalletArenaPlayability";
import type { Arena } from "./LobbyScreen";

type LobbySetupProps = {
  walletAddress: string;
  walletConnected: boolean;
  arenas: Arena[];
  selectedArenaId: string | null;
  onSelectArena: (arenaId: string) => void;
  wagerUsd: string;
  canPlay: boolean;
  onPlay: () => void;
};

function truncateWallet(address: string) {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

export function LobbySetup({
  walletAddress,
  walletConnected,
  arenas,
  selectedArenaId,
  onSelectArena,
  wagerUsd,
  canPlay,
  onPlay,
}: LobbySetupProps) {
  const rightBoardBackground =
    "radial-gradient(circle at 58% 42%, rgba(248,214,148,0.16), transparent 36%), linear-gradient(145deg, #10231b 0%, #18392d 48%, #0d1a14 100%)";
  const selectedArena = arenas.find((arena) => arena.id === selectedArenaId) ?? null;
  const [shareNotice, setShareNotice] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const playabilityEnabled = walletConnected && Boolean(selectedArena);
  const { playability, loading, error } = useWalletArenaPlayability({
    address: walletConnected ? walletAddress : "",
    arenaId: selectedArena?.id ?? "",
    token: selectedArena?.token ?? "SOL",
    enabled: playabilityEnabled,
  });

  const challengeLink = useMemo(() => {
    if (!selectedArena) return null;
    const origin = typeof window === "undefined" ? null : window.location.origin;
    return createChallengeLink({
      origin,
      arenaId: selectedArena.id,
      token: selectedArena.token,
      wagerUsd,
      refAddress: walletConnected ? walletAddress : null,
    });
  }, [selectedArena, wagerUsd, walletConnected, walletAddress]);

  const shareDescription = selectedArena
    ? `Think fast in ${selectedArena.label}. Scan or tap to challenge me.`
    : "Pick an arena first, then share your challenge link.";
  const tokenBalanceLabel = selectedArena ? `${selectedArena.token} Balance` : "Token Balance";
  const tokenBalanceValue = !selectedArena
    ? "--"
    : !walletConnected
      ? "--"
      : loading
        ? "Inspecting..."
        : error || !playability?.reliable
          ? "Unavailable"
          : (playability.tokenBalance ?? "--");
  const historyHref = selectedArena
    ? `/history?scope=arena&arena=${encodeURIComponent(selectedArena.id)}&token=${encodeURIComponent(selectedArena.token)}`
    : "/history?scope=arena&arena=sol&token=SOL";

  async function onCopyChallengeLink() {
    if (!challengeLink) {
      setShareNotice({ text: "Select arena to generate challenge link.", tone: "error" });
      return;
    }
    try {
      await navigator.clipboard.writeText(challengeLink);
      setShareNotice({ text: "Challenge link copied.", tone: "success" });
    } catch {
      setShareNotice({ text: "Copy failed. Please copy from the link field.", tone: "error" });
    }
  }

  async function buildChallengeShareImageFile() {
    if (!challengeLink || !selectedArena) return null;
    try {
      const blob = await renderChallengeCardJpg({
        title: "Pre Challenge Me",
        challengerName: "You",
        challengerAddress: walletAddress,
        statusLabel: "Open Challenge",
        description: shareDescription,
        token: selectedArena.token,
        wagerUsd,
        arenaLabel: selectedArena.label,
        challengeLink,
      });
      const fileName = createChallengeCardFileName({
        title: "Pre Challenge Me",
        challengerName: "You",
        challengerAddress: walletAddress,
        statusLabel: "Open Challenge",
        description: shareDescription,
        token: selectedArena.token,
        wagerUsd,
        arenaLabel: selectedArena.label,
        challengeLink,
      });
      return new File([blob], fileName, { type: "image/jpeg" });
    } catch {
      setShareNotice({ text: "Failed to generate JPG. Try again.", tone: "error" });
      return null;
    }
  }

  function downloadShareFile(file: File) {
    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function onSaveChallengeJpg() {
    const imageFile = await buildChallengeShareImageFile();
    if (!imageFile) return;
    downloadShareFile(imageFile);
    setShareNotice({ text: "Saved challenge card JPG.", tone: "success" });
  }

  async function onShareChallengeToX() {
    if (!challengeLink) {
      setShareNotice({ text: "Select arena to generate challenge link.", tone: "error" });
      return;
    }
    const shareText = selectedArena
      ? `I am waiting in ${selectedArena.label}. Challenge me in CORA.`
      : "Challenge me in CORA.";
    const imageFile = await buildChallengeShareImageFile();

    const intent = createChallengeTweetIntent(challengeLink, shareText);
    const popup = window.open(intent, "_blank", "noopener,noreferrer");
    if (!popup) {
      setShareNotice({ text: "Popup blocked. Allow popups and retry.", tone: "error" });
      return;
    }
    if (imageFile) {
      downloadShareFile(imageFile);
      setShareNotice({ text: "Opened X directly. JPG downloaded, attach it to the tweet.", tone: "success" });
      return;
    }
    setShareNotice({ text: "Opened X directly.", tone: "success" });
  }

  useEffect(() => {
    if (!shareNotice) return;
    const id = setTimeout(() => setShareNotice(null), 5000);
    return () => clearTimeout(id);
  }, [shareNotice]);

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
            {walletConnected ? truncateWallet(walletAddress) : "Wallet not connected"}
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
              {selectedArena ? ` · ${selectedArena.token}` : ""}
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
              {tokenBalanceLabel}: {tokenBalanceValue}
            </span>
          </div>
        </div>

        <Link
          href={historyHref}
          className="frame-cut frame-cut-sm inline-flex items-center px-3 py-2 font-gabarito text-xs font-bold uppercase tracking-wider text-[var(--tone-cream)] opacity-90 shadow-lg transition-colors hover:bg-[rgba(29,52,41,0.98)]"
          style={{
            border: "2px solid var(--tone-bark)",
            background: "linear-gradient(180deg, #1b3429 0%, #14271f 100%)",
            boxShadow: "inset 0 1px 0 rgba(203,227,193,0.2)",
          }}
        >
          View History
        </Link>
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
              const icon = arena.token === "SOL" ? "\u25ce" : "\u{1F436}";

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
                      ? "linear-gradient(180deg, #fff1cf 0%, #f8d694 100%)"
                      : "linear-gradient(180deg, #fffaf0 0%, #efe3c8 100%)",
                    boxShadow: active
                      ? `0 8px 0 rgba(111,58,40,0.22), 0 14px 24px ${arena.accent}55`
                      : "0 5px 0 rgba(111,58,40,0.14), 0 10px 20px rgba(111,58,40,0.08)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg shadow-inner"
                      style={{ background: arena.previewBg, border: `1.5px solid ${arena.accent}` }}
                    >
                      {icon}
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
          </div>
        </section>

        <section
          className="relative flex min-h-[400px] grow flex-col justify-between overflow-hidden p-6 md:min-h-[500px] md:p-8"
          style={{ background: rightBoardBackground }}
        >
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
            <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--tone-cream)] opacity-90 drop-shadow-sm">
              Pre-Match Lobby
            </p>
            <h1 className="mt-2 font-caprasimo text-4xl leading-none text-[#fffaf0] drop-shadow-md md:text-5xl">
              Choose Your Arena
            </h1>
            <p className="mt-3 max-w-md font-gabarito text-sm text-[var(--tone-cream)] drop-shadow-sm">
              Pick SOL or BONK, lock the wager, then draft your scientist.
            </p>
          </div>

          <div className="relative z-10 mt-auto flex w-full flex-col items-end justify-end pt-12">
            <div className="flex w-full shrink-0 flex-col items-center md:w-auto md:items-end">
              {!selectedArena && (
                <p className="mb-2 font-gabarito text-xs text-[var(--tone-cream)] opacity-80">Select a token to continue</p>
              )}
              {selectedArena && !walletConnected && (
                <p className="mb-2 font-gabarito text-xs text-[var(--tone-cream)] opacity-80">Connect wallet to draft</p>
              )}
              <motion.button
                whileHover={canPlay ? { y: -2 } : undefined}
                whileTap={canPlay ? { scale: 0.98 } : undefined}
                type="button"
                onClick={onPlay}
                disabled={!canPlay}
                className={`btn-game btn-game-primary w-full px-10 py-4 text-base shadow-2xl transition-all md:w-auto ${
                  !canPlay ? "cursor-not-allowed opacity-50 grayscale" : ""
                }`}
              >
                Draft Scientist
              </motion.button>
            </div>
          </div>
        </section>
      </div>

      {!walletConnected && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="font-gabarito text-xs text-[#6f3a28]">
            Connect wallet to unlock queue and deposit signing.
          </p>
          <HydratedWalletButton />
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => setShareModalOpen(true)}
          disabled={!selectedArena}
          className={`btn-game btn-game-secondary px-5 py-2 text-xs shadow-md ${!selectedArena ? "opacity-50" : ""}`}
        >
          Blink Share
        </button>
      </div>

      {shareModalOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[rgba(10,15,12,0.85)] p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl">
            <button
              type="button"
              onClick={() => setShareModalOpen(false)}
              className="btn-game btn-game-secondary absolute right-2 top-2 z-10 px-3 py-1.5 text-[10px]"
            >
              Close
            </button>
            <ChallengeShareCard
              title="Pre Challenge Me"
              challengerName="You"
              challengerAddress={walletAddress}
              arenaLabel={selectedArena?.label ?? "Not Selected"}
              token={selectedArena?.token ?? "---"}
              wagerUsd={wagerUsd}
              challengeLink={challengeLink}
              description={shareDescription}
              statusLabel="Open Challenge"
              onCopy={onCopyChallengeLink}
              onSaveJpg={onSaveChallengeJpg}
              onShareX={onShareChallengeToX}
              notice={shareNotice}
            />
          </div>
        </div>
      )}
    </div>
  );
}


