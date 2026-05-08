use anchor_lang::prelude::*;

#[event]
pub struct SessionCreatedEvent {
    pub match_id: [u8; 32],
    pub authority: Pubkey,
    pub player_a: Pubkey,
    pub player_b: Pubkey,
    pub question_hash: [u8; 32],
}

#[event]
pub struct CardRegisteredEvent {
    pub match_id: [u8; 32],
    pub card_id: [u8; 16],
    pub damage: u16,
}

#[event]
pub struct SessionActivatedEvent {
    pub session: Pubkey,
    pub match_id: [u8; 32],
    pub current_round: u8,
    pub round_deadline: i64,
}

#[event]
pub struct DamageAppliedEvent {
    pub match_id: [u8; 32],
    pub attacker: Pubkey,
    pub damage: u16,
    pub health_a: u16,
    pub health_b: u16,
    pub round: u8,
}

#[event]
pub struct RoundEndedEvent {
    pub session: Pubkey,
    pub match_id: [u8; 32],
    pub round: u8,
    pub round_winner: Pubkey,
    pub rounds_won_a: u8,
    pub rounds_won_b: u8,
}

#[event]
pub struct RoundTimedOutEvent {
    pub session: Pubkey,
    pub match_id: [u8; 32],
    pub timed_out_player: Pubkey,
    pub round_winner: Pubkey,
    pub current_round: u8,
    pub score_a: u16,
    pub score_b: u16,
}

#[event]
pub struct RoundAdvancedEvent {
    pub session: Pubkey,
    pub match_id: [u8; 32],
    pub current_round: u8,
    pub round_deadline: i64,
}

#[event]
pub struct BattleFinalizedEvent {
    pub session: Pubkey,
    pub match_id: [u8; 32],
    pub winner: Pubkey,
    pub end_reason: u8,
    pub score_a: u16,
    pub score_b: u16,
    pub rounds_won_a: u8,
    pub rounds_won_b: u8,
}

#[event]
pub struct SessionCancelledEvent {
    pub session: Pubkey,
    pub match_id: [u8; 32],
    pub reason: u8,
    pub finished_at: i64,
}
