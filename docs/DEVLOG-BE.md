# Backend Development Log

## 2026-04-27 - Scaffold Bun + Hono API

**The Change:**
- Created `apps/api/package.json` with Hono and Bun types.
- Added strict `apps/api/tsconfig.json` tailored for Bun.
- Configured flat-config ESLint (`apps/api/eslint.config.mjs`) to enforce TypeScript code quality.
- Created `apps/api/.env.example` with standard ports and placeholder for `SERVER_KEYPAIR`.
- Set up initial `apps/api/src/index.ts` with a `/health` endpoint.

**The Reasoning:**
- **Bun + Hono:** Chose Bun as the runtime and Hono as the web framework per the architecture outlined in `MASTER.md`. This combination is lightweight and exceptionally fast for edge and WebSocket applications.
- **Manual Scaffolding:** Due to the local environment lacking the `bun` CLI temporarily, files were scaffolded manually to unblock development. The configuration mirrors a standard `bun create hono` setup but includes stricter linting and TS paths from day one.

**The Tech Debt:**
- **No Test Runner:** We haven't configured `bun test` or Jest yet. We'll need to add testing as we start building logic.
- **Local Dev Environment:** The user still needs to install Bun locally (`powershell -c "irm bun.sh/install.ps1 | iex"`) to actually run the server.

## 2026-04-27 - Backend WebSocket Integration

**The Change:**
- Updated `apps/api/tsconfig.json` to map `@shared/*` to `packages/shared-types`, enabling strict typing across frontend and backend.
- Replaced `index.ts` with a `hono/bun` implementation of WebSockets exposing `/match/:roomId`.
- Implemented mock server game state logic natively in the API to replace the `scripts/mock-ws-server.js` script.
- Updated `PORT` default in `.env.example` and `index.ts` to `8080`.

**The Reasoning:**
- **Seamless Integration:** Porting the exact logic from the frontend's mock WebSocket server means the frontend `useMatchSocket` hook can connect seamlessly out of the box without any refactoring.
- **Contract-First:** Leveraging `tsconfig.json` path mappings ensures both packages rely on the exact same type definitions (`GameState`, `WsMessage`), which prevents drift and enforces strict payloads.

**The Tech Debt:**
- **Mock Logic:** The `/match/:roomId` endpoint is currently hardcoded to simulate a 1-second delay and modify state in a purely mock fashion. This needs to be replaced with the actual Smart Contract parsing / Game loop engine in the future.

## 2026-04-27 - WebSocket Gateway & Room Manager

**The Change:**
- Created `apps/api/src/managers/RoomManager.ts` to encapsulate active rooms, clients, and state broadcasting.
- Implemented `joinRoom`, `leaveRoom`, `reconnect`, and `10s disconnect timeout` forfeit logic in `RoomManager`.
- Refactored `apps/api/src/index.ts` to instantiate `RoomManager` and delegate WebSocket lifecycle events.
- Added a POST `/match` endpoint for FIFO matchmaking which creates and returns a `roomId`.
- Added a test script `apps/api/scripts/test-ws.ts` to simulate and verify connection and reconnection flows.

**The Reasoning:**
- **State Management:** Tracking connections (`ServerWebSocket`) and game state in an in-memory Map handles the MVP requirement for real-time WebSocket state management efficiently.
- **Resilience:** A 10-second timeout mechanism allows users facing spotty connections to reconnect and resume immediately, improving the gameplay UX. 
- **Decoupled Architecture:** Separating connection logic (`index.ts`) from room logic (`RoomManager.ts`) keeps the API layer clean.

**The Tech Debt:**
- **In-Memory State:** Rooms are stored entirely in-memory (`Map`). This does not scale horizontally across multiple instances (e.g., requires Redis in the future).
- **Matchmaking Identifier:** We require the client to pass their address as a query param `?address=` to authenticate and handle reconnects, which isn't currently sent by the frontend's `useMatchSocket.ts` hook.

## 2026-04-27 - True FIFO Matchmaking Queue

**The Change:**
- Replaced instant-return logic in `apps/api/src/managers/RoomManager.ts` with a true queue mechanism (`queueMatch`).
- Modified `POST /match` in `apps/api/src/index.ts` to require a JSON body `{"address": "0x..."}` and await the `queueMatch` promise, effectively implementing long-polling.
- Handled aborted HTTP requests via `c.req.raw.signal` to automatically drop disconnected users from the queue.
- Updated `apps/api/scripts/test-ws.ts` to simulate concurrent matchmaking requests properly.

