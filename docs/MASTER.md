# 🚀 CORA — Master Reference

**Project Name:** CORA  
**One-Line Pitch:** High-stakes Wager-Fi esports for General Aptitude Tests (GAT) — from university prep to corporate hiring.

---

## ⚠️ The Problem (The Market Gap)

Every year, over **100 million** people worldwide take General Aptitude Tests (GAT) — logic, math, and spatial reasoning exams required for university admissions (SAT, GRE) and corporate/government hiring (McKinsey, CPNS, UPSC). The preparation industry is a massive, highly-stressful grind:

- Relies on outdated, solitary "try-outs" (practice exams)
- Zero immediate financial incentive to perform well in practice
- No real-time competitive pressure to simulate the actual exam environment
- Hundreds of hours of boring, isolated study with no feedback loop

---

## 💡 The Solution (CORA)

CORA transforms General Aptitude Test prep into a fast-paced, *Clash Royale*-style real-time PvP battle with real financial stakes.

- **Wager-Fi Model:** Players wager any SPL token (USDC, SOL, BONK, or any meme coin) against each other in rapid-fire logic and math matches. Both players in a match use the same token — no cross-token swaps. Zero-sum — no inflationary token, no ponzinomics.
- **Meme Coin Arenas:** Dead meme coins get new utility. Each token community gets their own competitive arena. Your unused bags become battle currency.
- **Revenue Model:** Winner takes the pot. CORA smart contract routes a 2.5% platform fee to the treasury. Pure skill-based yield.
- **Behavioral Hook:** Loss aversion transforms casual practice into high-focus performance — backed by behavioral economics.

---

## ⛓️ Architecture (Why Solana)

Real-time PvP wagering requires sub-second finality and near-zero transaction fees. Only 2 on-chain transactions per match.

