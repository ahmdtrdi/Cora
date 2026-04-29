"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Question } from "@shared/question";
import { validateQuestion } from "@shared/question";
import questionPoolRaw from "../../../../../data/questions/questions.json";

type CardState = {
  question: Question;
  status: "idle" | "answered";
  outcome?: "correct" | "wrong" | "timeout";
};

type MatchOutcome = {
  cardIndex: number;
  questionId: string;
  outcome: "correct" | "wrong" | "timeout";
};

const QUESTIONS_PER_MATCH = 5;
const ANSWER_TIME_SEC = 10;
const START_HP = 100;

const CARD_TRANSFORMS = [
  "translate-y-4 -rotate-6",
  "translate-y-1 -rotate-3",
  "-translate-y-1 rotate-0",
  "translate-y-1 rotate-3",
  "translate-y-4 rotate-6",
] as const;

function hashString(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeSeededRng(seed: number) {
  let state = seed || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleQuestions(input: Question[], seedText: string) {
  const rng = makeSeededRng(hashString(seedText));
  const arr = [...input];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function getCardColor(card: CardState) {
  if (card.status !== "answered") {
    return "#e9e3d7";
  }
  if (card.outcome === "correct") {
    return "#d8ead4";
  }
  if (card.outcome === "timeout") {
    return "#efe8d5";
  }
  return "#f2ddd4";
}

function getCardLabel(card: CardState, idx: number) {
  if (card.status !== "answered") {
    return `Card ${idx + 1}`;
  }
  if (card.outcome === "correct") {
    return "Correct";
  }
  if (card.outcome === "timeout") {
    return "Timeout";
  }
  return "Wrong";
}

export function BattleScreen() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId") ?? "mock-room-001";

  const validQuestions = useMemo(() => {
    const raw = questionPoolRaw as unknown[];
    return raw.filter(validateQuestion) as Question[];
  }, []);

  const buildCards = useCallback(
    (seedText: string) => {
      const shuffled = shuffleQuestions(validQuestions, seedText);
      const selected = shuffled.slice(0, QUESTIONS_PER_MATCH);
      return selected.map((question) => ({ question, status: "idle" as const }));
    },
    [validQuestions],
  );

  const [cards, setCards] = useState<CardState[]>(() => buildCards(`${roomId}-seed`));
  const cardsRef = useRef(cards);

  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(ANSWER_TIME_SEC);
  const [answerLocked, setAnswerLocked] = useState(false);

  const [playerBaseHp] = useState(START_HP);
  const [opponentBaseHp] = useState(START_HP);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);

  const [enemyAttackFlash, setEnemyAttackFlash] = useState(false);
  const [enemyEventText, setEnemyEventText] = useState<string | null>(null);
  const [matchOutcomes, setMatchOutcomes] = useState<MatchOutcome[]>([]);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const unansweredCount = cards.filter((card) => card.status === "idle").length;
  const answeredCount = cards.length - unansweredCount;
  const isMatchComplete = cards.length > 0 && answeredCount === cards.length;

  const emitEnemyAttack = useCallback(() => {
    const didAttack = Math.random() < 0.45;

    if (!didAttack) {
      setEnemyEventText("Opponent is thinking...");
      return;
    }

    setOpponentScore((prev) => prev + 1);
    setEnemyAttackFlash(true);
    setEnemyEventText("Opponent attacked!");

    setTimeout(() => {
      setEnemyAttackFlash(false);
    }, 460);
  }, []);

  const resolveCard = useCallback(
    (cardIndex: number, optionId: string | null) => {
      const currentCards = cardsRef.current;
      const target = currentCards[cardIndex];

      if (!target || target.status !== "idle") {
        setActiveCardIndex(null);
        setAnswerLocked(false);
        return;
      }

      const selectedOption = optionId
        ? target.question.options.find((option) => option.id === optionId)
        : null;

      const timedOut = optionId === null;
      const isCorrect = selectedOption?.score === true;

      const outcome: "correct" | "wrong" | "timeout" = timedOut
        ? "timeout"
        : isCorrect
          ? "correct"
          : "wrong";

      if (isCorrect) {
        setPlayerScore((prev) => prev + 1);
      }

      setCards((prev) =>
        prev.map((card, idx) =>
          idx === cardIndex ? { ...card, status: "answered", outcome } : card,
        ),
      );

      setMatchOutcomes((prev) => [
        ...prev,
        { cardIndex, questionId: target.question.id, outcome },
      ]);

      emitEnemyAttack();

      setTimeout(() => {
        setActiveCardIndex(null);
        setAnswerLocked(false);
      }, 250);
    },
    [emitEnemyAttack],
  );

  useEffect(() => {
    if (activeCardIndex === null || answerLocked || isMatchComplete) {
      return;
    }

    let remaining = ANSWER_TIME_SEC;

    const intervalId = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(Math.max(remaining, 0));

      if (remaining <= 0) {
        clearInterval(intervalId);
        setAnswerLocked(true);
        resolveCard(activeCardIndex, null);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [activeCardIndex, answerLocked, isMatchComplete, resolveCard]);

  const activeCard = activeCardIndex !== null ? cards[activeCardIndex] : null;

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
              Round {Math.min(answeredCount + 1, QUESTIONS_PER_MATCH)} / {QUESTIONS_PER_MATCH}
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
                {enemyEventText ?? "Pick a card from the center deck."}
              </p>

              <div className="flex items-end justify-center gap-2 md:gap-3">
                {cards.map((card, index) => {
                  const isActive = activeCardIndex === index;
                  const isAnswered = card.status === "answered";

                  return (
                    <button
                      key={card.question.id}
                      type="button"
                      disabled={isAnswered || activeCardIndex !== null || isMatchComplete}
                      onClick={() => {
                        setActiveCardIndex(index);
                        setSecondsLeft(ANSWER_TIME_SEC);
                        setAnswerLocked(false);
                      }}
                      className={`frame-cut relative w-[18vw] min-w-[70px] max-w-[140px] aspect-[5/7] px-2 py-2 text-left transition ${CARD_TRANSFORMS[index]}`}
                      style={{
                        border: isActive ? "1px solid #274137" : "1px solid rgba(39,65,55,0.2)",
                        background: getCardColor(card),
                        opacity: isAnswered ? 0.96 : 1,
                      }}
                    >
                      <span className="font-gabarito text-[10px] uppercase tracking-[0.16em] text-[#6d8373]">
                        {getCardLabel(card, index)}
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

      {activeCard && !isMatchComplete && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(20,30,24,0.35)] p-4">
          <div className="frame-cut w-full max-w-xl p-4 md:p-5" style={{ border: "1px solid rgba(39,65,55,0.22)", background: "#f5f1e8" }}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-gabarito text-[11px] uppercase tracking-[0.18em] text-[#6d8373]">
                {activeCard.question.category}
              </p>
              <p className="font-caprasimo text-4xl text-[#ba6931]">{secondsLeft}</p>
            </div>

            <p className="font-gabarito text-lg font-semibold leading-relaxed text-[#1f2b24]">
              {activeCard.question.questionText}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {activeCard.question.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={answerLocked}
                  onClick={() => {
                    if (answerLocked || activeCardIndex === null) {
                      return;
                    }
                    setAnswerLocked(true);
                    resolveCard(activeCardIndex, option.id);
                  }}
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
            <p className="font-caprasimo text-4xl text-[#1f2b24]">Match Summary</p>
            <p className="mt-1 font-gabarito text-sm text-[#4f6759]">Questions answered: {cards.length}</p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="frame-cut frame-cut-sm p-2" style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#edf4eb" }}>
                <p className="font-gabarito text-[10px] uppercase tracking-wider text-[#6d8373]">Correct</p>
                <p className="font-caprasimo text-2xl text-[#274137]">
                  {matchOutcomes.filter((item) => item.outcome === "correct").length}
                </p>
              </div>
              <div className="frame-cut frame-cut-sm p-2" style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#f6eee0" }}>
                <p className="font-gabarito text-[10px] uppercase tracking-wider text-[#6d8373]">Timeout</p>
                <p className="font-caprasimo text-2xl text-[#6f3a28]">
                  {matchOutcomes.filter((item) => item.outcome === "timeout").length}
                </p>
              </div>
              <div className="frame-cut frame-cut-sm p-2" style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#f4e8e2" }}>
                <p className="font-gabarito text-[10px] uppercase tracking-wider text-[#6d8373]">Wrong</p>
                <p className="font-caprasimo text-2xl text-[#7c4a36]">
                  {matchOutcomes.filter((item) => item.outcome === "wrong").length}
                </p>
              </div>
            </div>

            <div className="mt-4 max-h-40 overflow-auto space-y-2">
              {matchOutcomes.map((item) => (
                <div
                  key={item.questionId}
                  className="frame-cut frame-cut-sm flex items-center justify-between px-3 py-2"
                  style={{ border: "1px solid rgba(39,65,55,0.16)", background: "rgba(255,255,255,0.8)" }}
                >
                  <p className="font-gabarito text-xs text-[#274137]">Card {item.cardIndex + 1}</p>
                  <p className="font-gabarito text-xs font-semibold uppercase tracking-wide text-[#5e7768]">
                    {item.outcome}
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
              <button
                type="button"
                onClick={() => {
                  const nextCards = buildCards(`${roomId}-${Date.now()}`);
                  setCards(nextCards);
                  setActiveCardIndex(null);
                  setSecondsLeft(ANSWER_TIME_SEC);
                  setAnswerLocked(false);
                  setPlayerScore(0);
                  setOpponentScore(0);
                  setEnemyEventText(null);
                  setEnemyAttackFlash(false);
                  setMatchOutcomes([]);
                }}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(39,65,55,0.22)", color: "#274137", background: "rgba(255,255,255,0.88)" }}
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