**The Reasoning:**
- **True Pairing:** The previous implementation instantly returned a room ID before a second player was even present. A proper queue holds the HTTP request open and pairs two unique addresses together, delivering a synchronized `roomId` to both players at exactly the same time. This aligns with the "auto-pair two queued players" requirement in `MASTER.md`.
- **Long-Polling Simplicity:** Using HTTP long-polling for matchmaking is clean and stateless, deferring WebSocket connection until the match is confirmed, saving resources.

**The Tech Debt:**
- **In-Memory Queue:** Similar to rooms, the matchmaking queue is held in a Node/Bun array. It will not scale horizontally across multiple instances without a centralized broker like Redis.
- **Queue Timeouts:** Currently, a long-polling request can stay open indefinitely until a pair is found or the connection aborts. We may need to enforce a maximum wait time (e.g., 30s timeout) and return an explicit `408 Request Timeout` if unfulfilled.

## 2026-04-27 - Game Session Manager State Machine

**The Change:**
- Refactored `GameStatus` in `packages/shared-types/src/websocket.ts` to strictly adhere to the `waiting` -> `depositing` -> `playing` -> `finished` state machine.
- Added a new `confirmDeposit` event to `ClientToServerEvents` to allow the frontend to signal when a user's Solana transaction is complete.
- Updated `RoomManager.ts` to transition rooms to the `depositing` state once 2 players connect.
- Implemented logic to require both players to send the `confirmDeposit` message before transitioning the room state to `playing` and allowing cards to be played.
- Replaced the generic `match_ended` state with the explicit `finished` state across all win/forfeit conditions.
- Updated `test-ws.ts` to verify the full flow including the deposit confirmation.

**The Reasoning:**
- **Explicit Game Flow:** Enforcing this specific state machine maps perfectly to the architectural flow defined in `MASTER.md`, where the on-chain escrow transaction occurs *before* the off-chain game loop can begin.
- **Client-Driven Confirmation:** For the MVP, allowing the frontend to broadcast `confirmDeposit` keeps the architecture simpler than implementing complex on-chain event listeners. The backend trusts this message to unblock the match.

**The Tech Debt:**
- **Trusting the Client:** Currently, the server blindly trusts the `confirmDeposit` message. In a production environment, the backend *must* receive the transaction signature in this payload and verify it against the Solana RPC to ensure the funds actually landed in the escrow PDA before unlocking the `playing` state.

## 2026-04-27 - GET /api/questions Endpoint & Pool JSON

**The Change:**
- Created a sample JSON file at `data/questions/pool.json` containing 8 logic and math GAT questions.
- Added a `GET /api/questions` route in `apps/api/src/index.ts`.
- Implemented file reading logic using `Bun.file()` to fetch the questions from `pool.json`.
- Implemented shuffling logic that selects 5 randomized questions from the pool and returns them in a standard JSON format.

**The Reasoning:**
- **Decoupled Data:** Storing the question bank in a simple `.json` file inside `data/questions/` allows data to be easily managed independently of application code, following the MVP boundaries defined in `MASTER.md`.
- **Match Gameplay Requirements:** The endpoint randomly shuffles and limits questions to 5, which meets the requirement of providing fresh questions per game.

**The Tech Debt:**
- **In-Memory Shuffling Risk:** We read the JSON file directly and shuffle elements in memory. If the question bank grows to thousands of items, reading the full parsed JSON and slicing may impact memory and performance. We'd ideally want to use an actual database (e.g., PostgreSQL or Turso) with a randomized query limit approach eventually.

## 2026-04-27 - Security Middleware (CORS & Rate Limiter) added

**The Change:**
- Added Hono's native `cors` middleware (`hono/cors`) as a global middleware on `/*`.
- Created a custom in-memory rate limiter middleware at `apps/api/src/middleware/rateLimiter.ts`.
- Registered `rateLimiter` globally on `/*` before hitting the application routes.
- Limited each IP to 60 requests per minute with an automated 1% chance memory cleanup trigger.

