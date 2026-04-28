# GAME Role - Development Log

## Recent Changes

### 1. Created Question JSON Schema
**The Change:** 
Added TypeScript interfaces and validation logic for `Question` and `Option` structures in `packages/shared-types/src/question.ts`. This standardizes the expected format from our Agents and will be used by both the backend and frontend.

**The Reasoning:**
We need a unified structure to validate the AI-generated questions to avoid unexpected runtime errors. Putting it in `shared-types` allows all aspects of the application to reuse these strict types, and moving the documentation to this DEVLOG keeps `AGENTS.md` focused on agent behavior rather than schema details.

**The Tech Debt:**
Currently using manual runtime validation in `validateQuestion`. Consider migrating to Zod if schema complexity grows to automatically derive TypeScript interfaces and perform more robust runtime validations.

---

## Data Structures

### Question JSON Structure

The Agent is expected to generate questions following this structure:

**Root Object (Question)**
| Property | Data Type | Required | Description | Validation Rules |
|----------|-----------|----------|-------------|------------------|
| `id` | String | ✅ | Unique identifier. | Recommended format: `q_[category]_[number]` |
| `category` | String | ✅ | The category of the question. | Allowed values: `"sequence"`, `"logical"`, `"math"` |
| `questionText` | String | ✅ | Main text of the question. | - |
| `options` | Array | ✅ | List of multiple choices. | Must contain exactly 4 `Option` objects. |
| `explanation` | String | ✅ | Explanation or solution. | - |

**Option Object (Inside `options`)**
| Property | Data Type | Required | Description | Validation Rules |
|----------|-----------|----------|-------------|------------------|
| `id` | String | ✅ | Identifier for the answer option. | Usually `"A"`, `"B"`, `"C"`, `"D"` |
| `text` | String | ✅ | Text of the answer option. | - |
| `score` | Boolean | ✅ | Determines if this is correct. | - |

**Example:**
```json
[
  {
    "id": "q_math_001",
    "category": "math",
    "questionText": "Berapa hasil dari 5 + 7 * 2?",
    "options": [
      {
        "id": "A",
        "text": "24",
        "score": false
      },
      {
        "id": "B",
        "text": "19",
        "score": true
      },
      {
        "id": "C",
        "text": "17",
        "score": false
      },
      {
        "id": "D",
        "text": "12",
        "score": false
      }
    ],
    "explanation": "Sesuai aturan hierarki operasi matematika, perkalian dikerjakan lebih dulu: 7 * 2 = 14. Kemudian 5 + 14 = 19."
  }
]
```

---

### 2. Game Engine Implementation (`packages/game-logic`)

**The Change:**
Built the core Game Engine as a pure TypeScript class in `packages/game-logic/`. This is the single authority for all match gameplay logic. Files created/modified:

- **`packages/game-logic/src/GameEngine.ts`** — Core engine class (timer, health, scoring, card dealing, win conditions)
- **`packages/game-logic/src/QuestionDealer.ts`** — Fisher-Yates shuffle + card dealer from question pool
- **`packages/game-logic/src/types.ts`** — Internal engine types (EnginePlayerState, EngineCard, PlayCardResult, event map)
- **`packages/game-logic/src/index.ts`** — Barrel exports
- **`packages/game-logic/package.json`** + **`tsconfig.json`** — Package setup
- **`packages/shared-types/src/websocket.ts`** — Extended with `TimerState`, `GamePhase`, `DamageEvent`, `MatchResult`, `score` on PlayerState, `QuestionOption`. Removed round-based model.
- **`apps/api/src/managers/RoomManager.ts`** — Rewired to delegate all game logic to `GameEngine`. Removed inline mock logic (`getMockHand`, hardcoded 20 dmg). Engine events → WebSocket broadcasts.
- **`apps/api/src/questions.ts`** — Question loader that reads + validates JSON from `data/questions/` at startup
- **`data/questions/questions.json`** — 105 seed questions (math, sequence, logical) in English
- **`apps/web/src/hooks/useMatchSocket.ts`** — Updated to handle new events: `timerSync`, `damageEvent`, `phaseChange`, `playCardResult`, `matchResult` (typed). Added `confirmDeposit` action. Changed `selectedOptionIndex` → `selectedOptionId`.

