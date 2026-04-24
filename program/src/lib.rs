use anchor_lang_v2::prelude::*;

mod instructions;
use instructions::*;

declare_id!("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

#[program]
pub mod dropset {
    use super::*;

    #[discrim = 0]
    pub fn init(ctx: &mut Context<Init>) -> Result<()> {
        ctx.accounts.init(ctx.bumps.registry, Address::default())
    }
}

type FeeRate = u16;

const MAX_ADMINS: usize = 3;
const MAX_MAKERS: usize = 20;

#[account]
pub struct Registry {
    pub default_taker_fee_rate: FeeRate,
    pub max_seats_per_market: u8,
    pub bump: u8,
    pub _pad: [u8; 2],
    pub admins: PodVec<Address, MAX_ADMINS>,
    pub makers: PodVec<Address, MAX_MAKERS>,
}
