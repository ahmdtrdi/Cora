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
