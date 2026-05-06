use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;
use crate::state::{BattleSession, RegisteredCard, BattleStatus};
use crate::error::BattleError;

pub fn handler(
    ctx: Context<PlayCard>,
    answer: String,
) -> Result<()> {
    let session = &mut ctx.accounts.battle_session;
    let card = &ctx.accounts.registered_card;
    let player = ctx.accounts.player.key();

    require!(session.status == BattleStatus::Active, BattleError::NotActive);
    require!(
        player == session.player_a || player == session.player_b,
        BattleError::UnauthorizedPlayer
    );

    // Verify hash: sha256(answer)
    let computed_hash = hash(answer.as_bytes());
    let is_correct = computed_hash.to_bytes() == card.correct_hash;

    // Update session scores/health IMMEDIATELY (Asynchronous Real-Time)
    if is_correct {
        let is_a = player == session.player_a;
        if is_a {
            session.score_a += 1;
            session.health_b = session.health_b.saturating_sub(card.damage);
        } else {
            session.score_b += 1;
            session.health_a = session.health_a.saturating_sub(card.damage);
        }
    }

    // Check if round/game is over (simplified: health reaches 0)
    if session.health_a == 0 || session.health_b == 0 {
        if session.health_b == 0 {
            session.rounds_won_a += 1;
        } else {
            session.rounds_won_b += 1;
        }

        if session.rounds_won_a >= 2 {
            session.status = BattleStatus::Finished;
            session.winner = session.player_a;
        } else if session.rounds_won_b >= 2 {
            session.status = BattleStatus::Finished;
            session.winner = session.player_b;
        } else {
            session.health_a = 100;
            session.health_b = 100;
            session.current_round += 1;
        }
    }

    Ok(())
}

#[derive(Accounts)]
pub struct PlayCard<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut)]
    pub battle_session: Account<'info, BattleSession>,
    #[account(
        constraint = registered_card.session == battle_session.key() @ BattleError::UnregisteredCard
    )]
    pub registered_card: Account<'info, RegisteredCard>,
}
