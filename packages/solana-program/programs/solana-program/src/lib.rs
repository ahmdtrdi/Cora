pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
pub use instructions::{DepositWager, InitializeMatch, Refund, SettleMatch};
pub(crate) use instructions::{
    __client_accounts_deposit_wager,
    __client_accounts_initialize_match,
    __client_accounts_refund,
    __client_accounts_settle_match,
};


declare_id!("9Pqkgy5uu9w2HvgyNUnHEvzdRWSv1h6GyCuD4uKBVp1W");

#[program]
pub mod solana_program {
    use super::*;

    pub fn initialize_match(
        ctx: Context<InitializeMatch>,
        match_id: [u8; 32],
        wager_amount: u64,
        server_pubkey: Pubkey,
    ) -> Result<()> {
        instructions::initialize_match::handler(ctx, match_id, wager_amount, server_pubkey)
    }

    pub fn deposit_wager(ctx: Context<DepositWager>) -> Result<()> {
        instructions::deposit_wager::handler(ctx)
    }

    pub fn settle_match(
        ctx: Context<SettleMatch>,
        action: u8,
        target: Pubkey,
        signature: [u8; 64],
    ) -> Result<()> {
        instructions::settle_match::handler(ctx, action, target, signature)
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        instructions::refund::handler(ctx)
    }
}
