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

---

## 6. Bugfixes — Matchmaking & Round Timer (2026-05-01)

**The Bugs:**
1. **Matchmaking order-dependent failure:** When using port forwarding (public URL), the first player to enter the queue would silently drop out before the second player joined. Matches only worked if the friend entered first.
2. **Round timer reset without round change:** When the 5-minute timer expired, the clock reset to 5:00 but the round number, health, and game state never updated on the frontend.

**The Change:**

*Files touched:* `packages/game-logic/src/GameEngine.ts`, `apps/api/src/managers/RoomManager.ts`

**Bug 1 (Matchmaking):**
- Root cause: `POST /match` used HTTP long-polling — the server held the request open until a match was found. Port forwarding proxies killed idle HTTP connections, firing the request's `AbortSignal` and removing the player from the queue before their opponent joined.
- Fix: Added three resilience layers to `queueMatch()`:
  1. **Room existence check:** If the player already has an active room (from a lost HTTP response), return it immediately.
  2. **Duplicate queue check:** If the player is already queued (from a dropped connection), chain the new request's resolve to the existing entry instead of adding a duplicate.
  3. **Server-side TTL:** Queue entries auto-expire after 5 minutes to prevent memory leaks from ghost entries.
- Also cleaned up pre-existing dead imports (`MatchFoundData`, `CharacterState`, `Card`).

**Bug 2 (Round Timer):**
- Root cause: `resetRound()` reset the timer, health, and round number internally but never emitted a `stateUpdate` event. The `roundOver` event handler in `RoomManager` broadcast the game state *before* `resetRound()` was called, so the frontend received stale data.
- Fix:
  1. Reordered: `resetRound()` is now called *before* emitting `roundOver`, so the broadcasted state reflects the new round.
  2. `resetRound()` now emits `stateUpdate` at the end, ensuring the frontend receives the updated round number, reset health, and reset timer.

**Tech Debt:**
- The `POST /match` endpoint still uses HTTP long-polling, which is inherently fragile with reverse proxies. A more robust approach would be to return `{ status: 'queued' }` immediately and notify via WebSocket when a match is found. This is deferred for now since the resilience layers mitigate the issue.

---

## 7. Bugfix — Deposit Freeze & Engine Crash (2026-05-01)

**The Bug:**
After both players deposited, the room would freeze and then get cancelled by a shot clock. Server logs showed `TypeError: undefined is not an object (evaluating 'player.address')` in `GameEngine.toPlayerState`.

**Root Cause (3 interlinked issues):**
1. **`allDeposited` checked `room.playerMeta.values()`** — which only contains players who connected via WebSocket (`joinRoom` populates it). If only 1 player connected, the check trivially passed with a single `true` entry.
2. **`initializeEngine` used `room.clients.keys()`** as the player address list — with only 1 client, the `GameEngine` was created with a 1-element array despite expecting a tuple of 2. The opponent lookup then returned `undefined`, crashing `toPlayerState`.
3. **No guard for 2-player connectivity** — the game could start before both WebSocket connections were established.

**The Fix:**
*Files touched:* `apps/api/src/managers/RoomManager.ts`

1. `allDeposited` now explicitly checks `room.playerA` and `room.playerB` deposits, not an arbitrary iteration of `playerMeta`.
2. `initializeEngine` now uses `[room.playerA, room.playerB]` (the authoritative role assignments from matchmaking), not `room.clients.keys()`.
3. Added a `room.clients.size < 2` guard before starting the engine.
4. Added a catch-up check in `joinRoom`: when the second player finally connects and both have already deposited, the game starts immediately.

**Tech Debt:**
- None introduced. This was a correctness fix that made the deposit flow resilient to connection timing.

---

## 8. Settlement — Graceful Skip Without RPC (2026-05-01)

**The Bug:**
After a match ended, the server spammed noisy retry errors and full stack traces trying to submit an on-chain settlement transaction to `http://127.0.0.1:8899` — a local Solana validator that wasn't running.

**Root Cause:**
No `.env` file existed (only `.env.example`), so `SOLANA_RPC_URL` was undefined and the fallback `http://127.0.0.1:8899` was unreachable. The `withRetry` helper tried 3 times before printing a massive error, even though the game itself was unaffected.

**The Fix:**
*Files touched:* `apps/api/src/utils/settlement.ts`

- Added `hasExplicitRpc` flag that checks if `SOLANA_RPC_URL` is set in the environment.
- `submitSettlementTransaction` now returns `'SKIPPED_NO_RPC'` immediately when no RPC is configured, with a clean one-line log.
- The server startup log now indicates when the default (unconfigured) RPC is being used.

**Tech Debt:**
- When ready for mainnet/devnet testing, create `apps/api/.env` with `SOLANA_RPC_URL=https://api.devnet.solana.com` to enable real on-chain settlement.
