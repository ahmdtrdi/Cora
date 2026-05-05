use anchor_lang::prelude::*;

#[account]
pub struct BattleSession {
    pub match_id: [u8; 32],
    pub player_a: Pubkey,
    pub player_b: Pubkey,
    pub health_a: u16,          // starts at 100
    pub health_b: u16,
    pub score_a: u16,
    pub score_b: u16,
    pub current_round: u8,      // 1-3
    pub rounds_won_a: u8,
    pub rounds_won_b: u8,
    pub status: BattleStatus,
    pub winner: Pubkey,         // Pubkey::default() until finished
    pub question_hash: [u8; 32], // hash of question set for fairness proof
    pub bump: u8,
    pub created_at: i64,
}

impl BattleSession {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 2 + 2 + 2 + 2 + 1 + 1 + 1 + 1 + 32 + 32 + 1 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum BattleStatus {
    Active,
    Finished,
}

/// Pendaftaran kartu oleh Backend untuk match ini
#[account]
pub struct RegisteredCard {
    pub session: Pubkey,
    pub card_id: [u8; 16],      // Dummy ID: "Card_Alpha"
    pub correct_hash: [u8; 32], // Hash jawaban benar
    pub damage: u16,
    pub bump: u8,
}

impl RegisteredCard {
    pub const LEN: usize = 8 + 32 + 16 + 32 + 2 + 1;
}
