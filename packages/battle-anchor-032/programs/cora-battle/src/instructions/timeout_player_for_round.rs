use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::BattleError;
use crate::events::{BattleFinalizedEvent, RoundAdvancedEvent, RoundTimedOutEvent};
use crate::state::{BattleSession, BattleStatus};

/// Resolve a missed round after its deadline has passed.
/// The backend decides disconnect/reconnect off-chain; ER only records the
/// terminal round outcome once the round can no longer be resumed.
pub fn handler(ctx: Context<TimeoutPlayerForRound>, timed_out_player: Pubkey) -> Result<()> {
    let session = &mut ctx.accounts.battle_session;
    let session_key = session.key();

    require!(
        session.status == BattleStatus::Active,
        BattleError::InvalidStatus
    );

    let now = Clock::get()?.unix_timestamp;
    require!(
        now >= session.round_deadline,
        BattleError::TimeoutNotReached
    );

    let timed_out_a = timed_out_player == session.player_a;
    let timed_out_b = timed_out_player == session.player_b;
    require!(timed_out_a || timed_out_b, BattleError::InvalidTarget);

    let round_winner = if timed_out_a {
        session.player_a_missed_rounds = session
            .player_a_missed_rounds
            .checked_add(1)
            .ok_or(BattleError::ArithmeticOverflow)?;
        session.score_b = session
            .score_b
            .checked_add(1)
            .ok_or(BattleError::ArithmeticOverflow)?;
        // TODO: rounds_won_* is a legacy duplicate of score_* and should be
        // removed in a future account migration once downstream consumers move.
        session.rounds_won_b = session
            .rounds_won_b
            .checked_add(1)
            .ok_or(BattleError::ArithmeticOverflow)?;
        session.player_b
    } else {
        session.player_b_missed_rounds = session
            .player_b_missed_rounds
            .checked_add(1)
            .ok_or(BattleError::ArithmeticOverflow)?;
        session.score_a = session
            .score_a
            .checked_add(1)
            .ok_or(BattleError::ArithmeticOverflow)?;
        // TODO: rounds_won_* is a legacy duplicate of score_* and should be
        // removed in a future account migration once downstream consumers move.
        session.rounds_won_a = session
            .rounds_won_a
            .checked_add(1)
            .ok_or(BattleError::ArithmeticOverflow)?;
        session.player_a
    };

    emit!(RoundTimedOutEvent {
        session: session_key,
        match_id: session.match_id,
        timed_out_player,
        round_winner,
        current_round: session.current_round,
        score_a: session.score_a,
        score_b: session.score_b,
    });

    if session.score_a >= u16::from(ROUNDS_TO_WIN) {
        session.status = BattleStatus::Finished;
        session.winner = session.player_a;
        session.end_reason = END_REASON_SINGLE_PLAYER_TIMEOUT;
        session.finished_at = now;

        emit!(BattleFinalizedEvent {
            session: session_key,
            match_id: session.match_id,
            winner: session.player_a,
            end_reason: session.end_reason,
            score_a: session.score_a,
            score_b: session.score_b,
            rounds_won_a: session.rounds_won_a,
            rounds_won_b: session.rounds_won_b,
            game_score_a: session.game_score_a,
            game_score_b: session.game_score_b,
        });
    } else if session.score_b >= u16::from(ROUNDS_TO_WIN) {
        session.status = BattleStatus::Finished;
        session.winner = session.player_b;
        session.end_reason = END_REASON_SINGLE_PLAYER_TIMEOUT;
        session.finished_at = now;

        emit!(BattleFinalizedEvent {
            session: session_key,
            match_id: session.match_id,
            winner: session.player_b,
            end_reason: session.end_reason,
            score_a: session.score_a,
            score_b: session.score_b,
            rounds_won_a: session.rounds_won_a,
            rounds_won_b: session.rounds_won_b,
            game_score_a: session.game_score_a,
            game_score_b: session.game_score_b,
        });
    } else {
        session.health_a = INITIAL_HEALTH;
        session.health_b = INITIAL_HEALTH;
        session.current_round = session
            .current_round
            .checked_add(1)
            .ok_or(BattleError::ArithmeticOverflow)?;
        session.round_started_at = now;
        session.round_deadline = now
            .checked_add(ROUND_DURATION_SECONDS)
            .ok_or(BattleError::ArithmeticOverflow)?;

        emit!(RoundAdvancedEvent {
            session: session_key,
            match_id: session.match_id,
            current_round: session.current_round,
            round_deadline: session.round_deadline,
        });
    }

    Ok(())
}

#[derive(Accounts)]
pub struct TimeoutPlayerForRound<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        constraint = battle_session.authority == authority.key()
            @ BattleError::UnauthorizedAuthority,
        seeds = [BATTLE_SEED, battle_session.match_id.as_ref()],
        bump = battle_session.bump,
    )]
    pub battle_session: Account<'info, BattleSession>,
}
