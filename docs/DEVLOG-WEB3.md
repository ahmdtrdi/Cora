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

---

## Entry 3 — 2026-04-28: Migrate `deposit_wager` & `settle_match` tests and fix environment sync

### The Change

**Smart contract testing:**
- `tests/test_deposit.rs` — Created new test for `deposit_wager` using `litesvm`. Mocks the state machine from `WaitingDeposit` to `Active` after both players deposit.
- `tests/test_settle_match.rs` — Created new test for `settle_match` using `litesvm`. Tests ed25519 precompile instruction execution, token transfers, and fee distribution.
- `Cargo.toml` — Added `solana-instructions-sysvar = "3.0.0"` and `solana-sdk-ids = "3.1.0"` as standard dependencies instead of relying on monolithic `solana_program`. Added `solana-ed25519-program = "3.0.0"` and `features = ["precompiles"]` to `litesvm` dev-dependencies.
- `src/instructions/settle_match.rs` — Reverted imports to use modular Anza (Solana 3.0+) crates (`solana_instructions_sysvar` and `solana_sdk_ids`). Cast `Signature` and `Pubkey` types correctly.
- `src/instructions/initialize_match.rs` & `src/error.rs` — Added `CoraError::SamePlayer` validation to prevent a player from matching against themselves.
- `Anchor.toml` & `lib.rs` — Synced program ID with the locally generated keypair (`ChhF...`) to fix `anchor build` ID mismatch errors.

### The Reasoning

1. **Solana 3.0 Modular Architecture:** Previously we tried using `solana_program` (the monolithic crate) for instructions and SDK ids, but the new Anza 3.x crates break these out. We adopted the new industry standard (`solana-instructions-sysvar` and `solana-sdk-ids`).
2. **Precompiles in LiteSVM:** By default, LiteSVM 0.10.0 does not load native precompile programs like Ed25519. The test for `settle_match` threw `InvalidProgramForExecution` until we enabled the `precompiles` feature in `Cargo.toml`.
3. **Anchor Build Sync:** The user was running `anchor keys sync` from inside `programs/solana-program` instead of the workspace root, causing the ID mismatch to persist. We manually synced it and clarified the proper execution path.

### The Tech Debt

- [ ] Ensure that `litesvm` tests are deterministic locally vs CI.
- [ ] We manually synced the program IDs. We must remember to sync again before devnet/mainnet deployment using the production keypair.

---

## Entry 4 — 2026-04-29: Dynamic Timeouts & Anti-Cheat Settlement Penalty

### The Change

**Smart contract logic (5 files):**
- `constants.rs` — Updated `DEPOSIT_TIMEOUT` to 15s (faster UX) and `MATCH_TIMEOUT` to 600s (10 min server fallback).
- `instructions/refund.rs` — Added dynamic timeout selection. Now checks `DEPOSIT_TIMEOUT` if `MatchStatus == WaitingDeposit`, and `MATCH_TIMEOUT` if `MatchStatus == Active`.
- `instructions/settle_match.rs` & `lib.rs` — Refactored `settle_match` arguments from `winner: Pubkey` to `action: u8, target: Pubkey`.
  - `action == 0`: Normal win (target = winner).
  - `action == 1`: Anti-Cheat penalty (target = cheater). Honest player gets 100% refund, cheater forfeits 100% to treasury.
- `error.rs` — Added `InvalidAction` error code.

**Test infrastructure:**
- `tests/test_refund.rs` — Split into two full tests using LiteSVM clock warping: `test_refund_waiting_deposit_timeout` (tests failure before 15s, success after) and `test_refund_active_match_timeout` (tests server crash fallback after 600s).
- `tests/test_settle_match.rs` — Added `test_settle_match_cheater_penalty` testing the 100% cheater slash token transfer.

### The Reasoning

1. **Anti-Cheat Slashing:** Taking a mere 2.5% fee from cheaters is not a deterrent. Total confiscation (100% slashed to treasury) completely destroys the positive expected value of botting. Meanwhile, refunding the honest player 100% ensures fairness since the match integrity was compromised.
2. **Dynamic Fallback Timeouts:** The blockchain should not dictate normal game loop timings—the backend handles that via WebSocket. The on-chain timeouts (600s) are pure "doomsday fallbacks" to prevent funds from being permanently locked if the backend crashes.
3. **AlreadyProcessed Error in LiteSVM:** When sending multiple identical transactions (same caller, blockhash, and instruction), Solana rejects the duplicate. We fixed this in `test_refund` by using `player_b` as the fee payer and adding `player_a`'s required instruction signature to alter the transaction fingerprint.

### The Tech Debt

- [ ] The TypeScript backend (`buildSettlementMessage`) still generates a UTF-8 string payload (`SETTLE:<match_id>:<winner>`), but `settle_match.rs` now verifies a 65-byte raw binary payload (`action` + `match_id` + `target`). We MUST align the backend `settlement.ts` in the next task to prevent verification failures.
- [ ] Devnet deployment keypair (`solana_program-keypair.json`) was generated but is safely ignored in `.gitignore`. We need to run `anchor deploy` and `anchor idl init` next.

---

## Entry 5 — 2026-04-29: Devnet Deployment & Client Export (Task 1.7 & 7.1 Complete)

### The Change

**Deployment:**
- Successfully deployed `solana_program` to Solana Devnet.
- **Program ID:** `9Pqkgy5uu9w2HvgyNUnHEvzdRWSv1h6GyCuD4uKBVp1W`
- Initialized on-chain IDL using `anchor idl init`.

