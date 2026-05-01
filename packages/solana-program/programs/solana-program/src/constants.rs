
pub const MATCH_SEED: &[u8] = b"match";
pub const VAULT_SEED: &[u8] = b"vault";
pub const CONFIG_SEED: &[u8] = b"config";

pub const DEPOSIT_TIMEOUT: i64 = 15;      // 15 seconds to deposit
pub const MATCH_TIMEOUT: i64 = 600;       // 10 minutes for active match

pub const FEE_BASIS_POINTS: u64 = 250;
pub const BASIS_POINTS_DIVISOR: u64 = 10_000;