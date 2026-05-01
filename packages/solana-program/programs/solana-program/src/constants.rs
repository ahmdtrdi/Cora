
pub const MATCH_SEED: &[u8] = b"match";
pub const VAULT_SEED: &[u8] = b"vault";
pub const CONFIG_SEED: &[u8] = b"config";

pub const DEPOSIT_TIMEOUT: i64 = 15;      // 15 seconds to deposit
pub const MATCH_TIMEOUT: i64 = 600;       // 10 minutes for active match

pub const FEE_BASIS_POINTS: u64 = 250;          // 2.5% fee
pub const BASIS_POINTS_DIVISOR: u64 = 10_000;

/// Minimum wager to prevent dust amounts (fee rounds to 0) and spam.
/// 10,000 smallest units = 0.01 SOL (9 decimals) or 0.01 BONK (5 decimals).
pub const MIN_WAGER: u64 = 10_000;