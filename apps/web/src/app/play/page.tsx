import Link from "next/link";

export default function PlayPage() {
  return (
    <main className="min-h-[100svh] bg-[var(--background)] px-4 py-20 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
          Play
        </p>
        <h1 className="text-4xl font-black leading-tight md:text-6xl">Arena Prototype Route</h1>
        <p className="max-w-2xl text-base leading-relaxed text-[var(--color-muted)] md:text-lg">
          This route is now scaffolded so navigation to and from the landing page is stable.
        </p>
        <div>
          <Link
            href="/"
            className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full border border-white/30 bg-[linear-gradient(140deg,#d97706_0%,#b45309_100%)] px-7 text-sm font-black text-white shadow-[0_8px_26px_var(--amber-glow)] transition-all duration-200 before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(120deg,rgba(255,255,255,0.18),transparent_45%)] after:pointer-events-none after:absolute after:inset-[2px] after:rounded-full after:border after:border-white/35 hover:-translate-y-0.5"
          >
            <span className="relative z-10">Back to Landing</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