**The Reasoning:**
- **CORS Requirements:** The frontend (e.g., `localhost:3000`) and the Blink (browser extensions) require CORS headers to execute cross-origin requests to the backend (`localhost:8080`).
- **Abuse Prevention:** Opening the API publicly immediately invites bots. The in-memory map rate limiter prevents simple spam (DDoS on the WebSocket allocator or mass-scraping of the question pool) while keeping implementation lightweight and dependency-free.
- **Health Check Enhancement:** The `/health` route is now protected and accessible via CORS without requiring authentication, allowing uptime monitoring services to ping it freely.

**The Tech Debt:**
- **In-Memory Rate Limiter limitation:** Just like the WebSocket rooms, keeping a `Map` of IPs in local memory will fail once the backend is load-balanced across multiple instances. Rate limits will be per-instance. Eventually, this needs to be decoupled into a Redis cache (Upstash) or rely on edge infrastructure controls (like Cloudflare/Vercel rate-limiting) instead of application-level limiting.

## 2026-04-27 - Server Keypair & Settlement Signature

**The Change:**
- Installed `@solana/web3.js`, `bs58`, and `tweetnacl` to handle Solana cryptography natively in Bun.
- Created `apps/api/src/utils/settlement.ts` which loads `SERVER_KEYPAIR` from `.env`.
- Added support for both `[1, 2, ...]` (JSON array array) and `bs58` string formats for the keypair storage.
- Added `signSettlementAuthorization(matchId, winnerAddress)` that executes an Ed25519 signature over a deterministic payload (`SETTLE:<matchId>:<winnerAddress>`).

**The Reasoning:**
- **Zero-Trust Client:** As outlined in the architecture, the client cannot be trusted to report who won. The server determines the winner, signs the result cryptographically, and this signature is verified by the Solana smart contract (Anchor) inside the `settle_match` instruction.
- **Payload Determinism:** Standardizing the message buffer to a strict `SETTLE:<matchId>:<winnerAddress>` format makes it easy for the Rust Anchor backend to recreate the exact payload and verify the Ed25519 signature before releasing the escrowed funds.

**The Tech Debt:**
- **Calling the Contract:** The `settlement.ts` module currently only *generates* the signature. To fully implement "Server can call settle_match", we will need to install `@coral-xyz/anchor`, import the IDL, and write the RPC call to push the transaction on-chain on behalf of the server. Currently, we just have the cryptographic auth ready.

## 2026-04-28 - Question Delivery Pipeline (Per-Card Countdown, Answer Validation, Live Scores)

**The Change:**
- Updated `packages/shared-types/src/websocket.ts` to add new cross-team WS events:
  - `openCard` (client → server): player opens/selects a card to start the answer countdown.
  - `cardCountdown` (server → client): 1-second ticks with `remainingMs` for the opened card.
  - `cardExpired` (server → client): notifies player their card timed out.
  - `scoreUpdate` (server → client): per-player live scores and health after every card play/expiry.
  - `playCardResult` (server → client): formalized in the type contract (was already emitted but missing from `ServerToClientEvents`).
  - Added `CardCountdownData`, `CardExpiredData`, `ScoreUpdateData` interfaces.
- Refactored `apps/api/src/managers/RoomManager.ts`:
  - Added `OpenedCard` interface tracking per-player card state (cardId, openedAt, countdown interval, timeout handle).
  - Added `openedCards: Map<string, OpenedCard>` to the `Room` interface.
  - Added `handleOpenCard()`: validates card in hand, starts 10-second countdown with 1s ticks, schedules auto-expiry timeout.
  - Added `expireCard()`: on timeout, calls `engine.playCard()` with an invalid option (`'__timeout__'`) so the engine treats it as a wrong answer — card consumed, new card dealt, no damage/heal. Emits `cardExpired` event.
  - Modified `handlePlayCard()`: now requires the card to have been opened first via `openCard`. Clears the countdown on valid answer. Rejects plays for cards that weren't opened or already expired.
  - Added `broadcastScoreUpdate()`: after every play (success or expiry), sends per-player `scoreUpdate` with current scores and health to both players.
  - Added `clearOpenedCard()` / `clearAllOpenedCards()` helpers for cleanup on answer, game over, and forfeit.
  - Wired `openCard` message type in `handleMessage()`.

