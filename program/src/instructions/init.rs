use crate::errors::DropsetError;
use crate::{Registry, DEFAULT_MAX_SEATS_PER_MARKET};
use anchor_lang_v2::{address_eq, prelude::*};

#[derive(Accounts)]
#[instruction(genesis_admin: Address)]
pub struct Init {
    #[account(mut)]
    pub payer: Signer,
    #[account(init, payer = payer, seeds = [b"registry"])]
    pub registry: Account<Registry>,
    pub system_program: Program<System>,
}

impl Init {
    #[inline(always)]
    pub fn init(&mut self, bump: u8, genesis_admin: Address, program_id: &Address) -> Result<()> {
        if !address_eq(self.payer.address(), program_id) {
            return Err(DropsetError::InvalidInitSigner.into());
        }
        let registry = &mut self.registry;
        registry.max_seats_per_market = DEFAULT_MAX_SEATS_PER_MARKET;
        registry.bump = bump;
        registry.admins.push(genesis_admin);
        Ok(())
    }
}