### The Match Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                     CORA MATCH FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. MATCHMAKING (Off-Chain)                                 │
│     └─ Player joins queue via app or Blink                  │
│     └─ FIFO matchmaking pairs two players                   │
│     └─ WebSocket room created                               │
│                                                             │
│  2. ESCROW (On-Chain — Transaction #1)                      │
│     └─ Both players sign deposit via Phantom wallet         │
│     └─ Anchor smart contract locks tokens in PDA vault      │
│                                                             │
│  3. BATTLE (Off-Chain)                                      │
│     └─ Server sends 5 randomized GAT logic modules          │
│     └─ Players answer via WebSocket (no wallet signing)     │
│     └─ Server scores: correct answers + time bonus          │
│                                                             │
│  4. SETTLEMENT (On-Chain — Transaction #2)                  │
│     └─ Server determines winner                             │
│     └─ Server keypair signs settlement authorization        │
│     └─ Smart contract verifies signature + releases funds   │
│     └─ 97.5% to winner, 2.5% to treasury                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Smart Contract (Anchor/Rust)

```rust
initialize_match(player_a, player_b, wager_amount, token_mint)
deposit_wager(player, amount)
settle_match(winner, server_signature)
refund(match_id)  // timeout or disconnect
```

### Token-Agnostic (No Custom Token)

CORA does **not** create a new token. The escrow accepts **any existing SPL token** — USDC, SOL, BONK, WIF, or any meme coin. Both players in a match must wager the same token (no cross-token swaps). This is intentional:
- No tokenomics bloat, no inflationary risk
- Dead meme coins get new utility ("Meme Coin Arenas")
- `token_mint` is a parameter, not hardcoded

- CORA-specific (not generalized protocol — that's V2 roadmap)
- Deployed on **Devnet** with test tokens
- Clean, auditable, well-documented IDL

---

## 🔬 Key Features

### 1. Viral Distribution via Solana Actions & Blinks
Turn every match into a shareable "Challenge Me" link on X (Twitter). A rival clicks the Blink, connects their wallet, deposits their wager, and enters the queue — **directly in their social feed**. No app store visit needed.

### 2. Blue Ocean Vertical with Massive Global TAM
There is zero crypto competition in cognitive testing. The architecture scales seamlessly from Indonesian civil service (CPNS: 7M users) to India (UPSC: 20M users), corporate hiring, and global university entries (SAT/GRE). Logic questions are universal and copyright-free.

### 3. Meme Coin Arenas
Every SPL token community gets their own competitive space. BONK holders play in the BONK Arena, WIF holders in the WIF Arena. Dead meme coins sitting in wallets become battle currency — giving them genuine utility.

### 4. Anti-Cheat Behavioral Analysis (Proof of Concept)
Server logs click-cadence and time-to-answer data during matches. A Jupyter notebook demonstrates basic anomaly detection to flag bot-like behavior. **This is a roadmap item, not a production feature for MVP.**

---

## 🗺️ Go-To-Market Strategy

**"Global Engine, Local Beachhead"** — The CORA platform evaluates universal logic (GAT). However, our launch beachhead is the **Indonesian CPNS Exam (Specifically the TIU / General Intelligence section)**. 
By targeting CPNS first, we capture a hyper-motivated local market (7M users/year, zero crypto competitors) to prove unit economics, while presenting a universally scalable GAT model to stakeholders and investors.

---

## 🧑‍💻 Team (6 Specialists)

| Role | Scope |
|------|-------|
| **Frontend Lead** (React/Next.js) | Battle UI, game loop animations, `@solana/wallet-adapter-react` for Phantom |
| **Backend & Networking Lead** (Bun + Hono) | WebSocket rooms, matchmaking queue, Solana Actions endpoints, settlement oracle |
| **Data & Game Logic Engineer** (Python/TS) | Question bank (100 GAT/logic questions), scoring engine, anti-cheat PoC notebook |
| **Web3 & Smart Contract Lead** (Rust/Anchor) | Escrow program (4 instructions), Devnet deployment, IDL generation |
| **Designer** (Figma) | Design system, all screens (lobby/battle/result), Blink card, micro-animations |
| **Business & Product Lead** | Pitch deck, 3-minute video, Investor pitching, economic modeling |

---

## 🚫 Explicitly Out of Scope for MVP

| Cut | Reason |
|-----|--------|
| Generalized protocol / open infrastructure | Not needed for MVP core loop. V2 roadmap. |
| Elo matchmaking | Overkill for demo. FIFO queue works. |
| Session Keys / Ephemeral Rollups (MagicBlock) | Quiz game only needs 2 on-chain txns total. No problem to solve. |
| Production AI anti-cheat | Slated for Q3 roadmap. Jupyter notebook PoC handles MVP validation. |
| On-chain fairness proof hash | Mock "fairness badge" in UI is sufficient. |
| Mainnet deployment | Devnet only. Full audits required before mainnet launch. |
| Multiple GAT categories (SAT, GRE) | Stick to one logic category for MVP. |
| Custom token | No CORA token. Use existing SPL tokens. |
| Cross-token swaps (Jupiter/Raydium) | Both players must use same token. No DEX integration. |
| NFT minting for winners | P2 nice-to-have only. Not in core flow. |
| DAO / governance contracts | Community via Discord + X for now. Roadmap item. |
| Native mobile app | Web app instead — instant access, no app store friction. |

---

## 🌐 Community & Growth (Post-MVP)

| Phase | Channel | Purpose |
|-------|---------|--------|
| **Phase 1 (Private Beta)** | Discord + X/Twitter | Match finding, feedback, Blink sharing |
| **Phase 2 (Public Launch)** | + Telegram group | SEA crypto community outreach |
| **V2 roadmap** | Token-gated governance | Community votes on question categories, tournament rules |

No DAO for MVP. Community management = Discord server + viral Blinks on X.

---

## ✅ Core Validation Milestone

> A user opens a URL, connects their Phantom browser extension, wagers test tokens, plays a 5-question logic/aptitude quiz against another player, and watches the funds settle on-chain. This complete loop validates our core architecture.
---

## Project Folder Structure (MVP)

The repository is intentionally scaffolded with clear top-level boundaries, while leaving implementation details to each role and module owner.

```text
Cora/
|-- .github/
|   `-- workflows/
|-- apps/
|   |-- web/
|   |-- api/
|   `-- settlement-oracle/
|-- packages/
|   |-- solana-program/
|   |-- solana-client/
|   |-- game-logic/
|   |-- shared-types/
|   `-- ui/
|-- data/
|   |-- questions/
|   |-- tokens/
|   `-- fixtures/
|-- notebooks/
|-- scripts/
`-- docs/
    |-- MASTER.md
    `-- AGENTS.md
```

### Folder Explanations

- `.github/workflows`: CI pipelines for lint, test, build, and deploy checks.
- `apps/web`: User-facing app for lobby, battle, result flow, and wallet connection.
- `apps/api`: Matchmaking, WebSocket gameplay transport, and app APIs.
- `apps/settlement-oracle`: Service that authorizes match settlement signatures for on-chain verification.
- `packages/solana-program`: Anchor/Rust escrow program and on-chain instruction logic.
- `packages/solana-client`: TypeScript client helpers for program interaction and transaction construction.
- `packages/game-logic`: Shared scoring rules, question flow, and deterministic match logic.
- `packages/shared-types`: Shared schemas and types used across apps and packages.
- `packages/ui`: Reusable UI components and design tokens for frontend consistency.
- `data/questions`: Source question bank for GAT/TIU and related metadata.
- `data/tokens`: Allowed SPL token arena configuration and token metadata.
- `data/fixtures`: Test fixtures and mock payloads for development and QA.
- `notebooks`: Research notebooks, including anti-cheat proof-of-concept experiments.
- `scripts`: Project automation scripts such as seeding, local setup, and helper utilities.
- `docs`: Product, architecture, and execution references for the team.

### Ownership Model

- Frontend Lead primarily owns `apps/web` and collaborates on `packages/ui`.
- Backend & Networking Lead primarily owns `apps/api` and `apps/settlement-oracle`.
- Data & Game Logic Engineer primarily owns `packages/game-logic`, `data/questions`, and `notebooks`.
- Web3 & Smart Contract Lead primarily owns `packages/solana-program` and `packages/solana-client`.
- Cross-team interfaces should be stabilized in `packages/shared-types`.
