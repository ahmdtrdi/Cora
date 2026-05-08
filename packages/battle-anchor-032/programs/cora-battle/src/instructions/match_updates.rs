use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::BattleError;
use crate::events::{BattleFinalizedEvent, RoundAdvancedEvent, RoundEndedEvent};
use crate::state::{BattleSession, BattleStatus};

/// Apply the standard non-timeout round winner flow used by normal card effects:
/// sync legacy round counters, emit round end, and either finalize or advance.
pub(crate) fn award_round_and_progress(
    session: &mut BattleSession,
    session_key: Pubkey,
    round_winner_is_a: bool,
    now: i64,
) -> Result<()> {
    if round_winner_is_a {
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
    } else {
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
    }

    let round_winner = if round_winner_is_a {
        session.player_a
    } else {
        session.player_b
    };

    emit!(RoundEndedEvent {
        session: session_key,
        match_id: session.match_id,
        round: session.current_round,
        round_winner,
        rounds_won_a: session.rounds_won_a,
        rounds_won_b: session.rounds_won_b,
    });

    if session.score_a >= u16::from(ROUNDS_TO_WIN) {
        session.status = BattleStatus::Finished;
        session.winner = session.player_a;
        session.finished_at = now;
        session.end_reason = END_REASON_NORMAL_WIN;

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
        session.finished_at = now;
        session.end_reason = END_REASON_NORMAL_WIN;

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