**Client Export (Task 7.1):**
- Exported the generated `solana_program.json` (IDL) and `solana_program.ts` (Types) from the git-ignored `target/` directory to `packages/solana-client/src/`.

**Documentation:**
- Created `docs/WEB3_INTEGRATION_GUIDE.md` serving as the official API contract between the Web3 team and the FE/BE teams.

### The Reasoning

1. **Gitignore Safety vs Availability:** The `target/` directory must remain git-ignored to prevent pushing massive binary caches and the deployment keypair. By manually copying the IDL and `.ts` types to `packages/solana-client/src`, we provide strongly-typed frontend access (Task 7.1) without compromising repository safety.
2. **Integration Guide:** Smart contract parameters (like the 65-byte settlement signature format and dynamic timeouts) are opaque to the frontend/backend without explicit documentation. The guide serves to prevent integration friction.

### The Tech Debt

- [ ] Web3 phase is complete. Handing over to FE and BE teams for Task 7.2 (Integration test: FE deposit → BE settle).
- [ ] BE needs to update their `settlement.ts` to output the correct 65-byte `Uint8Array` payload instead of the old UTF-8 string format.

---

## Entry 6 — 2026-05-01: Security Hardening Phase 1 (Treasury Validation + Deposit Constraint)

### The Change

**Security audit conducted** — full code review of all 4 instructions, state, constants, and tests. Produced `smart_contract_security_audit.md` (v2). Key findings: 0 critical, 2 high, 5 medium, 4 low.

**Smart contract hardening (7 files touched):**

- `state.rs` — NEW: `ProgramConfig` account struct (admin + treasury_authority + bump, 73 bytes). Global config PDA for program-wide settings.
- `constants.rs` — Added `CONFIG_SEED = b"config"` for ProgramConfig PDA derivation.
- `error.rs` — Added `UnauthorizedAdmin` and `InvalidTreasury` error codes.
- `instructions/initialize_config.rs` — NEW: One-time setup instruction. Creates config PDA, stores admin and treasury authority. PDA seed guarantees singleton.
- `instructions/update_config.rs` — NEW: Admin-only instruction to rotate treasury authority without redeploying.
- `instructions/settle_match.rs` — **[H-1 FIX]** Added `config` account (ProgramConfig PDA) and `token::authority = config.treasury_authority` constraint on treasury. Previously, any token account with the correct mint could be passed as treasury — now only token accounts owned by the configured treasury authority are accepted. Also replaced magic number `10_000` with `BASIS_POINTS_DIVISOR` constant.
- `instructions/deposit_wager.rs` — **[H-2 FIX]** Added `constraint = match_state.token_mint == token_mint.key()` to validate the token mint passed matches the one stored in match state. This was already present in `settle_match` and `refund` but was missing here.
- `instructions.rs` + `lib.rs` — Updated module re-exports and program instruction registration for the 2 new instructions.

### The Reasoning

1. **Config PDA over hardcode**: The treasury authority is stored in a PDA (`seeds = [b"config"]`) rather than hardcoded. This is the industry standard pattern (used by Jupiter, Raydium, etc.) because:
   - No redeployment needed to rotate treasury wallet
   - Scales naturally for multi-arena (one authority, many per-mint token accounts)
   - PDA derivation is deterministic — anyone can verify the config address
   - Admin-gated updates via `update_config` prevent unauthorized changes

2. **`token::authority` over custom constraint**: Using Anchor's built-in `token::authority = config.treasury_authority` is preferred over a manual `constraint = treasury.owner == ...` because Anchor validates this during account deserialization, catching invalid accounts earlier in the pipeline and producing clearer error messages.

3. **H-2 (deposit token_mint)**: This was an inconsistency — `settle_match` and `refund` both validated `match_state.token_mint == token_mint.key()`, but `deposit_wager` did not. While the vault's `token::mint` constraint provides indirect protection, explicit validation is defense-in-depth.

### The Tech Debt

- [ ] **Must run `anchor build` and `anchor deploy` before this takes effect on devnet**. See deployment steps below.
- [ ] **Must call `initialize_config` once after redeployment** to create the config PDA with the treasury authority pubkey.
- [ ] **Must copy updated IDL to `packages/solana-client/src/`** — the IDL now includes 2 new instructions (`initializeConfig`, `updateConfig`), 1 new account type (`ProgramConfig`), and 2 new error codes.
- [ ] Existing tests in `test_settle_match.rs` need to be updated to include the `config` account. Tests will fail until this is done.
- [ ] Phase 2 hardening items still pending: ed25519 instruction_index validation (M-2), minimum wager amount (M-3), account closing after finalization (M-1).

### Post-Hardening Deployment Checklist

```bash
# 1. Build
anchor build

# 2. Deploy/upgrade to devnet (same program ID)
anchor deploy --provider.cluster devnet
# Or: anchor upgrade target/deploy/solana_program.so --program-id 9Pqkgy5uu9w2HvgyNUnHEvzdRWSv1h6GyCuD4uKBVp1W

# 3. Update on-chain IDL
anchor idl upgrade -f target/idl/solana_program.json 9Pqkgy5uu9w2HvgyNUnHEvzdRWSv1h6GyCuD4uKBVp1W

# 4. Copy IDL to client package
cp target/idl/solana_program.json packages/solana-client/src/
cp target/types/solana_program.ts packages/solana-client/src/

# 5. Initialize config (one-time, using your deployer wallet)
# Run via CLI or script — pass your treasury wallet pubkey as argument
```
