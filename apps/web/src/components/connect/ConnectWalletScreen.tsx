"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { HydratedWalletButton } from "@/components/wallet/HydratedWalletButton";

function shortWallet(address: string) {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

export function ConnectWalletScreen() {
  const searchParams = useSearchParams();
  const { publicKey } = useWallet();
  const connected = Boolean(publicKey);
  const address = publicKey?.toBase58() ?? "";

  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    if (!next) return "/lobby";
    if (!next.startsWith("/")) return "/lobby";
    return next;
  }, [searchParams]);

  return (
    <main className="relative grid min-h-[100svh] place-items-center overflow-hidden bg-gradient-to-b from-[#121919] to-[#0a0f0c] px-4 py-8">
      {/* Background World Elements */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Arena Grid */}
        <div className="arena-grid absolute inset-0 opacity-10" />

        {/* Ambient Radial Glows */}
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--tone-clay)] opacity-15 mix-blend-screen blur-[120px]" />
        <div className="absolute left-[30%] top-[40%] h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--tone-teal)] opacity-20 blur-[90px]" />
        <div className="absolute right-[30%] top-[60%] h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--tone-sage)] opacity-10 blur-[100px]" />

        {/* Depth Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.85)_100%)]" />

        {/* Faint CORA "C" Emblem */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[45rem] font-caprasimo text-[var(--tone-cream)] opacity-[0.02] mix-blend-overlay">
          C
        </div>

        {/* Floating Badges / Cards */}
        <div className="animate-float-card absolute left-[15%] top-[25%] -rotate-12 text-5xl opacity-30 drop-shadow-xl">
          🧪
        </div>
        <div
          className="animate-float-card absolute right-[20%] top-[30%] rotate-6 text-6xl opacity-20 drop-shadow-xl"
          style={{ animationDelay: "1s" }}
        >
          🧬
        </div>
        <div
          className="animate-float-card absolute bottom-[20%] left-[25%] rotate-12 text-4xl opacity-40 drop-shadow-xl"
          style={{ animationDelay: "2s" }}
        >
          🔬
        </div>
        <div
          className="animate-float-card absolute bottom-[25%] right-[25%] -rotate-6 text-5xl opacity-20 drop-shadow-xl"
          style={{ animationDelay: "1.5s" }}
        >
          ⚔️
        </div>

        {/* Sparkle Dots / Soft Orbs */}
        <div className="animate-sparkle absolute left-[40%] top-[20%] h-2 w-2 rounded-full bg-[var(--tone-cream)] opacity-40" />
        <div
          className="animate-sparkle absolute bottom-[30%] right-[35%] h-3 w-3 rounded-full bg-[var(--tone-teal)] opacity-50"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="animate-sparkle absolute left-[30%] top-[60%] h-1.5 w-1.5 rounded-full bg-[var(--tone-clay)] opacity-60"
          style={{ animationDelay: "0.5s" }}
        />
      </div>

      {/* Centered Wallet Panel */}
      <section className="relative z-10 w-full max-w-md text-center">
        {/* Outer Glow */}
        <div className="animate-orb-breath absolute -inset-2 rounded-[24px] bg-[var(--tone-clay)] opacity-15 blur-xl" />

        {/* Inner Panel - Dark Game Card */}
        <div className="relative rounded-[20px] border-[4px] border-[var(--tone-bark)] bg-[#172318] p-8 shadow-[0_16px_48px_rgba(0,0,0,0.8)]">
          {/* Inner Frame Accent */}
          <div className="pointer-events-none absolute inset-1.5 rounded-[12px] border border-[rgba(248,214,148,0.15)]" />

          <div className="relative z-10">
            <p className="font-gabarito text-[11px] uppercase tracking-[0.24em] text-[var(--tone-cream)] opacity-80">
              Arena Access
            </p>
            <h1 className="mt-3 font-caprasimo text-4xl leading-none text-[var(--tone-cream)] md:text-5xl">
              Enter the Arena
            </h1>
            <p className="mt-4 font-gabarito text-sm text-[#8fa897]">
              Connect your wallet to join the scientist battle lobby.
            </p>

            <div className="mt-8 flex flex-col items-center gap-5">
              <HydratedWalletButton />
              
              {connected ? (
                <div className="mt-2 flex flex-col items-center gap-5">
                  <div className="rounded-full border border-[var(--tone-teal)] bg-[rgba(60,92,95,0.2)] px-4 py-1.5 shadow-inner">
                    <p className="font-mono text-xs font-semibold tracking-wide text-[var(--tone-mint)]">
                      Wallet synced: {shortWallet(address)}
                    </p>
                  </div>
                  <Link
                    href={nextPath}
                    className="btn-game btn-game-primary w-full min-w-[200px]"
                  >
                    Enter Lobby
                  </Link>
                </div>
              ) : (
                <div className="mt-2 rounded-lg border border-[rgba(186,105,49,0.2)] bg-[rgba(186,105,49,0.05)] p-4 shadow-inner">
                  <p className="font-gabarito text-xs leading-relaxed text-[var(--tone-cream)] opacity-70">
                    A connected wallet is required before entering the lobby and deposit flow.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
