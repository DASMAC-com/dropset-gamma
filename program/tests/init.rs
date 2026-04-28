mod common;

use anchor_lang_v2::{bytemuck::Zeroable, programs::System, Id, InstructionData};
use anchor_v2_testing::{Keypair, Signer};
use common::{
    assert_slab_eq, deploy_with_authority, send_ixn, PROGRAM_ID, SIGNER_FUNDING_LAMPORTS,
};
use dropset_gamma::{
    instruction::Init as InitInstruction, EntryIndex, RegistryEntry, RegistryHeader,
    DEFAULT_MAX_SEATS_PER_MARKET,
};
use solana_instruction::{AccountMeta, Instruction};
use solana_loader_v3_interface::get_program_data_address;
use solana_pubkey::Pubkey;

fn registry_address() -> Pubkey {
    Pubkey::find_program_address(&[b"registry"], &PROGRAM_ID).0
}

fn init_ixn(payer: Pubkey, genesis_admin: Pubkey, program_data: Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        PROGRAM_ID,
        &InitInstruction { genesis_admin }.data(),
        vec![
            AccountMeta::new(payer, true),
            AccountMeta::new(registry_address(), false),
            AccountMeta::new_readonly(System::id(), false),
            AccountMeta::new_readonly(program_data, false),
        ],
    )
}

fn canonical_init_ixn(payer: Pubkey, genesis_admin: Pubkey) -> Instruction {
    init_ixn(payer, genesis_admin, get_program_data_address(&PROGRAM_ID))
}

#[test]
fn init_rejects_wrong_program_data_address() {
    let authority = Keypair::new();
    let mut svm = deploy_with_authority(&authority);

    // Any pubkey other than the canonical programdata PDA — the address
    // verification fails before any data is read.
    let bogus = Pubkey::new_unique();
    let err = send_ixn(
        &mut svm,
        &authority,
        init_ixn(authority.pubkey(), Pubkey::new_unique(), bogus),
    )
    .expect_err("non-canonical program_data must be rejected");
    assert!(
        err.contains("Custom"),
        "expected InvalidProgramDataAddress, got {err}"
    );
}

#[test]
fn init_rejects_non_upgrade_authority() {
    let authority = Keypair::new();
    let mut svm = deploy_with_authority(&authority);
    let imposter = Keypair::new();
    svm.airdrop(&imposter.pubkey(), SIGNER_FUNDING_LAMPORTS)
        .unwrap();

    let err = send_ixn(
        &mut svm,
        &imposter,
        canonical_init_ixn(imposter.pubkey(), Pubkey::new_unique()),
    )
    .expect_err("non-authority must be rejected");
    assert!(
        err.contains("Custom"),
        "expected InvalidUpgradeAuthority, got {err}"
    );
}

#[test]
fn init_succeeds_for_upgrade_authority() {
    let authority = Keypair::new();
    let mut svm = deploy_with_authority(&authority);
    let genesis_admin = Pubkey::new_unique();
    let (registry_pda, registry_bump) = Pubkey::find_program_address(&[b"registry"], &PROGRAM_ID);

    send_ixn(
        &mut svm,
        &authority,
        canonical_init_ixn(authority.pubkey(), genesis_admin),
    )
    .expect("init should succeed");

    // Verify registry fields. After init: header has the genesis admin DLL
    // pointing at slot 0, all other lists empty (NULL); slab tail holds one
    // entry with the genesis admin pubkey and NULL prev/next.
    let mut expected_header = RegistryHeader::zeroed();
    expected_header.max_seats_per_market = DEFAULT_MAX_SEATS_PER_MARKET;
    expected_header.bump = registry_bump;
    expected_header.admin_head = EntryIndex(0);
    expected_header.admin_tail = EntryIndex(0);
    expected_header.n_admins = 1;
    expected_header.maker_head = EntryIndex::NULL;
    expected_header.maker_tail = EntryIndex::NULL;
    expected_header.free_head = EntryIndex::NULL;
    let expected_entries = [RegistryEntry {
        account: genesis_admin.to_bytes().into(),
        prev: EntryIndex::NULL,
        next: EntryIndex::NULL,
        _pad: [0; 6],
    }];
    let account = svm.get_account(&registry_pda).expect("registry created");
    assert_slab_eq::<RegistryHeader, RegistryEntry>(
        &account.data,
        &account.owner,
        &expected_header,
        &expected_entries,
    );
}
