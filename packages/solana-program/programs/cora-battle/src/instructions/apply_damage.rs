use anchor_lang::prelude::*;
use crate::state::{BattleSession, RegisteredCard, BattleStatus};
use crate::constants::*;
use crate::error::BattleError;
use crate::events::{DamageAppliedEvent, RoundEndedEvent, BattleFinalizedEvent};

/// Apply damage to the opponent of the attacker.
/// Only callable by the session authority (backend oracle).
/// The backend verifies the player's answer off-chain, then calls this
/// instruction to record the damage on-chain — the "blind HP calculator" pattern.
pub fn handler(
    ctx: Context<ApplyDamage>,
    attacker: Pubkey,
) -> Result<()> {
    let session = &mut ctx.accounts.battle_session;
    let card = &mut ctx.accounts.registered_card;

    // Session must be in Active state
    require!(
        session.status == BattleStatus::Active,
        BattleError::InvalidStatus
    );

    // Timeout guard: reject plays on expired sessions
    let now = Clock::get()?.unix_timestamp;
    require!(
        now.saturating_sub(session.created_at) <= SESSION_TIMEOUT,
        BattleError::SessionExpired
    );

    // Replay protection: each card can only be used once
    require!(!card.is_used, BattleError::CardAlreadyUsed);

    // Attacker must be a valid participant
    let is_player_a = attacker == session.player_a;
    let is_player_b = attacker == session.player_b;
    require!(is_player_a || is_player_b, BattleError::InvalidTarget);

    // Mark card as consumed
    card.is_used = true;

    // Apply damage to the opponent
    let damage = card.damage;
    if is_player_a {
        session.score_a = session.score_a
            .checked_add(1)
            .ok_or(BattleError::ArithmeticOverflow)?;
        session.health_b = session.health_b.saturating_sub(damage);
    } else {
        session.score_b = session.score_b
            .checked_add(1)
            .ok_or(BattleError::ArithmeticOverflow)?;
        session.health_a = session.health_a.saturating_sub(damage);
    }

    session.total_plays = session.total_plays
        .checked_add(1)
        .ok_or(BattleError::ArithmeticOverflow)?;

    emit!(DamageAppliedEvent {
        match_id: session.match_id,
        attacker,
        damage,
        health_a: session.health_a,
        health_b: session.health_b,
        round: session.current_round,
    });

    // Check if round is over (either player's health reaches 0)
    if session.health_a == 0 || session.health_b == 0 {
        // Tiebreak: if both are 0 simultaneously, the attacker wins the round.
        // This is fair because the attacker landed the killing blow.
        let round_winner_is_a = if session.health_a == 0 && session.health_b == 0 {
            is_player_a
        } else {
            session.health_b == 0
        };

        if round_winner_is_a {
            session.rounds_won_a = session.rounds_won_a
                .checked_add(1)
                .ok_or(BattleError::ArithmeticOverflow)?;
        } else {
            session.rounds_won_b = session.rounds_won_b
                .checked_add(1)
                .ok_or(BattleError::ArithmeticOverflow)?;
        }

        let round_winner = if round_winner_is_a {
            session.player_a
        } else {
            session.player_b
        };

        emit!(RoundEndedEvent {
            match_id: session.match_id,
            round: session.current_round,
            round_winner,
            rounds_won_a: session.rounds_won_a,
            rounds_won_b: session.rounds_won_b,
        });

        // Check if match is over (best-of-3, need 2 wins)
        if session.rounds_won_a >= ROUNDS_TO_WIN {
            session.status = BattleStatus::Finished;
            session.winner = session.player_a;
            session.finished_at = now;

            emit!(BattleFinalizedEvent {
                match_id: session.match_id,
                winner: session.player_a,
                score_a: session.score_a,
                score_b: session.score_b,
                rounds_won_a: session.rounds_won_a,
                rounds_won_b: session.rounds_won_b,
            });
        } else if session.rounds_won_b >= ROUNDS_TO_WIN {
            session.status = BattleStatus::Finished;
            session.winner = session.player_b;
            session.finished_at = now;

            emit!(BattleFinalizedEvent {
                match_id: session.match_id,
                winner: session.player_b,
                score_a: session.score_a,
                score_b: session.score_b,
                rounds_won_a: session.rounds_won_a,
                rounds_won_b: session.rounds_won_b,
            });
        } else {
            // Next round: reset health, advance round counter
            session.health_a = INITIAL_HEALTH;
            session.health_b = INITIAL_HEALTH;
            session.current_round = session.current_round
                .checked_add(1)
                .ok_or(BattleError::ArithmeticOverflow)?;
        }
    }

    Ok(())
}

#[derive(Accounts)]
pub struct ApplyDamage<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        constraint = battle_session.authority == authority.key()
            @ BattleError::UnauthorizedAuthority,
        seeds = [BATTLE_SEED, battle_session.match_id.as_ref()],
        bump = battle_session.bump,
    )]
    pub battle_session: Account<'info, BattleSession>,
    #[account(
        mut,
        constraint = registered_card.session == battle_session.key()
            @ BattleError::UnregisteredCard,
    )]
    pub registered_card: Account<'info, RegisteredCard>,
}
