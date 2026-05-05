use anchor_lang::prelude::*;
use crate::state::{BattleSession, RegisteredCard};

pub fn handler(
    ctx: Context<RegisterCards>,
    card_id: [u8; 16],
    correct_hash: [u8; 32],
    damage: u16,
) -> Result<()> {
    let card = &mut ctx.accounts.registered_card;
    card.session = ctx.accounts.battle_session.key();
    card.card_id = card_id;
    card.correct_hash = correct_hash;
    card.damage = damage;
    card.bump = ctx.bumps.registered_card;
    Ok(())
}

#[derive(Accounts)]
#[instruction(card_id: [u8; 16])]
pub struct RegisterCards<'info> {
    #[account(mut)]
    pub authority: Signer<'info>, // BE Oracle
    pub battle_session: Account<'info, BattleSession>,
    #[account(
        init, payer = authority,
        space = RegisteredCard::LEN,
        seeds = [b"card", battle_session.key().as_ref(), card_id.as_ref()],
        bump,
    )]
    pub registered_card: Account<'info, RegisteredCard>,
    pub system_program: Program<'info, System>,
}
