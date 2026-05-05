"use client";

type ShareNotice = {
  text: string;
  tone: "success" | "error";
};

type ChallengeShareCardProps = {
  title: string;
  challengerName: string;
  challengerAddress: string;
  arenaLabel: string;
  token: string;
  wagerUsd: string;
  challengeLink: string | null;
  description: string;
  statusLabel: string;
  actionCopyLabel?: string;
  actionSaveLabel?: string;
  actionShareLabel?: string;
  onCopy: () => void;
  onSaveJpg: () => void;
  onShareX: () => void;
  notice: ShareNotice | null;
};

function shortenAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

export function ChallengeShareCard({
  title,
  challengerName,
  challengerAddress,
  arenaLabel,
  token,
  wagerUsd,
  challengeLink,
  description,
  statusLabel,
  actionCopyLabel = "Copy Link",
  actionSaveLabel = "Save As JPG",
  actionShareLabel = "Share On X",
  onCopy,
  onSaveJpg,
  onShareX,
  notice,
}: ChallengeShareCardProps) {
  const qrSrc = challengeLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(challengeLink)}`
    : null;

  return (
    <div
      className="rounded-[26px] border p-4 shadow-[0_16px_40px_rgba(20,20,20,0.18)] md:p-5"
      style={{
        borderColor: "rgba(55,55,55,0.22)",
        background: "linear-gradient(165deg, #fffcf6 0%, #f3ecdd 58%, #ede5d4 100%)",
      }}
    >
      <div className="rounded-[20px] border border-[rgba(34,34,34,0.2)] bg-[rgba(255,252,246,0.7)] p-3 md:p-4">
        <div className="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-[rgba(34,34,34,0.16)] bg-[linear-gradient(155deg,#fffaf0_0%,#f3ead8_100%)] p-4">
            <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.22em] text-[rgba(34,34,34,0.6)]">
              Cora Challenge
            </p>
            <p className="mt-2 font-caprasimo text-3xl leading-none text-[#1f1b18] md:text-4xl">
              {title}
            </p>

            <div className="mt-4 flex items-start gap-3">
              <div
                className="grid aspect-square w-24 shrink-0 place-items-center rounded-xl border border-[rgba(34,34,34,0.2)]"
                style={{
                  background:
                    "linear-gradient(150deg, #ddd5c4 0%, #eee6d7 45%, #cfc7b8 100%)",
                }}
              >
                <p className="font-caprasimo text-4xl text-[#292421]">
                  {challengerName.slice(0, 1).toUpperCase()}
                </p>
              </div>
              <div className="min-w-0">
                <p className="truncate font-caprasimo text-xl text-[#1f1b18]">{challengerName}</p>
                <p className="mt-1 font-mono text-xs font-semibold text-[rgba(44,39,36,0.75)]">{shortenAddress(challengerAddress)}</p>
                <span className="mt-2 inline-flex rounded-full border border-[rgba(34,34,34,0.2)] bg-[rgba(255,255,255,0.7)] px-2 py-1 font-gabarito text-[10px] font-bold uppercase tracking-[0.12em] text-[#25211d]">
                  {statusLabel}
                </span>
              </div>
            </div>

            <p className="mt-4 max-w-xl font-gabarito text-sm text-[rgba(44,39,36,0.82)]">{description}</p>
          </section>

          <aside className="rounded-2xl border border-[rgba(34,34,34,0.16)] bg-[linear-gradient(155deg,#f8f2e6_0%,#eee4d2_100%)] p-4">
            <div className="rounded-xl border border-[rgba(34,34,34,0.18)] bg-[rgba(255,255,255,0.72)] p-2">
              <div className="grid min-h-[154px] place-items-center rounded-lg border border-[rgba(34,34,34,0.14)] bg-[#f3ecdc] p-2">
                {qrSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrSrc} alt="Challenge QR code" width={140} height={140} className="rounded-sm" />
                ) : (
                  <p className="font-gabarito text-xs text-[rgba(40,36,33,0.62)]">QR unavailable</p>
                )}
              </div>

              <div className="mt-2 space-y-1.5">
                <div className="grid grid-cols-[68px_1fr] items-center gap-2 rounded-md border border-[rgba(34,34,34,0.14)] bg-[rgba(255,255,255,0.72)] px-2 py-1.5">
                  <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(40,36,33,0.64)]">Token</p>
                  <p className="truncate font-gabarito text-xs font-bold uppercase tracking-[0.05em] text-[#1f1b18]">{token}</p>
                </div>
                <div className="grid grid-cols-[68px_1fr] items-center gap-2 rounded-md border border-[rgba(34,34,34,0.14)] bg-[rgba(255,255,255,0.72)] px-2 py-1.5">
                  <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(40,36,33,0.64)]">Wager</p>
                  <p className="truncate font-gabarito text-xs font-bold text-[#1f1b18]">${wagerUsd}</p>
                </div>
                <div className="grid grid-cols-[68px_1fr] items-center gap-2 rounded-md border border-[rgba(34,34,34,0.14)] bg-[rgba(255,255,255,0.72)] px-2 py-1.5">
                  <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(40,36,33,0.64)]">Arena</p>
                  <p className="truncate font-gabarito text-xs font-bold text-[#1f1b18]">{arenaLabel}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="rounded-lg border px-3 py-2 font-gabarito text-xs font-extrabold uppercase tracking-[0.1em] text-[#1f1b18] transition hover:-translate-y-0.5"
          style={{ borderColor: "rgba(34,34,34,0.26)", background: "rgba(255,255,255,0.76)" }}
        >
          {actionCopyLabel}
        </button>
        <button
          type="button"
          onClick={onSaveJpg}
          className="rounded-lg border px-3 py-2 font-gabarito text-xs font-extrabold uppercase tracking-[0.1em] text-[#1f1b18] transition hover:-translate-y-0.5"
          style={{ borderColor: "rgba(34,34,34,0.26)", background: "rgba(255,255,255,0.76)" }}
        >
          {actionSaveLabel}
        </button>
        <button
          type="button"
          onClick={onShareX}
          className="rounded-lg border px-3 py-2 font-gabarito text-xs font-extrabold uppercase tracking-[0.1em] text-[#1f1b18] transition hover:-translate-y-0.5"
          style={{ borderColor: "rgba(34,34,34,0.26)", background: "rgba(255,255,255,0.76)" }}
        >
          {actionShareLabel}
        </button>
      </div>

      {notice && (
        <p className="mt-2 font-gabarito text-xs" style={{ color: notice.tone === "success" ? "#2f6249" : "#8a3f2b" }}>
          {notice.text}
        </p>
      )}

      {challengeLink && (
        <p className="mt-2 break-all font-mono text-[11px] text-[rgba(44,39,36,0.72)]">
          {challengeLink}
        </p>
      )}
    </div>
  );
}
