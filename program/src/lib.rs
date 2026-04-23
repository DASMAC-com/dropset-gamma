use anchor_lang_v2::prelude::*;

declare_id!("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

#[program]
pub mod dropset {
    use super::*;

    #[discrim = 0]
    pub fn init(ctx: &mut Context<Init>) -> Result<()> {
        ctx.accounts.registry.bump = ctx.bumps.registry;
        ctx.accounts.registry.max_seats_per_market = DEFAULT_MAX_SEATS_PER_MARKET;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Init {
    #[account(mut)]
    pub payer: Signer,
    #[account(init, payer = payer, seeds = [b"registry"])]
    pub registry: Account<Registry>,
    pub system_program: Program<System>,
}

const MAX_ADMINS: usize = 3;
const MAX_MAKERS: usize = 20;
const DEFAULT_MAX_SEATS_PER_MARKET: u8 = 10;
type FeeRate = u16;

#[account]
pub struct Registry {
    pub default_taker_fee_rate: FeeRate,
    pub max_seats_per_market: u8,
    pub bump: u8,
    pub _pad: [u8; 2],
    pub admins: PodVec<Address, MAX_ADMINS>,
    pub makers: PodVec<Address, MAX_MAKERS>,
}
