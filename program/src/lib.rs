use anchor_lang_v2::prelude::*;

mod instructions;
mod state;

use instructions::*;
pub use state::*;

declare_id!("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

#[program]
pub mod dropset {
    use super::*;

    #[discrim = 0]
    pub fn init(ctx: &mut Context<Init>) -> Result<()> {
        ctx.accounts.init(ctx.bumps.registry, Address::default())
    }
}