**Engine Rules:**
| Parameter | Value |
|---|---|
| Match duration | 5 minutes (300,000 ms) |
| Extra point phase | Last 1 minute (≤ 60,000 ms remaining) |
| Base damage (attack) | 10 HP per correct answer |
| Base heal | 10 HP per correct answer (capped at 100) |
| Extra point multiplier | ×2 (so 20 dmg/heal in last minute) |
| Starting health | 100 HP per player |
| Hand size | 5 cards (auto-refill on play) |
| Card type distribution | 60% attack, 40% heal |
| Win: HP zero | Instant win for attacker |
| Win: Time up | Highest HP → tie-break by score → tie-break first player |
| Win: Forfeit | Opponent wins on disconnect timeout (10s) |

**The Reasoning:**
- Engine is I/O-free (no WebSocket, no file reads) — it emits typed events that `RoomManager` broadcasts. This makes it testable in isolation and portable.
- `QuestionDealer` reshuffles when exhausted, so a 5-minute match never runs out of questions even with only 20 seed questions.
- Correct answers on cards are stored server-side only (`EngineCard.correctOptionId`) and stripped via `toClientCards()` before sending to clients — preventing client-side cheating.
- Timer ticks every 1s and sends `timerSync` events. FE can interpolate between ticks for smooth countdown display.
- `DamageEvent` log kept to last 20 entries for FE animation replay without unbounded memory growth.

**The Tech Debt:**
- Question pool is only 20 questions. Need to expand significantly or wire up AI-generated question pipeline.
- Card type distribution (60/40 attack/heal) is hardcoded — should be configurable or balanced through playtesting.

---

### 3. Game Engine Stabilization & Test Simulation

**The Change:**
- Fixed critical bugs in `GameEngine` and `QuestionDealer` (removed `setTimeout` side effect, added rate limit cooldown, added recursion guards).
- Added `resetCharacterStates` to `GameEngine` and moved the animation timeout responsibility to `RoomManager`.
- Ensured strict schema validation for single correct answers in `question.ts`.
- Implemented a 2-player terminal mock simulation (`mock-match.ts`) that runs a full headless match.
- Expanded unit tests (`GameEngine.test.ts`) covering all win conditions, wrong answers, and heal caps.

**The Reasoning:**
- A pure engine makes deterministic testing possible and prevents hard-to-track race conditions with callbacks/timeouts.
- The 2-player headless simulation is the best way to validate the full engine lifecycle without spinning up the browser.
- Rate limits protect against malicious clients spamming the API endpoint to instantly reduce opponent HP.

**The Tech Debt:**
- We may want to extract the rate limit constant (500ms) into a configurable engine parameter.

---

### 4. Balanced Question Selection & No Duplicates Update

**The Change:**
- Refactored `QuestionDealer` in `packages/game-logic/src/QuestionDealer.ts` to draw questions using a balanced round-robin category selection algorithm (e.g. sequence -> logical -> math).
- Changed the exhaustion logic so that `dealOne()` now returns `null` when the entire question pool is exhausted, strictly guaranteeing no duplicates per match, instead of infinitely reshuffling.
# GAME Role - Development Log

## Recent Changes

### 1. Created Question JSON Schema
**The Change:** 
Added TypeScript interfaces and validation logic for `Question` and `Option` structures in `packages/shared-types/src/question.ts`. This standardizes the expected format from our Agents and will be used by both the backend and frontend.

**The Reasoning:**
We need a unified structure to validate the AI-generated questions to avoid unexpected runtime errors. Putting it in `shared-types` allows all aspects of the application to reuse these strict types, and moving the documentation to this DEVLOG keeps `AGENTS.md` focused on agent behavior rather than schema details.

**The Tech Debt:**
Currently using manual runtime validation in `validateQuestion`. Consider migrating to Zod if schema complexity grows to automatically derive TypeScript interfaces and perform more robust runtime validations.