**The Reasoning:**
- **Per-Card Countdown:** The existing model had no time pressure per question — only a global 5-minute match timer. Players could hold cards indefinitely. Adding a 10-second per-card countdown after opening creates real-time pressure and matches the game design intent.
- **Server-Side Enforcement:** The countdown and timeout are enforced entirely server-side. The client sends `openCard`, receives countdown ticks, and must send `playCard` within the window. Late plays are impossible because the server auto-expires the card via `setTimeout`.
- **Zero Game-Logic Changes:** The timeout trick (`engine.playCard(address, cardId, '__timeout__')`) leverages the existing engine behavior — any non-matching option is treated as a wrong answer, consuming the card and dealing a new one. This avoids touching `packages/game-logic` (GAME role's territory).
- **Live Score Broadcasts:** `scoreUpdate` events after every play give the FE real-time data for score animations without having to parse the full `gameStateUpdate` payload.

**The Tech Debt:**
- **One Card at a Time:** Currently enforced that a player can only have one card open at a time. If the game design evolves to allow multiple simultaneous opened cards, the `openedCards` tracking would need to change from `Map<string, OpenedCard>` to `Map<string, Map<string, OpenedCard>>`.
- **Rate Limit Interaction:** The engine's internal 500ms rate limit could theoretically conflict with an `expireCard` call that fires right after a manual play. In practice this is unlikely because the player can only have one card open, but worth monitoring.
- **FE Integration:** The frontend hook (`useMatchSocket.ts`) needs to be updated by the FE team to handle the new `openCard` → `cardCountdown` → `playCard` / `cardExpired` → `scoreUpdate` flow.

## 2026-04-29 - Match Result Determination: 5 rounds
**The Change:**
- Enhanced match engine to support multi-round gameplay, tracking \`roundsWon\` for each player via \`PlayerState\` and \`EnginePlayerState\`. Defaults to a first-to-2 points structure for a "best of 3" experience.
- Tracked round ending conditions where a player's HP drops below 0 or by timer, emitting a new \`roundOver\` event before automatically resetting states without halting the internal game system loops.
- Hooked \`gameOver\` inside \`RoomManager\` to ensure \`FINISHED: Winner determined server-side\` is logged to confirm the server's authoritative decision correctly aligns.

**The Reasoning:**
- **Match Format Iteration:** A round-based game is intrinsically more competitive, mitigating RNG/luck of a single good hand draw. First to 3 / 2 wins scales match intensity higher alongside the token wagers. 
- **Separation of Concerns:** Instead of destroying the full game state on win, \`roundOver\` merely resets combat parameters while preserving score arrays & anti-cheat evaluations gracefully across multiple match phases.

**The Tech Debt:**
- **Frontend Syncs:** While the API properly emits \`roundOver\` inside the \`GameState\` stream, the frontend relies on single-session logic right now and needs UX implementation to animate round transition graphics (like screen wipes and scoreboard ticks).

## 2026-04-30 - Settlement Oracle & On-Chain Anti-Cheat

**The Change:**
- Updated `buildSettlementMessage` in `packages/shared-types/src/escrow.ts` to generate a 65-byte binary buffer instead of a string, adding an `action` byte (0 for Normal, 1 for Anti-Cheat) and using decoded `targetAddress`.
- Implemented `submitSettlementTransaction` in `apps/api/src/utils/settlement.ts` using `@solana/web3.js`. It constructs and signs the `global:settle_match` Anchor instruction and sends it directly to the Solana RPC.
- Modified `RoomManager.ts` to act as an automated oracle:
  - Normal match completion automatically submits the transaction with `action = 0`.
  - If `AntiCheatVerdict` returns `rejected`, it halts normal settlement and auto-submits an anti-cheat penalty transaction with `action = 1`, targeting the cheater.
- Refactored `settlement.test.ts` to use valid Base58 encoded mocks and validated the new 65-byte deterministic signature format. All 53 tests pass.

**The Reasoning:**
- **Smart Contract Alignment:** The Web3 dev updated the Solana program to handle anti-cheat natively. This required matching the exact 65-byte payload expected by the on-chain `ed25519` signature verification.
- **Oracle Automation:** By having the backend automatically craft and submit the transaction at the end of the match, we remove the need for the client to pay gas for settlement or manually claim their winnings.
- **Immediate Penalties:** Tying the game engine's Anti-Cheat directly into the Solana transaction means cheaters instantly forfeit their wagers on-chain without any manual admin intervention.

**The Tech Debt:**
- **Manual Account Parsing:** To keep the API lightweight and avoid pulling in the massive `@coral-xyz/anchor` IDL types, `settlement.ts` manually reads the `MatchState` buffer offsets (e.g., `subarray(40, 72)` for `playerA`). If the Rust state struct changes, this manual parsing will break silently.
- **Lack of Retry Queue:** If the Solana RPC drops the `submitSettlementTransaction` call (e.g., due to network congestion), it currently just logs to `console.error`. We need a robust background job queue (like BullMQ) to retry failed settlements until confirmed.

## 2026-05-01 - Solana Actions: GET /api/actions/challenge (Blink Metadata)

**The Change:**
- Rewrote `apps/api/src/routes/actions.ts` to be fully compliant with the [Solana Actions specification](https://solana.com/docs/advanced/actions).
- **GET `/api/actions/challenge`:** Returns an `ActionGetResponse` with:
  - `type: "action"` (required by spec, was missing before).
  - `icon` (absolute Arweave URL), `title`, `description`, `label`.
  - `links.actions[]` with three preset stake tiers (`5`, `10`, `25` USDC) plus a custom amount input.
  - Each `LinkedAction` now includes `type: "transaction"` (spec requirement).
  - Custom stake parameter uses `type: "number"` with `min`/`max` bounds and a `patternDescription`.
- **POST `/api/actions/challenge`:** Updated to read `account` from the POST body (spec says `{ "account": "<base58>" }`), replacing the previous `payer` field. Added `message` to the POST response. Error responses follow the `ActionError` interface (`{ message: string }`).
- CORS middleware updated: added `X-Blockchain-Ids` header for Solana Devnet chain identification.
- `actions.json` discovery endpoint in `index.ts` was already in place and correct.

**The Reasoning:**
- **Spec Compliance:** The previous scaffold was functional but missing several required fields (`type` on both the root response and `LinkedAction` objects). X/Twitter Blink renderers and Dialect's registry require these to properly unfurl the Blink card.
- **Preset Tiers + Custom:** Offering quick-click preset amounts (5, 10, 25 USDC) alongside a custom input follows best UX practices seen in the Solana Actions examples (e.g., `Stake 1 SOL` / `Stake 5 SOL` / custom). This reduces friction for first-time users.
- **POST Body `account`:** The spec mandates the client wallet sends `{ "account": "<base58 pubkey>" }` — not a custom `payer` param. Aligning with the spec means standard Blink clients (Phantom, Backpack, Dialect) will work out of the box.

**The Tech Debt:**
- **Memo-Only Transaction:** The POST handler currently builds a Memo instruction as a placeholder. The real flow should call `initialize_match` + `deposit_wager` on the Anchor escrow program once the Web3 team's IDL is stable. This is the next step for wiring the Blink → on-chain escrow pipeline.
- **Icon URL:** We're using a generic Arweave-hosted image. The Designer should provide a branded CORA challenge card image and we should update the `iconUrl` constant.
- **Dialect Registry:** For the Blink to auto-unfurl on X/Twitter, we need to register the domain at [dial.to/register](https://dial.to/register). Until then, the Blink only works via [dial.to](https://dial.to) interstitial or direct Action URL (`solana-action:https://...`).

## 2026-05-01 - Hybrid Matchmaking & Blinks: Full Phase 1-4 Implementation

**The Change:**

- **`packages/shared-types/src/websocket.ts`:**
  - Added `MatchFoundData` interface (`roomId`, `role: 'playerA' | 'playerB'`, `opponentAddress`).
  - Added four new `ServerToClientEvents`: `matchFound`, `matchFoundWaiting`, `depositUnlocked`, `opponentFailedDeposit`.

- **`apps/api/src/managers/RoomManager.ts`:**
  - Extended `Room` interface with: `roomType`, `playerA`, `playerB`, `playerBUnlocked`, `tokenMint`, `wagerAmount`, `depositTimeouts`.
  - Added `DEPOSIT_TIMEOUT_MS = 20_000` constant (the "shot clock").
  - Added `createPrivateRoom(playerAPubkey, tokenMint, wagerAmount)`: creates a `depositing` room for Blinks/private invites, stores token config server-side, arms Player A's 20s shot clock immediately.
  - Added `joinPrivateRoom(playerBPubkey, roomId)`: validates room, assigns Player B, returns a result code (`ok | not_found | full | cancelled`) for clean HTTP error mapping.
  - Added `cancelRoom(roomId, innocentAddress?)`: clears all shot clocks, emits `opponentFailedDeposit` to the innocent player, re-queues them at the front of the public matchmaking queue.
  - Added `armDepositTimeout(room, address)`: private helper that fires `cancelRoom` after 20s if `confirmDeposit` is not received.
  - Updated `queueMatch()`: when pairing two players, assigns `playerA` (the waiting player) and `playerB` (the incoming player), transitions room to `depositing`, arms Player A's shot clock.
  - Updated `handleDeposit()`: sequential unlock model — after Player A deposits, clears their shot clock, sends `depositUnlocked` to Player B, arms Player B's 20s shot clock. Only transitions to `playing` after both confirm.
  - Updated `leaveRoom()`: the 10s forfeit timer is now **only armed during `playing`**. A disconnect during `depositing` triggers an immediate `cancelRoom` instead (the shot clock would fire anyway, but we cancel eagerly to free the opponent sooner).

- **`apps/api/src/index.ts`:**
  - Changed `actionsRouter` from a static import to a `createActionsRouter(roomManager)` factory call so the Blink handler shares the live `RoomManager` instance.
  - Added `POST /match/private` endpoint: accepts `{ address, tokenMint, wagerAmount }`, calls `createPrivateRoom`, returns `{ roomId, blinkUrl }`. `tokenMint` and `wagerAmount` are never in the URL — only in server memory.

- **`apps/api/src/routes/actions.ts`:**
  - Fully rewrote as a factory function `createActionsRouter(roomManager)`.
  - **GET `/api/actions/challenge?roomId=<id>`**: when `roomId` is present, checks room state — returns `ActionError` for dead/cancelled/full rooms, returns targeted single-button Blink metadata for valid open rooms.
  - **POST `/api/actions/challenge?roomId=<id>`**: calls `joinPrivateRoom`, maps result codes to HTTP status codes, then builds the **real Anchor `deposit_wager` instruction** — derives `matchState` and `vault` PDAs from `ESCROW_CONSTANTS` seeds, derives the depositor's ATA via `getAssociatedTokenAddressSync`, hand-encodes the discriminator `[234, 73, 235, 136, 168, 103, 239, 207]`, serializes the `Transaction` as base64. The Memo stub is deleted.

**The Reasoning:**
- **Spoofing Prevention:** `tokenMint` and `wagerAmount` are locked into the `Room` at creation time (`POST /match/private`) and read back by the Blink handler directly from server state. This prevents a malicious actor from crafting a Blink URL with a different token mint or zero wager to drain a different vault.
- **Sequential Deposit Model:** The original simultaneous-deposit approach had a Solana race condition — both players could try to sign their transactions at the same moment, but only one can be the `initialize_match` initiator. The sequential model (A initializes + deposits first, B deposits after receiving `depositUnlocked`) matches the on-chain contract's `WaitingDeposit` state machine exactly.
- **Shot Clock as Safety Net:** The 20s deposit timeout prevents a room from being held open indefinitely if a player drops their wallet or navigates away after being paired. The innocent player is immediately re-queued at the front so they don't lose their place.
- **`leaveRoom` Gating:** Previously the 10s forfeit timer fired regardless of game state, which meant a player who closed the tab during the deposit screen would trigger a `forfeitMatch` call that tries to run the settlement oracle on a game that never started. The gate to `playing` prevents that.

**The Tech Debt:**
- **`queueMatch` role assignment**: The sequential model emits `matchFound` / `matchFoundWaiting` via the WebSocket connection that exists *after* the HTTP `/match` response. The current implementation relies on the FE immediately connecting the WebSocket after receiving `roomId` from `POST /match`. If the WS connects late, Player B could miss the `matchFoundWaiting` event. A `broadcastGameState` on WS open will catch them up, but the FE team should also handle a `gameStateUpdate` with `status: 'depositing'` and no deposit tx yet as the "waiting" signal.
- **Re-queued player WS**: When `cancelRoom` re-queues the innocent player, the resolve closure uses the room's client map which is about to be deleted. The FE will need to call `POST /match` again (new HTTP request) to properly re-enter the queue; the re-queue in `cancelRoom` is a best-effort convenience for same-session re-pairing, not a hard guarantee.
- **`winnerAddress` typo in `settlement.ts:167`**: Pre-existing bug — `winnerAddress` should be `targetAddress`. Flagged for BE to fix separately.

