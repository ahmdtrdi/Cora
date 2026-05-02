export type LandingAccent = "primary" | "secondary";

export type ScientistStat = {
  label: string;
  value: number;
};

export type ScientistProfile = {
  id: string;
  name: string;
  short: string;
  detail: string;
  archetype: string;
  baseConcept: string;
  accent: LandingAccent;
  stats: ScientistStat[];
};

export type LandingStage = {
  id: string;
  label: string;
  domain: "Off-chain" | "On-chain";
  accent: LandingAccent;
  title: string;
  summary: string;
  stat: string;
};

export type LandingTickerItem = {
  label: string;
  detail: string;
  accent: LandingAccent | "neutral";
};

export const LANDING_SCIENTISTS: ScientistProfile[] = [
  {
    id: "einstein",
    name: "Einstein",
    short: "Logic Pressure and Conceptual Clarity",
    detail:
      "Specializes in long-form logic chains. Correct answers build Relativity Charge, amplifying attack cards in later rounds.",
    archetype: "Tactician",
    baseConcept: "Relativity Lab",
    accent: "primary",
    stats: [
      { label: "Logic", value: 92 },
      { label: "Memory", value: 74 },
      { label: "Focus", value: 78 },
      { label: "Speed", value: 58 },
    ],
  },
  {
    id: "curie",
    name: "Marie Curie",
    short: "Precision Recall and Durable Control",
    detail:
      "Excels in retention prompts. Radiation Shield softens incoming damage while enabling steady healing across rounds.",
    archetype: "Defender",
    baseConcept: "Radium Reactor",
    accent: "secondary",
    stats: [
      { label: "Logic", value: 76 },
      { label: "Memory", value: 94 },
      { label: "Focus", value: 86 },
      { label: "Speed", value: 52 },
    ],
  },
  {
    id: "turing",
    name: "Alan Turing",
    short: "Pattern Decoding and Fast Adaptation",
    detail:
      "Reads puzzle rhythm quickly. Cipher Break streaks reward high-accuracy speed and unlock critical burst turns.",
    archetype: "Striker",
    baseConcept: "Cipher Engine",
    accent: "primary",
    stats: [
      { label: "Logic", value: 89 },
      { label: "Memory", value: 81 },
      { label: "Focus", value: 72 },
      { label: "Speed", value: 88 },
    ],
  },
];

export const LANDING_STAGES: LandingStage[] = [
  {
    id: "01",
    label: "Matchmaking",
    domain: "Off-chain",
    accent: "primary",
    title: "Queue, pair, open room",
    summary:
      "Player joins queue from app or Blink. FIFO pairs two players and opens a WebSocket room.",
    stat: "WebSocket",
  },
  {
    id: "02",
    label: "Escrow",
    domain: "On-chain",
    accent: "secondary",
    title: "Both players deposit",
    summary:
      "Both players sign the deposit in Phantom. Anchor contract locks funds in a PDA vault.",
    stat: "Tx #1",
  },
  {
    id: "03",
    label: "Battle",
    domain: "Off-chain",
    accent: "primary",
    title: "3-round card battle",
    summary:
      "Players use randomized Action Cards (Heal/Attack). Correct GAT answers damage enemy or heal own base HP.",
    stat: "3 rounds",
  },
  {
    id: "04",
    label: "Settlement",
    domain: "On-chain",
    accent: "secondary",
    title: "Signed result, funds released",
    summary:
      "Server signs settlement authorization. Contract verifies signature and releases 97.5% to winner, 2.5% treasury.",
    stat: "Tx #2",
  },
];

export const LANDING_TICKER_ITEMS: LandingTickerItem[] = [
  { label: "Einstein", detail: "Relativity Lab ready", accent: "primary" },
  { label: "Curie", detail: "Radium Reactor charged", accent: "secondary" },
  { label: "Turing", detail: "Cipher Engine active", accent: "primary" },
  { label: "Room", detail: "2 players matched", accent: "neutral" },
  { label: "Escrow", detail: "Vault awaiting signatures", accent: "secondary" },
  { label: "Battle", detail: "3 rounds online", accent: "primary" },
];