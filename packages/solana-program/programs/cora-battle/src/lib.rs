use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("3eMDYJTc5uxA5CueLoRvdCiCvhUnjSZS7gVwX6jREQR8");

#[program]
pub mod cora_battle {
    use super::*;

    /// Create a new battle session for two players.
    /// The signer becomes the session authority (backend oracle).
    pub fn create_session(
        ctx: Context<CreateSession>,
        match_id: [u8; 32],
        question_hash: [u8; 32],
    ) -> Result<()> {
        instructions::create_session::handler(ctx, match_id, question_hash)
    }

    /// Register a card (question mapping) for a battle session.
    /// Authority-only. Only allowed in WaitingCards status.
    pub fn register_card(
        ctx: Context<RegisterCard>,
        card_id: [u8; 16],
        damage: u16,
    ) -> Result<()> {
        instructions::register_card::handler(ctx, card_id, damage)
    }

    /// Activate the session after card registration is complete.
    /// Transitions WaitingCards → Active. Authority-only.
    pub fn activate_session(ctx: Context<ActivateSession>) -> Result<()> {
        instructions::activate_session::handler(ctx)
    }

    /// Apply damage to the opponent of the attacker.
    /// Authority-only. Backend verifies the answer off-chain,
    /// then calls this to record damage on-chain.
    pub fn apply_damage(
        ctx: Context<ApplyDamage>,
        attacker: Pubkey,
    ) -> Result<()> {
        instructions::apply_damage::handler(ctx, attacker)
    }

    /// Emit the BattleFinalized event for the settlement oracle.
    /// Authority-only. Session must be in Finished status.
    pub fn finalize_match(ctx: Context<FinalizeMatch>) -> Result<()> {
        instructions::finalize_match::handler(ctx)
    }

    /// Force-end a timed-out session. Authority-only.
    /// Only callable after SESSION_TIMEOUT has elapsed.
    pub fn force_end(ctx: Context<ForceEnd>) -> Result<()> {
        instructions::force_end::handler(ctx)
    }

    /// Close a terminal session account and reclaim rent SOL.
    /// Authority-only. Only Finished or Cancelled sessions.
    pub fn close_session(ctx: Context<CloseSession>) -> Result<()> {
        instructions::close_session::handler(ctx)
    }
}
