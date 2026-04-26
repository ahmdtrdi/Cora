# FE Dev Log

## 2026-04-25 - Frontend stack setup verification and stabilization

### The Change
- Verified [package.json](/d:/projects/Cora/apps/web/package.json) includes the agreed non-optional frontend stack for Solana:
  - `next`, `react`, `react-dom`
  - `framer-motion`
  - `@solana/web3.js`
  - `@solana/wallet-adapter-base`
  - `@solana/wallet-adapter-react`
  - `@solana/wallet-adapter-react-ui`
  - `@solana/wallet-adapter-phantom`
  - `@coral-xyz/anchor`
  - `@tanstack/react-query`
- Confirmed the install avoids `@solana/wallet-adapter-wallets` to prevent the prior Windows install failure path.

### The Reasoning
- We aligned the web stack to Solana-first requirements (Phantom + Devnet flow) instead of EVM tooling.
- We used explicit wallet adapter packages (especially Phantom) for tighter dependency control and improved install reliability on Windows.

### The Tech Debt
- Wallet support is currently Phantom-focused; if multi-wallet support is needed later, we should add adapters incrementally and verify Windows compatibility package by package.
- We still need implementation wiring for `ConnectionProvider` + `WalletProvider` and environment-based RPC config for Devnet.

## 2026-04-26 - MatchSocket Hook & Shared Types

### The Change
- Created `packages/shared-types/src/websocket.ts` to define the "Contract" between Frontend and Backend based on the card/health game mechanics. Includes `GameState`, `PlayerState`, `Card`, and socket event types.
- Updated `apps/web/tsconfig.json` paths to map `@shared/*` to the local `shared-types` package folder.
- Built `useMatchSocket.ts` hook using the native `WebSocket` API.
- Created `scripts/mock-ws-server.js` to simulate the backend.

### The Reasoning
- Contract-First Development: Defining the payload interfaces before the backend is built forces alignment and unblocks the frontend.
- Native WebSocket: Opted for the browser's built-in `WebSocket` instead of Socket.io to keep the Next.js bundle light and ensure perfect compatibility with the backend's Bun/Hono stack.
- State vs Callbacks: The hook maintains the `GameState` internally and exposes it to the UI instead of using event callbacks, preventing stale closures in React.

### The Tech Debt
- The `tsconfig.json` path mapping is a temporary workaround. If the monorepo expands, we should set up proper NPM Workspaces / Turborepo.
- The `mock-ws-server.js` should be deleted once the real Hono backend is deployed to Devnet.
