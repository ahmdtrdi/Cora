import { AnimatePresence, motion } from "framer-motion";

export type BattleUiAlert = {
  id: string;
  title: string;
  message: string;
  tone: "error" | "warning";
  autoDismissMs: number;
  actionLabel?: string;
  onAction?: () => void;
};

type GameNotice = {
  id: string;
  message: string;
  tone: "action" | "phase";
};

type BattleScreenStatusLayerProps = {
  visibleAlerts: BattleUiAlert[];
  socketUrl: string | null;
  gameNotice: GameNotice | null;
  onDismissAlert: (alertId: string) => void;
};

export function BattleScreenStatusLayer({
  visibleAlerts,
  socketUrl,
  gameNotice,
  onDismissAlert,
}: BattleScreenStatusLayerProps) {
  return (
    <>
      <div className="fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-2 md:right-6 md:top-6">
        {visibleAlerts.map((alert) => (
          <div
            key={alert.id}
            className="frame-cut px-3 py-2"
            style={{
              border:
                alert.tone === "error"
                  ? "1px solid rgba(186,105,49,0.42)"
                  : "1px solid rgba(248,214,148,0.42)",
              background:
                alert.tone === "error"
                  ? "rgba(43,24,16,0.94)"
                  : "rgba(13,24,20,0.94)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <p
                className="font-gabarito text-xs font-bold uppercase tracking-wide"
                style={{ color: alert.tone === "error" ? "#f8d694" : "#f8d694" }}
              >
                {alert.title}
              </p>
              <button
                type="button"
                onClick={() => onDismissAlert(alert.id)}
                className="font-gabarito text-xs font-bold leading-none text-[var(--tone-cream)] opacity-80"
                aria-label="Close alert"
              >
                X
              </button>
            </div>
            <p
              className="mt-1 break-words font-gabarito text-xs"
              style={{ color: "rgba(244,240,230,0.88)" }}
            >
              {alert.message}
            </p>
            {alert.id.startsWith("socket:") && socketUrl && (
              <p className="mt-1 break-all font-gabarito text-[11px] text-[rgba(244,240,230,0.74)]">
                {socketUrl}
              </p>
            )}
            <div className="mt-2 flex gap-2">
              {alert.actionLabel && alert.onAction && (
                <button
                  type="button"
                  onClick={alert.onAction}
                  className="frame-cut frame-cut-sm px-2 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                  style={{ border: "1px solid rgba(248,214,148,0.35)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
                >
                  {alert.actionLabel}
                </button>
              )}
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[rgba(248,214,148,0.16)]">
              <div
                className="h-full"
                style={{
                  width: "100%",
                  background:
                    alert.tone === "error"
                      ? "linear-gradient(90deg,#d9a85b,#ba6931)"
                      : "linear-gradient(90deg,#d9a85b,#ba6931)",
                  animationName: alert.autoDismissMs > 0 ? "alertDrain" : undefined,
                  animationDuration: alert.autoDismissMs > 0 ? `${alert.autoDismissMs}ms` : undefined,
                  animationTimingFunction: alert.autoDismissMs > 0 ? "linear" : undefined,
                  animationFillMode: alert.autoDismissMs > 0 ? "forwards" : undefined,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="pointer-events-none fixed left-1/2 top-20 z-[60] w-full max-w-sm -translate-x-1/2 px-4">
        <AnimatePresence mode="wait">
          {gameNotice && (
            <motion.div
              key={gameNotice.id}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="frame-cut px-4 py-2 text-center shadow-xl"
              style={{
                border:
                  gameNotice.tone === "phase"
                    ? "1px solid rgba(248,214,148,0.45)"
                    : "1px solid rgba(157,180,150,0.42)",
                background:
                  gameNotice.tone === "phase"
                    ? "linear-gradient(145deg, rgba(46,31,17,0.95), rgba(33,22,13,0.95))"
                    : "linear-gradient(145deg, rgba(19,32,26,0.95), rgba(13,24,20,0.95))",
              }}
            >
              <p className="font-gabarito text-xs font-bold uppercase tracking-[0.12em] text-[var(--tone-cream)]">
                {gameNotice.message}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
