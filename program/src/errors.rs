use anchor_lang_v2::prelude::*;

#[error_code]
pub enum DropsetError {
    #[msg("Init instruction must be called by program ID")]
    InvalidInitSigner,
}
