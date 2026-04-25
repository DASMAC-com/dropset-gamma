// cspell:words airdrop blockhash bpf dropset Keypair LAMPORTS lamports litesvm programdata solana Upgradeab

use anchor_lang_v2::{programs::System, Id, InstructionData};
use anchor_v2_testing::{
    Keypair, LiteSVM, Message, Signer, VersionedMessage, VersionedTransaction,
};
use dropset_gamma::{instruction::Init as InitInstruction, ID as PROGRAM_ID};
use solana_instruction::{AccountMeta, Instruction};
use solana_loader_v3_interface::{
    get_program_data_address, instruction as loader_v3, state::UpgradeableLoaderState,
};
use solana_native_token::LAMPORTS_PER_SOL;
use solana_pubkey::Pubkey;

const PROGRAM_SO: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../target/deploy/dropset_gamma.so"
));
const PROGRAM_KEYPAIR_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/target/deploy/dropset_gamma-keypair.json"
);

/// Fits comfortably under the per-tx size limit.
const WRITE_CHUNK: usize = 900;

/// Buffer rent + fees across `create_buffer` + `Write`s + `deploy`.
const PAYER_FUNDING_LAMPORTS: u64 = 100 * LAMPORTS_PER_SOL;
/// Covers tx fees only — authority signs each `Write` and the deploy.
const SIGNER_FUNDING_LAMPORTS: u64 = LAMPORTS_PER_SOL;

fn registry_address() -> Pubkey {
    Pubkey::find_program_address(&[b"registry"], &PROGRAM_ID).0
}

fn send_signed(svm: &mut LiteSVM, signers: &[&Keypair], instructions: &[Instruction]) {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(instructions, Some(&signers[0].pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    svm.send_transaction(tx)
        .map_err(|e| format!("setup tx failed: {:?}\nlogs: {:?}", e.err, e.meta.logs))
        .unwrap();
}

/// Real upgradeable-loader deploy (`create_buffer` → chunked `Write`s →
/// `DeployWithMaxDataLen`) with `authority` as the upgrade authority.
fn deploy_with_authority(authority: &Keypair) -> LiteSVM {
    let mut svm = anchor_v2_testing::svm();

    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), PAYER_FUNDING_LAMPORTS)
        .unwrap();
    svm.airdrop(&authority.pubkey(), SIGNER_FUNDING_LAMPORTS)
        .unwrap();

    let program_kp = solana_keypair::read_keypair_file(PROGRAM_KEYPAIR_PATH)
        .expect("program keypair (run `anchor keys sync && anchor build`)");
    assert_eq!(program_kp.pubkey(), PROGRAM_ID);
    let buffer_kp = Keypair::new();

    let buffer_lamports = svm.minimum_balance_for_rent_exemption(
        UpgradeableLoaderState::size_of_buffer(PROGRAM_SO.len()),
    );
    let create_buffer = loader_v3::create_buffer(
        &payer.pubkey(),
        &buffer_kp.pubkey(),
        &authority.pubkey(),
        buffer_lamports,
        PROGRAM_SO.len(),
    )
    .unwrap();
    send_signed(&mut svm, &[&payer, &buffer_kp], &create_buffer);

    for (i, chunk) in PROGRAM_SO.chunks(WRITE_CHUNK).enumerate() {
        let ix = loader_v3::write(
            &buffer_kp.pubkey(),
            &authority.pubkey(),
            (i * WRITE_CHUNK) as u32,
            chunk.to_vec(),
        );
        send_signed(&mut svm, &[&payer, authority], &[ix]);
    }

    let program_lamports =
        svm.minimum_balance_for_rent_exemption(UpgradeableLoaderState::size_of_program());
    let deploy = loader_v3::deploy_with_max_program_len(
        &payer.pubkey(),
        &PROGRAM_ID,
        &buffer_kp.pubkey(),
        &authority.pubkey(),
        program_lamports,
        PROGRAM_SO.len(),
    )
    .unwrap();
    send_signed(&mut svm, &[&payer, &program_kp, authority], &deploy);

    svm
}

fn init_ix(payer: Pubkey, genesis_admin: Pubkey, program_data: Pubkey) -> Instruction {
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

fn canonical_init_ix(payer: Pubkey, genesis_admin: Pubkey) -> Instruction {
    init_ix(payer, genesis_admin, get_program_data_address(&PROGRAM_ID))
}

fn send_init(svm: &mut LiteSVM, signer: &Keypair, ix: Instruction) -> Result<(), String> {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&signer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[signer]).unwrap();
    svm.send_transaction(tx)
        .map(|_| ())
        .map_err(|e| format!("{:?}", e.err))
}

#[test]
fn init_rejects_wrong_program_data_address() {
    let authority = Keypair::new();
    let mut svm = deploy_with_authority(&authority);

    // Any pubkey other than the canonical programdata PDA — the address
    // verification fails before any data is read.
    let bogus = Pubkey::new_unique();
    let err = send_init(
        &mut svm,
        &authority,
        init_ix(authority.pubkey(), Pubkey::new_unique(), bogus),
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

    let err = send_init(
        &mut svm,
        &imposter,
        canonical_init_ix(imposter.pubkey(), Pubkey::new_unique()),
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

    send_init(
        &mut svm,
        &authority,
        canonical_init_ix(authority.pubkey(), Pubkey::new_unique()),
    )
    .expect("init should succeed");

    assert!(svm
        .get_account(&registry_address())
        .is_some_and(|a| a.owner == PROGRAM_ID));
}
