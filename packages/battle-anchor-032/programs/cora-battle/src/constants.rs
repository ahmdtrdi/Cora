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

/// Duration of one active round before timeout resolution is allowed
pub const ROUND_DURATION_SECONDS: i64 = 180;

/// Maximum damage a single card can deal (prevents one-shot exploits)
pub const MAX_DAMAGE: u16 = 100;

/// Minimum damage a single card can deal (prevents zero-damage griefing)
pub const MIN_DAMAGE: u16 = 1;

/// Session expires after 15 minutes (prevents stale sessions)
pub const SESSION_TIMEOUT: i64 = 900;

/// Current state schema version for forward-compatible upgrades
pub const CURRENT_VERSION: u8 = 1;

pub const END_REASON_NONE: u8 = 0;
pub const END_REASON_NORMAL_WIN: u8 = 1;
pub const END_REASON_SINGLE_PLAYER_TIMEOUT: u8 = 2;
pub const END_REASON_BOTH_PLAYERS_TIMEOUT: u8 = 3;
pub const END_REASON_SERVER_CANCELLED: u8 = 4;
pub const END_REASON_CHEATER_FLAGGED: u8 = 5;
pub const END_REASON_FORCE_ENDED: u8 = 6;
