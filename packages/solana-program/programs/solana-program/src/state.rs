use anchor_lang::prelude::*;

/// Global program configuration — initialized once by the deployer.
/// Stores admin authority and treasury authority for fee routing.
#[account]
pub struct ProgramConfig {
    /// Admin who can update this config (typically the deployer).
    pub admin: Pubkey,
    /// Authority that owns all treasury token accounts per arena.
    /// Settlement validates `treasury.authority == treasury_authority`.
    pub treasury_authority: Pubkey,
    /// PDA bump seed for deterministic derivation.
    pub bump: u8,
}

impl ProgramConfig {
    // 8 (discriminator) + 32 (admin) + 32 (treasury_authority) + 1 (bump) = 73
    pub const LEN: usize = 8 + 32 + 32 + 1;
}

/// Per-match escrow state — created by `initialize_match`, finalized by
/// `settle_match` or `refund`.
#[account]
pub struct MatchState {
    pub match_id: [u8; 32],
    pub player_a: Pubkey,
    pub player_b: Pubkey,
    pub token_mint: Pubkey,
    pub server_pubkey: Pubkey,
    pub wager_amount: u64,
    pub status: MatchStatus,
    pub bump: u8,
    pub created_at: i64,
    pub active_at: i64,
    pub player_a_deposited: bool,
    pub player_b_deposited: bool,
}

impl MatchState {
    // 8 (discriminator) + 32 + 32 + 32 + 32 + 32 + 8 + 1 + 1 + 8 + 8 + 1 + 1 = 196
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 32 + 8 + 1 + 1 + 8 + 8 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MatchStatus {
    WaitingDeposit,
    Active,
    Settled,
    Refunded,
}