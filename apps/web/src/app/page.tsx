"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-50 p-6">
      <div className="max-w-md w-full flex flex-col items-center justify-center space-y-8 text-center">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">CORA</h1>
          <p className="text-zinc-400 text-lg">
            High-stakes Wager-Fi esports for General Aptitude Tests.
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl w-full flex flex-col items-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Connect to Play</h2>
            <p className="text-sm text-zinc-500">
              Connect your Phantom wallet on Devnet to enter the arena.
            </p>
          </div>
          <WalletMultiButton />
        </div>
      </div>
    </main>
  );
}
