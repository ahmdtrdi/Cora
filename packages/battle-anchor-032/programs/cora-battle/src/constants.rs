/// PDA seed for BattleSession accounts
pub const BATTLE_SEED: &[u8] = b"battle";

/// PDA seed for RegisteredCard accounts
pub const CARD_SEED: &[u8] = b"card";

/// Starting HP for each player at the beginning of a round
pub const INITIAL_HEALTH: u16 = 100;

/// Best-of-N rounds format
pub const MAX_ROUNDS: u8 = 3;

/// Rounds needed to win the match
pub const ROUNDS_TO_WIN: u8 = 2;

/// Maximum damage a single card can deal (prevents one-shot exploits)
pub const MAX_DAMAGE: u16 = 100;

/// Minimum damage a single card can deal (prevents zero-damage griefing)
pub const MIN_DAMAGE: u16 = 1;

/// Session expires after 15 minutes (prevents stale sessions)
pub const SESSION_TIMEOUT: i64 = 900;

/// Current state schema version for forward-compatible upgrades
pub const CURRENT_VERSION: u8 = 1;