---

## Data Structures

### Question JSON Structure

The Agent is expected to generate questions following this structure:

**Root Object (Question)**
| Property | Data Type | Required | Description | Validation Rules |
|----------|-----------|----------|-------------|------------------|
| `id` | String | ✅ | Unique identifier. | Recommended format: `q_[category]_[number]` |
| `category` | String | ✅ | The category of the question. | Allowed values: `"sequence"`, `"logical"`, `"math"` |
| `questionText` | String | ✅ | Main text of the question. | - |
| `options` | Array | ✅ | List of multiple choices. | Must contain exactly 4 `Option` objects. |
| `explanation` | String | ✅ | Explanation or solution. | - |

**Option Object (Inside `options`)**
| Property | Data Type | Required | Description | Validation Rules |
|----------|-----------|----------|-------------|------------------|
| `id` | String | ✅ | Identifier for the answer option. | Usually `"A"`, `"B"`, `"C"`, `"D"` |
| `text` | String | ✅ | Text of the answer option. | - |
| `score` | Boolean | ✅ | Determines if this is correct. | - |

**Example:**
```json
[
  {
    "id": "q_math_001",
    "category": "math",
    "questionText": "Berapa hasil dari 5 + 7 * 2?",
    "options": [
      {
        "id": "A",
        "text": "24",
        "score": false
      },
      {
        "id": "B",
        "text": "19",
        "score": true
      },
      {
        "id": "C",
        "text": "17",
        "score": false
      },
      {
        "id": "D",
        "text": "12",
        "score": false
      }
    ],
    "explanation": "Sesuai aturan hierarki operasi matematika, perkalian dikerjakan lebih dulu: 7 * 2 = 14. Kemudian 5 + 14 = 19."
  }
]
```

---

### 2. Game Engine Implementation (`packages/game-logic`)

**The Change:**
Built the core Game Engine as a pure TypeScript class in `packages/game-logic/`. This is the single authority for all match gameplay logic. Files created/modified:

- **`packages/game-logic/src/GameEngine.ts`** — Core engine class (timer, health, scoring, card dealing, win conditions)
- **`packages/game-logic/src/QuestionDealer.ts`** — Fisher-Yates shuffle + card dealer from question pool
- **`packages/game-logic/src/types.ts`** — Internal engine types (EnginePlayerState, EngineCard, PlayCardResult, event map)
- **`packages/game-logic/src/index.ts`** — Barrel exports
- **`packages/game-logic/package.json`** + **`tsconfig.json`** — Package setup
- **`packages/shared-types/src/websocket.ts`** — Extended with `TimerState`, `GamePhase`, `DamageEvent`, `MatchResult`, `score` on PlayerState, `QuestionOption`. Removed round-based model.
- **`apps/api/src/managers/RoomManager.ts`** — Rewired to delegate all game logic to `GameEngine`. Removed inline mock logic (`getMockHand`, hardcoded 20 dmg). Engine events → WebSocket broadcasts.
- **`apps/api/src/questions.ts`** — Question loader that reads + validates JSON from `data/questions/` at startup
- **`data/questions/questions.json`** — 105 seed questions (math, sequence, logical) in English
- **`apps/web/src/hooks/useMatchSocket.ts`** — Updated to handle new events: `timerSync`, `damageEvent`, `phaseChange`, `playCardResult`, `matchResult` (typed). Added `confirmDeposit` action. Changed `selectedOptionIndex` → `selectedOptionId`.

**Engine Rules:**
| Parameter | Value |
|---|---|
| Match duration | 5 minutes (300,000 ms) |
| Extra point phase | Last 1 minute (≤ 60,000 ms remaining) |
| Base damage (attack) | 10 HP per correct answer |
| Base heal | 10 HP per correct answer (capped at 100) |
| Extra point multiplier | ×2 (so 20 dmg/heal in last minute) |
| Starting health | 100 HP per player |
| Hand size | 5 cards (auto-refill on play) |
| Card type distribution | 60% attack, 40% heal |
| Win: HP zero | Instant win for attacker |
| Win: Time up | Highest HP → tie-break by score → tie-break first player |
| Win: Forfeit | Opponent wins on disconnect timeout (10s) |

