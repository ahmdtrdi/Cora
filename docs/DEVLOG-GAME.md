# GAME Role - Development Log

## 1. Question Data & Schema

**Implementation:**
- Added TypeScript interfaces and validation logic for `Question` and `Option` structures in `packages/shared-types/src/question.ts`. 
- Defined a strict structure requiring exactly 4 options per question.

**The Reasoning:**
- A unified structure avoids runtime errors when parsing AI-generated questions or reading from `questions.json`.
- Sharing the types via the `shared-types` package allows the backend, frontend, and testing scripts to stay perfectly synchronized.

**Tech Debt:**
- Currently using manual runtime validation. If schema complexity grows, we should migrate to Zod to automatically derive interfaces and handle validation.

---

## 2. Core Game Engine Architecture

**Implementation:**
Built the core Game Engine as a pure, I/O-free TypeScript class in `packages/game-logic/`. It relies on event-emission (`timerSync`, `damageEvent`, etc.) rather than websockets directly, allowing the `RoomManager` to handle network broadcasting independently.

**Engine Rules & Mechanics:**
- **Match Duration:** 5 minutes (300,000 ms).
- **Extra Point Phase:** The final 1 minute applies a 2x multiplier to all damage and healing.
- **Base Damage/Heal:** 10 HP per correct answer. Heal caps at 100 HP.
- **Hand Size:** 5 cards, auto-refilled instantly from a shared queue when played.
- **Card Distribution:** 60% attack, 40% heal.
- **Win Conditions:** Instant win if opponent hits 0 HP. If time runs out, the player with the highest HP wins (tie-breaker by score).

**Tech Debt:**
- Rate limit constants (e.g., 500ms cooldowns) and card type distributions are currently hardcoded. They should be extracted into configurable parameters for easier balancing.

---

## 3. Question Dealer & Competitive Fairness

**Implementation:**
The `QuestionDealer` and `GameEngine` have been heavily refactored to ensure a completely fair trivia competition:
- **Balanced Selection:** Questions are drawn using a round-robin category selection algorithm (Sequence → Logical → Math) rather than purely random shuffling.
- **No Duplicates:** The dealer returns `null` when the question pool is exhausted, strictly guaranteeing no duplicate questions in a single match.
- **Identical Shared Queue:** Upon match initialization, the `GameEngine` pre-generates a single shared queue of up to 100 cards. Both players start with an identical hand (cards 0-4). As they play, they draw the next card in the shared sequence based on their personal `queueIndex`.

**The Reasoning:**
- A completely random shuffle could occasionally deal hands heavily skewed toward a single category, punishing players based on luck.
- An identical shared queue guarantees that the match is a true race of knowledge. Both players face the exact same questions in the exact same order.
- Pre-generating the shared queue prevents desync issues and mismatched `correctOptionId` validations.

**Tech Debt:**
- The engine expects the `questions.json` pool to have enough questions to sustain a 5-minute match without running out (generating up to 100 cards). If players exhaust the 100-card queue, they will stop receiving cards. We must either expand the pool significantly or gracefully declare a draw if the pool runs dry.

---

## 4. Testing & Stabilization

**Implementation:**
- Implemented `packages/game-logic/mock-match.ts`, a 2-player terminal simulation to validate the engine's lifecycle headless.
- Created `packages/game-logic/visual-test.ts` to visually verify that both players receive identical hands and identical card replenishments from the shared queue.
- Expanded unit tests (`GameEngine.test.ts` and `QuestionDealer.test.ts`) using `bun:test` to cover win conditions, exhaustion limits, correct schema validation (4 options), and cooldowns.

**The Reasoning:**
- A pure, I/O-free engine makes deterministic testing possible and prevents hard-to-track race conditions.
- Terminal simulations allow rapid iteration on the game loop without needing to spin up the web frontend or websocket server.

---

## 5. Anti-Cheat System

**Implementation:**
- Implemented `AntiCheatAnalyzer`, a stateless-per-action behavioral analysis engine that tracks player interaction patterns (answer speed, accuracy rate, consistency, input cadence, etc.).
- Integrated it directly into the `GameEngine`, recording every `playCard` action without slowing down the game loop.
- Emits an `AntiCheatVerdict` (`trusted`, `suspicious`, `rejected`) upon game completion.
- Updated the `RoomManager` to consume these verdicts, actively halting on-chain settlement for `rejected` matches and broadcasting a `matchInvalidated` event.
- Created `docs/ML-DATA-COLLECTION.md` detailing how raw `PlayerMatchStats` are collected for future Machine Learning model training.

**The Reasoning:**
- Real money wagers require a trustless environment. A 10-second timer isn't enough to stop specialized answer bots (OCR + LLM) or macro-assisted clicks.
- The system must remain entirely server-side. Any client-side anti-cheat can be reverse-engineered and bypassed.
- By emitting warnings on `suspicious` play but only blocking on `rejected`, we minimize false positives affecting legitimate players.

**Tech Debt:**
- We are currently using static, educated-guess thresholds for penalties (e.g., < 1500ms average response time is penalized). We need to review the logged data over the first few thousand matches to fine-tune these thresholds, eventually transitioning to an ML-based approach.
