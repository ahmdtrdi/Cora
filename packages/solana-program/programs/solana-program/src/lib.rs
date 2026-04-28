pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use instructions::InitializeMatch;
pub(crate) use instructions::__client_accounts_initialize_match;

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
}