**The Reasoning:**
- Engine is I/O-free (no WebSocket, no file reads) — it emits typed events that `RoomManager` broadcasts. This makes it testable in isolation and portable.
- `QuestionDealer` reshuffles when exhausted, so a 5-minute match never runs out of questions even with only 20 seed questions.
- Correct answers on cards are stored server-side only (`EngineCard.correctOptionId`) and stripped via `toClientCards()` before sending to clients — preventing client-side cheating.
- Timer ticks every 1s and sends `timerSync` events. FE can interpolate between ticks for smooth countdown display.
- `DamageEvent` log kept to last 20 entries for FE animation replay without unbounded memory growth.

**The Tech Debt:**
- Question pool is only 20 questions. Need to expand significantly or wire up AI-generated question pipeline.
- Card type distribution (60/40 attack/heal) is hardcoded — should be configurable or balanced through playtesting.

---

### 3. Game Engine Stabilization & Test Simulation

**The Change:**
- Fixed critical bugs in `GameEngine` and `QuestionDealer` (removed `setTimeout` side effect, added rate limit cooldown, added recursion guards).
- Added `resetCharacterStates` to `GameEngine` and moved the animation timeout responsibility to `RoomManager`.
- Ensured strict schema validation for single correct answers in `question.ts`.
- Implemented a 2-player terminal mock simulation (`mock-match.ts`) that runs a full headless match.
- Expanded unit tests (`GameEngine.test.ts`) covering all win conditions, wrong answers, and heal caps.

**The Reasoning:**
- A pure engine makes deterministic testing possible and prevents hard-to-track race conditions with callbacks/timeouts.
- The 2-player headless simulation is the best way to validate the full engine lifecycle without spinning up the browser.
- Rate limits protect against malicious clients spamming the API endpoint to instantly reduce opponent HP.

**The Tech Debt:**
- We may want to extract the rate limit constant (500ms) into a configurable engine parameter.

---

### 4. Balanced Question Selection & No Duplicates Update

**The Change:**
- Refactored `QuestionDealer` in `packages/game-logic/src/QuestionDealer.ts` to draw questions using a balanced round-robin category selection algorithm (e.g. sequence -> logical -> math).
- Changed the exhaustion logic so that `dealOne()` now returns `null` when the entire question pool is exhausted, strictly guaranteeing no duplicates per match, instead of infinitely reshuffling.
- Added a mock-test `packages/game-logic/test/QuestionDealer.test.ts` to simulate and verify the balanced distribution and exhaustion without duplicates.

**The Reasoning:**
- A completely random shuffle could result in a hand dominated by a single category, which isn't ideal for a balanced trivia experience. Cycling through categories ensures variety.
- Returning `null` on exhaustion strictly adheres to the "no duplicates per match" requirement.

**The Tech Debt:**
- If matches go on longer than the question pool can sustain, players might run out of cards. We must either ensure the question pool is large enough or gracefully end the game / declare a draw if cards cannot be replenished.

---

### 5. Identical Card Queue For Players

**The Change:**
- Modified `GameEngine` so that both players receive exactly the same sequence of cards.
- During initialization, the `GameEngine` uses the `QuestionDealer` to generate a single shared `matchQueue` of up to 100 cards.
- Both players start with identical hands (cards 0-4 from the queue).
- When a player answers a question and uses a card, they draw the next card in their personal sequence index (`queueIndex`), meaning both players will ultimately face the exact same questions in the exact same order.

**The Reasoning:**
- A shared queue ensures true competitive fairness. It becomes a race to correctly answer the identical set of questions rather than one player potentially getting easier or harder questions purely by random chance.
- Pre-generating the array prevents issues with card IDs or mismatched correct answer tracking.

**The Tech Debt:**
- Currently hardcoded to generate a queue of up to 100 cards (`dealHand(100)`). If players play faster than 100 cards within 5 minutes, they will hit the exhaustion condition. This should be safe for a 5 minute match.
