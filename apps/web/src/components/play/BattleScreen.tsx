"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Card, GameStatus } from "@shared/websocket";
import { useMatchSocket } from "../../hooks/useMatchSocket";

type MatchOutcome = {
  cardId: string;
  questionId: string;
  outcome: "correct" | "wrong" | "timeout";
  at: number;
};

const ANSWER_TIME_SEC = 10;
const EMPTY_HAND: Card[] = [];
const CARD_PLACEHOLDER_COUNT = 5;

const CARD_TRANSFORMS = [
  "translate-y-4 -rotate-6",
  "translate-y-1 -rotate-3",
  "-translate-y-1 rotate-0",
  "translate-y-1 rotate-3",
  "translate-y-4 rotate-6",
] as const;

function getCardTransform(index: number) {
  if (index < CARD_TRANSFORMS.length) {
    return CARD_TRANSFORMS[index];
  }
  return index % 2 === 0 ? "translate-y-3 -rotate-2" : "translate-y-3 rotate-2";
}

function getStatusLabel(status: GameStatus) {
  if (status === "waiting") return "Waiting Opponent";
  if (status === "depositing") return "Deposit Phase";
  if (status === "playing") return "Playing";
  if (status === "settling") return "Settling";
  return "Finished";
}

function getOutcomeColor(outcome: MatchOutcome["outcome"]) {
  if (outcome === "correct") return "#d8ead4";
  if (outcome === "timeout") return "#efe8d5";
  return "#f2ddd4";
}

function getOutcomeLabel(outcome: MatchOutcome["outcome"]) {
  if (outcome === "correct") return "Correct";
  if (outcome === "timeout") return "Timeout";
  return "Wrong";
}

