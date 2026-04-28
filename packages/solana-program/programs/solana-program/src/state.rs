use anchor_lang::prelude::*;
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