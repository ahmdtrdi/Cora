"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

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
    <main
      className="grid min-h-[100svh] place-items-center px-4 py-8"
      style={{
        backgroundColor: "#f5f1e8",
        backgroundImage:
          "linear-gradient(rgba(39,65,55,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(39,65,55,0.05) 1px, transparent 1px)",
        backgroundSize: "42px 42px",
      }}
    >
      <section
        className="frame-cut w-full max-w-md p-7 text-center md:p-8"
        style={{ border: "1px solid rgba(39,65,55,0.22)", background: "rgba(255,255,255,0.9)" }}
      >
        <p className="font-gabarito text-[11px] uppercase tracking-[0.24em] text-[#6d8373]">
          Wallet Access
        </p>
        <h1 className="mt-2 font-caprasimo text-4xl leading-none text-[#1f2b24] md:text-5xl">
          Connect Wallet
        </h1>
        <p className="mt-3 font-gabarito text-sm text-[#4f6759]">
          Sign in with Phantom to continue.
        </p>

        <div className="mt-6 flex flex-col items-center gap-3">
          <WalletMultiButton />
          {connected ? (
            <>
              <p className="font-gabarito text-xs text-[#4f6759]">
                Connected as {shortWallet(address)}
              </p>
              <Link
                href={nextPath}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(39,65,55,0.22)", color: "#274137", background: "rgba(255,255,255,0.92)" }}
              >
                Continue
              </Link>
            </>
          ) : (
            <p className="font-gabarito text-xs text-[#6f3a28]">
              You need a connected wallet before entering lobby and deposit flow.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