export function BattleScreen() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId") ?? "mock-room-001";
  const { publicKey } = useWallet();
  const fallbackAddress = `dev-preview-${roomId}`;
  const address =
    publicKey?.toBase58() ??
    searchParams.get("address") ??
    fallbackAddress;

  const {
    connectionState,
    gameState,
    settlementResult,
    matchInvalidated,
    lastDamageEvent,
    lastPlayResult,
    lastCardCountdown,
    lastCardExpired,
    openCard,
    playCard,
    confirmDeposit,
  } = useMatchSocket({ roomId, address });

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(ANSWER_TIME_SEC);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [enemyAttackFlash, setEnemyAttackFlash] = useState(false);
  const [enemyEventText, setEnemyEventText] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<MatchOutcome[]>([]);

  const pendingCardIdRef = useRef<string | null>(null);
  const pendingQuestionIdRef = useRef<string | null>(null);
  const lastProcessedPlayAtRef = useRef(0);
  const lastProcessedExpiredAtRef = useRef(0);
  const lastDamageTimestampRef = useRef(0);

  const hand = gameState?.hand ?? EMPTY_HAND;
  const displaySlots = hand.length > 0 ? hand.length : CARD_PLACEHOLDER_COUNT;
  const status = gameState?.status ?? "waiting";
  const player = gameState?.player;
  const opponent = gameState?.opponent;
  const activeCard = useMemo(
    () => hand.find((card) => card.id === activeCardId) ?? null,
    [hand, activeCardId],
  );

  useEffect(() => {
    if (!lastCardExpired) return;
    if (lastCardExpired.at === lastProcessedExpiredAtRef.current) return;
    lastProcessedExpiredAtRef.current = lastCardExpired.at;

    const questionId = pendingQuestionIdRef.current ?? "unknown";
    setOutcomes((prev) => [
      ...prev,
      {
        cardId: lastCardExpired.cardId,
        questionId,
        outcome: "timeout",
        at: lastCardExpired.at,
      },
    ]);
    setEnemyEventText("Time up. Card expired.");
    setActiveCardId(null);
    setAnswerLocked(false);
    pendingCardIdRef.current = null;
    pendingQuestionIdRef.current = null;
  }, [lastCardExpired]);

  useEffect(() => {
    if (!lastPlayResult) return;
    if (lastPlayResult.at === lastProcessedPlayAtRef.current) return;
    lastProcessedPlayAtRef.current = lastPlayResult.at;

    const cardId = pendingCardIdRef.current ?? "unknown";
    const questionId = pendingQuestionIdRef.current ?? "unknown";
    setOutcomes((prev) => [
      ...prev,
      {
        cardId,
        questionId,
        outcome: lastPlayResult.correct ? "correct" : "wrong",
        at: lastPlayResult.at,
      },
    ]);
    setEnemyEventText(lastPlayResult.correct ? "Nice hit!" : "No damage this turn.");
    setActiveCardId(null);
    setAnswerLocked(false);
    pendingCardIdRef.current = null;
    pendingQuestionIdRef.current = null;
  }, [lastPlayResult]);

  useEffect(() => {
    if (!lastDamageEvent) return;
    if (lastDamageEvent.timestamp === lastDamageTimestampRef.current) return;
    lastDamageTimestampRef.current = lastDamageEvent.timestamp;

    const enemyAttacked = lastDamageEvent.attackerAddress !== player?.address;
    if (enemyAttacked) {
      setTimeout(() => {
        setEnemyAttackFlash(true);
        setEnemyEventText("Opponent attacked!");
        setTimeout(() => setEnemyAttackFlash(false), 420);
      }, 0);
      return;
    }
    setTimeout(() => {
      setEnemyEventText("You attacked!");
    }, 0);
  }, [lastDamageEvent, player?.address]);

  const isPlayable = status === "playing" && connectionState === "connected";
  const isMatchComplete = Boolean(settlementResult) || Boolean(matchInvalidated) || status === "finished";

  function onOpenCard(card: Card) {
    if (!isPlayable || activeCardId || isMatchComplete) return;
    setActiveCardId(card.id);
    setSecondsLeft(ANSWER_TIME_SEC);
    setAnswerLocked(false);
    pendingCardIdRef.current = card.id;
    pendingQuestionIdRef.current = card.question.id;
    openCard(card.id);
  }

  function onAnswer(optionId: string) {
    if (!activeCard || answerLocked || !isPlayable) return;
    setAnswerLocked(true);
    pendingCardIdRef.current = activeCard.id;
    pendingQuestionIdRef.current = activeCard.question.id;
    playCard(activeCard.id, optionId);
  }

  const playerScore = player?.score ?? 0;
  const opponentScore = opponent?.score ?? 0;
  const playerBaseHp = player?.baseHealth ?? 100;
  const opponentBaseHp = opponent?.baseHealth ?? 100;

  const correctCount = outcomes.filter((item) => item.outcome === "correct").length;
  const timeoutCount = outcomes.filter((item) => item.outcome === "timeout").length;
  const wrongCount = outcomes.filter((item) => item.outcome === "wrong").length;

  const settlementText = settlementResult
    ? settlementResult.winner === player?.address
      ? "You Win"
      : "You Lose"
    : matchInvalidated
      ? "Match Invalidated"
      : "Match Finished";
  const displaySecondsLeft =
    activeCard && lastCardCountdown && lastCardCountdown.cardId === activeCard.id
      ? Math.max(0, Math.ceil(lastCardCountdown.remainingMs / 1000))
      : secondsLeft;

  return (
    <main
      className="min-h-[100svh] px-4 py-4 md:px-6"
      style={{
        backgroundColor: "#f5f1e8",
        backgroundImage:
          "linear-gradient(rgba(39,65,55,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(39,65,55,0.05) 1px, transparent 1px)",
        backgroundSize: "42px 42px",
      }}
    >
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] w-full max-w-7xl flex-col">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-gabarito text-xs uppercase tracking-[0.18em] text-[#5e7768]">
            Battle Room - {roomId}
          </p>
          <div className="flex items-center gap-2">
            <span
              className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-xs font-bold uppercase tracking-wide"
              style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.9)", color: "#274137" }}
            >
              {getStatusLabel(status)} · {connectionState}
            </span>
            <Link
              href="/lobby"
              className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-xs font-bold uppercase tracking-wide"
              style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.9)", color: "#274137" }}
            >
              Exit
            </Link>
          </div>
        </header>

        <section
          className="frame-cut relative flex flex-1 flex-col overflow-hidden px-4 py-5 md:px-6"
          style={{ border: "1px solid rgba(39,65,55,0.18)", background: "rgba(255,255,255,0.84)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-caprasimo text-3xl text-[#1f2b24]">You</p>
              <p className="font-gabarito text-xs text-[#5e7768]">Score {playerScore}</p>
            </div>
            <p className="font-caprasimo text-4xl text-[#7a8f82]">VS</p>
            <div className="text-right">
              <p className="font-caprasimo text-3xl text-[#1f2b24]">Opponent</p>
              <p className="font-gabarito text-xs text-[#5e7768]">Score {opponentScore}</p>
            </div>
          </div>

          <div className="relative mt-5 flex-1">
            <div className="absolute left-0 top-6 flex items-start gap-3">
              <div
                className="frame-cut h-44 w-20"
                style={{ border: "1px solid rgba(39,65,55,0.2)", background: enemyAttackFlash ? "#f3e0d8" : "#ebe5d7" }}
              />
              <div>
                <p className="font-gabarito text-[11px] uppercase tracking-wider text-[#5e7768]">Base HP</p>
                <p className="font-caprasimo text-2xl text-[#274137]">{playerBaseHp}</p>
              </div>
            </div>

            <div className="absolute right-0 top-6 flex items-start gap-3">
              <div className="text-right">
                <p className="font-gabarito text-[11px] uppercase tracking-wider text-[#5e7768]">Base HP</p>
                <p className="font-caprasimo text-2xl text-[#6f3a28]">{opponentBaseHp}</p>
              </div>
              <div
                className="frame-cut h-44 w-20"
                style={{ border: "1px solid rgba(39,65,55,0.2)", background: enemyAttackFlash ? "#f3d8d0" : "#ebe5d7" }}
              />
            </div>

            <div className="absolute left-[22%] top-[22%] grid h-24 w-24 place-items-center rounded-full border border-[rgba(39,65,55,0.26)] bg-[rgba(255,255,255,0.88)]">
              <p className="font-gabarito text-sm font-semibold uppercase tracking-wider text-[#5e7768]">You</p>
            </div>

            <div className="absolute right-[22%] top-[22%] grid h-24 w-24 place-items-center rounded-full border border-[rgba(39,65,55,0.26)] bg-[rgba(255,255,255,0.88)]">
              <p className="font-gabarito text-sm font-semibold uppercase tracking-wider text-[#5e7768]">Enemy</p>
            </div>

            <div className="absolute bottom-0 left-1/2 w-full max-w-4xl -translate-x-1/2">
              <p className="mb-2 text-center font-gabarito text-sm text-[#4f6759]">
                {enemyEventText ?? (isPlayable ? "Pick a card from the center deck." : "Waiting for server state...")}
              </p>

              <div className="flex items-end justify-center gap-2 md:gap-3">
                {Array.from({ length: displaySlots }).map((_, index) => {
                  const card = hand[index] ?? null;
                  const active = card ? activeCardId === card.id : false;
                  const transformClass = getCardTransform(index);
                  return (
                    <button
                      key={card?.id ?? `placeholder-${index}`}
                      type="button"
                      onClick={() => {
                        if (card) onOpenCard(card);
                      }}
                      disabled={!card || !isPlayable || Boolean(activeCardId) || isMatchComplete}
                      className={`frame-cut relative w-[18vw] min-w-[70px] max-w-[140px] aspect-[5/7] px-2 py-2 text-left transition ${transformClass}`}
                      style={{
                        border: active ? "1px solid #274137" : "1px solid rgba(39,65,55,0.2)",
                        background: "#e9e3d7",
                        opacity: !card || !isPlayable ? 0.6 : 1,
                      }}
                    >
                      <span className="font-gabarito text-[10px] uppercase tracking-[0.16em] text-[#6d8373]">
                        {card ? card.type : "locked"}
                      </span>
                      <span className="absolute bottom-2 left-2 font-caprasimo text-3xl text-[#51675a]">?</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>

      {status === "depositing" && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(20,30,24,0.35)] p-4">
          <div className="frame-cut w-full max-w-lg p-5" style={{ border: "1px solid rgba(39,65,55,0.22)", background: "#f5f1e8" }}>
            <p className="font-caprasimo text-3xl text-[#1f2b24]">Confirm Deposit</p>
            <p className="mt-2 font-gabarito text-sm text-[#4f6759]">
              Waiting for both players to confirm deposit before the battle starts.
            </p>
            <button
              type="button"
              onClick={() => confirmDeposit(`mock-signature-${Date.now()}`)}
              className="frame-cut frame-cut-sm mt-4 px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
              style={{ border: "1px solid rgba(39,65,55,0.22)", color: "#274137", background: "rgba(255,255,255,0.88)" }}
            >
              Confirm Deposit
            </button>
          </div>
        </div>
      )}

      {activeCard && status === "playing" && !isMatchComplete && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(20,30,24,0.35)] p-4">
          <div className="frame-cut w-full max-w-xl p-4 md:p-5" style={{ border: "1px solid rgba(39,65,55,0.22)", background: "#f5f1e8" }}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-gabarito text-[11px] uppercase tracking-[0.18em] text-[#6d8373]">
                {activeCard.question.id}
              </p>
              <p className="font-caprasimo text-4xl text-[#ba6931]">{displaySecondsLeft}</p>
            </div>

            <p className="font-gabarito text-lg font-semibold leading-relaxed text-[#1f2b24]">
              {activeCard.question.text}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {activeCard.question.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={answerLocked}
                  onClick={() => onAnswer(option.id)}
                  className="frame-cut px-3 py-3 text-left transition hover:-translate-y-0.5 disabled:opacity-65"
                  style={{ border: "1px solid rgba(39,65,55,0.22)", background: "#fffdfa" }}
                >
                  <p className="font-gabarito text-xs font-bold uppercase tracking-wider text-[#6d8373]">
                    {option.id}
                  </p>
                  <p className="mt-1 font-gabarito text-sm text-[#1f2b24]">{option.text}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isMatchComplete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(20,30,24,0.42)] p-4">
          <div className="frame-cut w-full max-w-xl p-5" style={{ border: "1px solid rgba(39,65,55,0.22)", background: "#f5f1e8" }}>
            <p className="font-caprasimo text-4xl text-[#1f2b24]">{settlementText}</p>
            <p className="mt-1 font-gabarito text-sm text-[#4f6759]">Resolved turns: {outcomes.length}</p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="frame-cut frame-cut-sm p-2" style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#edf4eb" }}>
                <p className="font-gabarito text-[10px] uppercase tracking-wider text-[#6d8373]">Correct</p>
                <p className="font-caprasimo text-2xl text-[#274137]">{correctCount}</p>
              </div>
              <div className="frame-cut frame-cut-sm p-2" style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#f6eee0" }}>
                <p className="font-gabarito text-[10px] uppercase tracking-wider text-[#6d8373]">Timeout</p>
                <p className="font-caprasimo text-2xl text-[#6f3a28]">{timeoutCount}</p>
              </div>
              <div className="frame-cut frame-cut-sm p-2" style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#f4e8e2" }}>
                <p className="font-gabarito text-[10px] uppercase tracking-wider text-[#6d8373]">Wrong</p>
                <p className="font-caprasimo text-2xl text-[#7c4a36]">{wrongCount}</p>
              </div>
            </div>

            <div className="mt-4 max-h-40 space-y-2 overflow-auto">
              {outcomes.map((item) => (
                <div
                  key={`${item.cardId}-${item.at}`}
                  className="frame-cut frame-cut-sm flex items-center justify-between px-3 py-2"
                  style={{ border: "1px solid rgba(39,65,55,0.16)", background: getOutcomeColor(item.outcome) }}
                >
                  <p className="font-gabarito text-xs text-[#274137]">{item.questionId}</p>
                  <p className="font-gabarito text-xs font-semibold uppercase tracking-wide text-[#5e7768]">
                    {getOutcomeLabel(item.outcome)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex gap-2">
              <Link
                href="/lobby"
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(39,65,55,0.22)", color: "#274137", background: "rgba(255,255,255,0.88)" }}
              >
                Back To Lobby
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
