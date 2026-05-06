use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("CbBattle11111111111111111111111111111111111");

#[program]
pub mod cora_battle {
    use super::*;

    pub fn create_session(
        ctx: Context<CreateSession>,
        match_id: [u8; 32],
        question_hash: [u8; 32],
    ) -> Result<()> {
        instructions::create_session::handler(ctx, match_id, question_hash)
    }

    pub fn register_cards(
        ctx: Context<RegisterCards>,
        card_id: [u8; 16],
        correct_hash: [u8; 32],
        damage: u16,
    ) -> Result<()> {
        instructions::register_cards::handler(ctx, card_id, correct_hash, damage)
    }

    pub fn play_card(
        ctx: Context<PlayCard>,
        answer: String,
    ) -> Result<()> {
        instructions::play_card::handler(ctx, answer)
    }

    pub fn finalize_match(ctx: Context<FinalizeMatch>) -> Result<()> {
        instructions::finalize_match::handler(ctx)
    }
}
