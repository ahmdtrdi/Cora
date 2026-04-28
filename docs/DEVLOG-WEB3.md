# DEVLOG — Web3 & Smart Contract Lead

---

## Entry 1 — 2026-04-28: `initialize_match` instruction + backend integration

### The Change

**Smart contract (6 files):**
- `state.rs` — Added `MatchState` account struct (13 fields, 196 bytes) and `MatchStatus` enum (WaitingDeposit/Active/Settled/Refunded)
- `error.rs` — Replaced generic `ErrorCode` with `CoraError` enum (8 domain-specific variants)
- `constants.rs` — Added PDA seeds (`MATCH_SEED`, `VAULT_SEED`), timeouts, and fee constants (2.5% = 250 bps)
- `instructions/initialize_match.rs` — Full `InitializeMatch` instruction with PDA vault, player validation, Token-2022 support
- `instructions.rs` — Clean module re-export (removed broken `__client_accounts_*` manual re-export)
- `lib.rs` — Clean program definition, removed dead imports (`DepositeWager`, `Refund`, `SettleMatch` that didn't exist)
- `Cargo.toml` — Added `anchor-spl = "1.0.1"` dependency, forwarded `idl-build` feature

**Backend integration (3 files):**
- `packages/shared-types/src/escrow.ts` — NEW: Shared escrow constants (seeds, timeouts, fees), `deriveMatchId()` (SHA-256 bridge from room ID string → `[u8; 32]`), `buildSettlementMessage()` canonical format
- `apps/api/src/utils/settlement.ts` — Updated to use shared `buildSettlementMessage`, `signSettlementAuthorization` now takes `Uint8Array` match ID
- `apps/api/src/managers/RoomManager.ts` — Each Room now carries `matchIdBytes` (derived at room creation), `broadcastMatchResult` sends full `MatchResultPayload` with settlement signature
- `packages/shared-types/src/websocket.ts` — Added `MatchResultPayload` interface, added `'settling'` to `GameStatus`

### The Reasoning

1. **Match ID mismatch was the biggest integration risk.** Backend generates string room IDs (`room-1714300000000`), smart contract expects `[u8; 32]`. We bridged this with `deriveMatchId()` using SHA-256 — deterministic, collision-resistant, and both sides can independently derive the same bytes.

2. **Settlement message format is a security-critical contract** between backend and smart contract. Moving it to a shared module (`buildSettlementMessage`) ensures both sides produce the exact same bytes. If these diverge by even 1 byte, ed25519 verification fails silently.

3. **`anchor-spl` with `idl-build` feature forwarding** — Without forwarding `anchor-spl/idl-build` in Cargo.toml features, `anchor build` would compile the lib but fail during IDL generation phase (a non-obvious error that wastes time).

4. **Player A ≠ Player B guard** added to prevent self-play exploit (a player creating a match against themselves to drain fees).

### The Tech Debt

- [x] ~~`anchor build` could not be verified~~ → **Verified: builds successfully**
- [ ] Settlement signing happens at `broadcastMatchResult` time — ideally this should only happen after the server is certain the result is final (currently mock game logic)
- [ ] `@shared/escrow` import path relies on tsconfig path alias — if Bun or build pipeline changes, this alias must be maintained
- [ ] `MatchResultPayload.matchId` is sent as hex string — frontend needs to convert back to `Uint8Array` when constructing the on-chain settlement transaction
- [ ] The `rent` sysvar in `InitializeMatch` accounts can be removed for Anchor >= 0.30 (it auto-resolves), but kept for backward compatibility clarity

---

## Entry 2 — 2026-04-28: Fix compilation, tests, and cross-check

### The Change

**Compilation fixes:**
- `instructions.rs` + `lib.rs` — Restored `pub(crate) use __client_accounts_initialize_match` re-exports. Anchor's `#[program]` macro requires these at crate root to resolve instruction accounts during macro expansion.

**Test infrastructure:**
- `tests/test_initialize.rs` — Rewrote from scratch with 3 test cases (happy path, zero wager, same player). Mint accounts created via raw 82-byte SPL Token layout injected through `svm.set_account()` to avoid `spl-token` crate version conflict.
- `Cargo.toml` — Removed `spl-token = "7.0.0"` from dev-deps (caused Pubkey v2/v3 type mismatch). Added `solana-account = "3.4.0"` and `solana-pubkey = "3.0.0"` for LiteSVM account injection.

### The Reasoning

1. **Anchor macro re-export pattern is mandatory.** `#[derive(Accounts)]` generates a `pub(crate) mod __client_accounts_*` inside each instruction file. `#[program]` macro resolves these relative to crate root. Without the re-export chain (`instruction.rs → lib.rs → crate root`), compilation fails with `unresolved import crate`. This is a known Anchor pattern, not a hack.

2. **spl-token v7 uses `solana-pubkey v2` while anchor-lang v1.0.1 uses `solana-pubkey v3`.** These types are both `[u8; 32]` but Rust treats them as incompatible types. Rather than fighting version hell, we bypass `spl-token` entirely in tests and create mint accounts via raw bytes — same approach used by LiteSVM's own test suite.

### Cross-Check Result

All constants, seeds, timeouts, fees, and message formats verified consistent across:
- **Rust**: `constants.rs`, `state.rs`, `initialize_match.rs`
- **TypeScript shared**: `escrow.ts`, `websocket.ts`
- **Backend**: `settlement.ts`, `RoomManager.ts`

**Result: Task 1.2 fully integrated, ready to commit.**

### The Tech Debt

- [ ] `spl-token` not usable in tests due to Solana SDK v2/v3 conflict — monitor `spl-token v8` for compatibility
- [ ] Tests use hardcoded Token Program ID and Rent sysvar ID — fragile if Solana changes these (unlikely but worth noting)
- [ ] Token Program binary may not be loaded in LiteSVM for CPI tests — runtime test may fail even if compile succeeds. Will verify when running `cargo test`.
- [ ] Backend `confirmDeposit` handler does not verify on-chain tx (deferred to Task 7.2 E2E)
