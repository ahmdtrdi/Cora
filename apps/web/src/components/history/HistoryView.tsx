"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getArenaHistory, getWalletHistory } from "@/lib/history/historyApi";
import type { MatchHistoryItem } from "@/lib/history/historyTypes";

type HistoryScope = "arena" | "wallet";

function shortValue(input: string) {
  if (input.length <= 14) return input;
  return `${input.slice(0, 6)}...${input.slice(-5)}`;
}

function toDisplayDate(timestamp: string) {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return "Unknown time";
  return value.toLocaleString();
}

function normalizeScope(raw: string | null): HistoryScope {
  if (raw === "arena" || raw === "wallet") return raw;
  return "wallet";
}

export function HistoryView() {
  const searchParams = useSearchParams();
  const { publicKey } = useWallet();
  const connectedAddress = publicKey?.toBase58() ?? "";

  const requestedScope = normalizeScope(searchParams.get("scope"));
  const arenaId = (searchParams.get("arena") ?? "sol").trim().toLowerCase();
  const token = (searchParams.get("token") ?? "SOL").trim().toUpperCase();
  const requestedAddress = (searchParams.get("address") ?? "").trim();
  const scope: HistoryScope =
    requestedScope === "wallet" && (requestedAddress || connectedAddress) ? "wallet" : "arena";
  const walletAddress = requestedAddress || connectedAddress;

  const [items, setItems] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageTitle = scope === "wallet" ? "Wallet History" : "Arena History";
  const subtitle =
    scope === "wallet"
      ? walletAddress
        ? `Showing matches tied to ${shortValue(walletAddress)}.`
        : "Connect wallet or pass address in query string."
      : `Showing recent matches for ${token} arena.`;

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });

    const task =
      scope === "wallet"
        ? walletAddress
          ? getWalletHistory(walletAddress)
          : Promise.resolve<MatchHistoryItem[]>([])
        : getArenaHistory(arenaId);

    task
      .then((result) => {
        if (cancelled) return;
        setItems(result);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unable to load history right now.";
        setError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scope, walletAddress, arenaId]);

  const switchHref = useMemo(() => {
    if (scope === "wallet") {
      return `/history?scope=arena&arena=${encodeURIComponent(arenaId)}&token=${encodeURIComponent(token)}`;
    }
    const params = new URLSearchParams({
      scope: "wallet",
      arena: arenaId,
      token,
    });
    if (walletAddress) {
      params.set("address", walletAddress);
    }
    return `/history?${params.toString()}`;
  }, [scope, arenaId, token, walletAddress]);

  return (
    <main
      className="min-h-[100svh] px-4 py-6 md:px-6"
      style={{
        background:
          "radial-gradient(circle at 50% 24%, rgba(168,143,104,0.2), transparent 46%), linear-gradient(180deg, #26372f 0%, #1a2822 45%, #111a16 100%)",
      }}
    >
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-gabarito text-[11px] uppercase tracking-[0.2em] text-[rgba(244,240,230,0.75)]">
              GoldRush Data
            </p>
            <h1 className="mt-1 font-caprasimo text-4xl text-[var(--tone-cream)]">{pageTitle}</h1>
            <p className="mt-1 font-gabarito text-sm text-[rgba(244,240,230,0.84)]">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={switchHref}
              className="frame-cut frame-cut-sm px-3 py-1.5 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
              style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
            >
              {scope === "wallet" ? "View Arena" : "View Wallet"}
            </Link>
            <Link
              href="/lobby"
              className="frame-cut frame-cut-sm px-3 py-1.5 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
              style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
            >
              Back To Lobby
            </Link>
          </div>
        </div>

        <div
          className="frame-cut frame-cut-sm mb-4 p-3"
          style={{ border: "1px solid rgba(248,214,148,0.26)", background: "rgba(16,26,22,0.76)" }}
        >
          <p className="font-gabarito text-xs text-[rgba(244,240,230,0.86)]">
            Informational only. Match flow is not blocked by history availability.
          </p>
        </div>

        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`history-row-${index}`}
                className="frame-cut frame-cut-sm h-16 animate-pulse"
                style={{ border: "1px solid rgba(248,214,148,0.2)", background: "rgba(248,214,148,0.08)" }}
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div
            className="frame-cut frame-cut-sm p-4"
            style={{ border: "1px solid rgba(186,105,49,0.5)", background: "rgba(78,41,25,0.36)" }}
          >
            <p className="font-gabarito text-xs font-semibold uppercase tracking-wide text-[#f8d694]">
              History unavailable
            </p>
            <p className="mt-1 font-gabarito text-xs text-[rgba(244,240,230,0.84)]">{error}</p>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div
            className="frame-cut frame-cut-sm p-4"
            style={{ border: "1px solid rgba(248,214,148,0.2)", background: "rgba(16,26,22,0.72)" }}
          >
            <p className="font-gabarito text-sm text-[rgba(244,240,230,0.86)]">No CORA history found yet.</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => (
              <article
                key={item.id}
                className="frame-cut frame-cut-sm p-3"
                style={{
                  border: "1px solid rgba(248,214,148,0.25)",
                  background: "linear-gradient(150deg, rgba(255,244,221,0.94), rgba(241,223,193,0.94))",
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[#6f3a28]">
                    {item.token} Arena
                  </p>
                  <p className="font-gabarito text-[11px] text-[#5e7768]">{toDisplayDate(item.timestamp)}</p>
                </div>
                <p className="mt-1 font-mono text-[11px] text-[#274137]">Sig: {shortValue(item.signature)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-[rgba(111,58,40,0.28)] bg-[rgba(255,248,236,0.95)] px-2 py-0.5 font-gabarito text-[10px] font-bold uppercase tracking-wide text-[#6f3a28]">
                    {item.result ?? "unknown"}
                  </span>
                  <span className="rounded-full border border-[rgba(39,65,55,0.24)] bg-[rgba(237,244,235,0.95)] px-2 py-0.5 font-gabarito text-[10px] font-bold uppercase tracking-wide text-[#274137]">
                    {item.settlementStatus ?? "unknown"}
                  </span>
                  {item.wagerUsd && (
                    <span className="rounded-full border border-[rgba(111,58,40,0.24)] bg-[rgba(255,248,236,0.95)] px-2 py-0.5 font-gabarito text-[10px] font-bold uppercase tracking-wide text-[#6f3a28]">
                      ${item.wagerUsd}
                    </span>
                  )}
                  {item.opponent && (
                    <span className="rounded-full border border-[rgba(39,65,55,0.24)] bg-[rgba(237,244,235,0.95)] px-2 py-0.5 font-gabarito text-[10px] font-bold uppercase tracking-wide text-[#274137]">
                      vs {shortValue(item.opponent)}
                    </span>
                  )}
                </div>
                {item.explorerUrl && (
                  <a
                    href={item.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex font-gabarito text-[11px] font-bold uppercase tracking-wide text-[#274137] underline underline-offset-2"
                  >
                    Open Explorer
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

