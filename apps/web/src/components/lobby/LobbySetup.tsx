"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { HydratedWalletButton } from "@/components/wallet/HydratedWalletButton";
import { ChallengeShareCard } from "@/components/challenge/ChallengeShareCard";
import { createChallengeLink, createChallengeTweetIntent } from "@/lib/challenge/createChallengeLink";
import { createChallengeCardFileName, renderChallengeCardJpg } from "@/lib/challenge/renderChallengeCardJpg";
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
  const selectedArena = arenas.find((arena) => arena.id === selectedArenaId) ?? null;
  const [shareNotice, setShareNotice] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

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
    <div className="mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col px-4 py-5 text-[#1f2b24] md:px-6 md:py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div
          className="frame-cut frame-cut-sm inline-flex items-center gap-3 px-3 py-2"
          style={{ border: "1px solid rgba(39,65,55,0.18)", background: "rgba(255,255,255,0.8)" }}
        >
          <div className="h-6 w-6 rounded-full" style={{ background: "rgba(157,180,150,0.55)" }} />
          <p className="font-gabarito text-xs font-semibold tracking-wide text-[#274137]">
            {walletConnected ? truncateWallet(walletAddress) : "Wallet not connected"}
          </p>
        </div>

        <div
          className="frame-cut frame-cut-sm inline-flex items-center gap-2 px-3 py-2"
          style={{ border: "1px solid rgba(39,65,55,0.18)", background: "rgba(255,255,255,0.8)" }}
        >
          <span className="font-gabarito text-xs uppercase tracking-wider text-[#9db496]">Wager</span>
          <span className="font-gabarito text-sm font-bold text-[#f8d694]">${wagerUsd || "0"} {selectedArena?.token ?? "---"}</span>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
        <section className="frame-cut h-fit p-3" style={{ border: "1px solid rgba(39,65,55,0.16)", background: "rgba(255,255,255,0.76)" }}>
          <p className="mb-3 font-gabarito text-[11px] uppercase tracking-[0.2em] text-[#6d8373]">Arena Token</p>
          <div className="space-y-2">
            {arenas.map((arena) => {
              const active = selectedArenaId === arena.id;
              return (
                <button
                  key={arena.id}
                  type="button"
                  onClick={() => onSelectArena(arena.id)}
                  className="frame-cut frame-cut-sm w-full px-3 py-2 text-left transition"
                  style={{
                    border: active ? `1px solid ${arena.frame}` : "1px solid rgba(39,65,55,0.16)",
                    background: active ? "rgba(157,180,150,0.22)" : "rgba(255,255,255,0.72)",
                  }}
                >
                  <p className="font-gabarito text-sm font-bold" style={{ color: active ? arena.frame : "#274137" }}>
                    {arena.token}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="frame-cut relative flex min-h-[320px] flex-col justify-between overflow-hidden p-5 md:min-h-[460px] md:p-6" style={{ border: "1px solid rgba(39,65,55,0.18)", background: selectedArena?.previewBg ?? "linear-gradient(150deg, #ececec 0%, #d9d9d9 100%)" }}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.24),transparent_60%)]" />

          <div className="relative z-10 max-w-lg">
            <p className="font-gabarito text-[11px] uppercase tracking-[0.24em] text-[#4f6759]">Pre-Match Lobby</p>
            <h1 className="mt-2 font-caprasimo text-4xl leading-none text-[#1f2b24] md:text-5xl">Choose Arena</h1>
            <p className="mt-3 font-gabarito text-sm text-[#3c5044]">
              Pick your token arena, confirm wager, then continue to character selection.
            </p>
          </div>

          <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="frame-cut frame-cut-sm w-full max-w-[220px] px-3 py-2" style={{ border: "1px solid rgba(39,65,55,0.18)", background: "rgba(255,255,255,0.76)" }}>
              <p className="font-gabarito text-[10px] uppercase tracking-[0.2em] text-[#6d8373]">
                Wager (USD)
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-gabarito text-sm text-[#ba6931]">$</span>
                <p className="font-gabarito text-sm font-bold text-[#274137]">
                  {wagerUsd}
                </p>
              </div>
            </div>

            <motion.button
              whileHover={canPlay ? { y: -2 } : undefined}
              whileTap={canPlay ? { scale: 0.98 } : undefined}
              type="button"
              onClick={onPlay}
              disabled={!canPlay}
              className="frame-cut frame-cut-sm min-w-[150px] px-5 py-3 font-gabarito text-base font-extrabold uppercase tracking-wide transition"
              style={{
                border: canPlay
                  ? `1px solid ${selectedArena?.frame ?? "#274137"}`
                  : "1px solid rgba(39,65,55,0.2)",
                background: canPlay ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.65)",
                color: canPlay ? selectedArena?.frame ?? "#274137" : "rgba(39,65,55,0.5)",
              }}
            >
              Play
            </motion.button>
          </div>
        </section>
      </main>

      {!walletConnected && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="font-gabarito text-xs text-[#6f3a28]">
            Connect wallet to unlock queue and deposit signing.
          </p>
          <HydratedWalletButton />
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => setShareModalOpen(true)}
          disabled={!selectedArena}
          className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
          style={{
            border: "1px solid rgba(39,65,55,0.2)",
            color: selectedArena ? "#274137" : "rgba(39,65,55,0.5)",
            background: selectedArena ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.65)",
          }}
        >
          Blink Share
        </button>
      </div>

      {shareModalOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[rgba(20,30,24,0.45)] p-4">
          <div className="relative w-full max-w-3xl">
            <button
              type="button"
              onClick={() => setShareModalOpen(false)}
              className="absolute right-1 top-1 z-10 frame-cut frame-cut-sm px-2 py-1 font-gabarito text-xs font-extrabold uppercase tracking-wide"
              style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "rgba(255,255,255,0.92)" }}
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
