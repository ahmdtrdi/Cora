use anchor_lang::prelude::*;
use crate::state::{BattleSession, BattleStatus, RegisteredCard};
use crate::constants::*;
use crate::error::BattleError;
use crate::events::CardRegisteredEvent;

pub fn handler(
    ctx: Context<RegisterCard>,
    card_id: [u8; 16],
    damage: u16,
) -> Result<()> {
    let session = &ctx.accounts.battle_session;

    // Only allow during card registration phase
    require!(
        session.status == BattleStatus::WaitingCards,
        BattleError::InvalidStatus
    );

    // Validate damage bounds to prevent one-shot or zero-damage exploits
    require!(
        damage >= MIN_DAMAGE && damage <= MAX_DAMAGE,
        BattleError::InvalidDamage
    );

    let card = &mut ctx.accounts.registered_card;
    card.session = ctx.accounts.battle_session.key();
    card.card_id = card_id;
    card.damage = damage;
    card.is_used = false;
    card.bump = ctx.bumps.registered_card;

    emit!(CardRegisteredEvent {
        match_id: session.match_id,
        card_id,
        damage,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(card_id: [u8; 16])]
pub struct RegisterCard<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        constraint = battle_session.authority == authority.key()
            @ BattleError::UnauthorizedAuthority,
    )]
    pub battle_session: Account<'info, BattleSession>,
    #[account(
        init, payer = authority,
        space = RegisteredCard::LEN,
        seeds = [CARD_SEED, battle_session.key().as_ref(), card_id.as_ref()],
        bump,
    )]
    pub registered_card: Account<'info, RegisteredCard>,
    pub system_program: Program<'info, System>,
}
