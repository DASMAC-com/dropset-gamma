use anchor_lang_v2::{bytemuck, Discriminator};
use anchor_v2_testing::{
    Keypair, LiteSVM, Message, Signer, VersionedMessage, VersionedTransaction,
};
use solana_instruction::Instruction;
use solana_loader_v3_interface::{instruction as loader_v3, state::UpgradeableLoaderState};
use solana_native_token::LAMPORTS_PER_SOL;
use solana_pubkey::Pubkey;

pub use dropset_gamma::ID as PROGRAM_ID;

const PROGRAM_SO_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../target/deploy/dropset_gamma.so"
);
const PROGRAM_KEYPAIR_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../target/deploy/dropset_gamma-keypair.json"
);

/// Fits comfortably under the per-txn size limit.
const WRITE_CHUNK: usize = 900;

/// Buffer rent + fees across `create_buffer` + `Write`s + `deploy`.
pub const PAYER_FUNDING_LAMPORTS: u64 = 100 * LAMPORTS_PER_SOL;
/// Covers txn fees only.
pub const SIGNER_FUNDING_LAMPORTS: u64 = LAMPORTS_PER_SOL;

/// Real upgradeable-loader deploy (`create_buffer` → chunked `Write`s →
/// `DeployWithMaxDataLen`) with `authority` as the upgrade authority.
pub fn deploy_with_authority(authority: &Keypair) -> LiteSVM {
    let mut svm = anchor_v2_testing::svm();

    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), PAYER_FUNDING_LAMPORTS)
        .unwrap();
    svm.airdrop(&authority.pubkey(), SIGNER_FUNDING_LAMPORTS)
        .unwrap();

    let program_kp = solana_keypair::read_keypair_file(PROGRAM_KEYPAIR_PATH)
        .expect("program keypair (run `anchor keys sync && anchor build`)");
    assert_eq!(program_kp.pubkey(), PROGRAM_ID);
    let program_so = std::fs::read(PROGRAM_SO_PATH).expect("program .so (run `anchor build`)");
    let buffer_kp = Keypair::new();

    let buffer_lamports = svm.minimum_balance_for_rent_exemption(
        UpgradeableLoaderState::size_of_buffer(program_so.len()),
    );
    let create_buffer = loader_v3::create_buffer(
        &payer.pubkey(),
        &buffer_kp.pubkey(),
        &authority.pubkey(),
        buffer_lamports,
        program_so.len(),
    )
    .unwrap();
    send_signed(&mut svm, &[&payer, &buffer_kp], &create_buffer);

    for (i, chunk) in program_so.chunks(WRITE_CHUNK).enumerate() {
        let ixn = loader_v3::write(
            &buffer_kp.pubkey(),
            &authority.pubkey(),
            (i * WRITE_CHUNK) as u32,
            chunk.to_vec(),
        );
        send_signed(&mut svm, &[&payer, authority], &[ixn]);
    }

    let program_lamports =
        svm.minimum_balance_for_rent_exemption(UpgradeableLoaderState::size_of_program());
    let deploy = loader_v3::deploy_with_max_program_len(
        &payer.pubkey(),
        &PROGRAM_ID,
        &buffer_kp.pubkey(),
        &authority.pubkey(),
        program_lamports,
        program_so.len(),
    )
    .unwrap();
    send_signed(&mut svm, &[&payer, &program_kp, authority], &deploy);

    svm
}

/// Send a single instruction signed by `signer` (also the fee payer).
/// Returns the debug-formatted runtime error on failure.
pub fn send_ixn(svm: &mut LiteSVM, signer: &Keypair, ixn: Instruction) -> Result<(), String> {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ixn], Some(&signer.pubkey()), &blockhash);
    let txn = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[signer]).unwrap();
    svm.send_transaction(txn)
        .map(|_| ())
        .map_err(|e| format!("{:?}", e.err))
}

/// Assert an anchor `#[account]` buffer matches `expected` exactly: owned
/// by the program, prefixed with `T`'s discriminator, body bytes
/// bytemuck-equal to `expected`, total length equal to
/// `disc.len() + size_of::<T>()` (catches any padding / trailing bytes the
/// framework might inject).
#[allow(dead_code)]
pub fn assert_anchor_account_eq<T>(data: &[u8], owner: &Pubkey, expected: &T)
where
    T: Discriminator + bytemuck::Pod,
{
    let disc_len = T::DISCRIMINATOR.len();
    assert_eq!(owner, &PROGRAM_ID, "account not owned by program");
    assert_eq!(
        data.len(),
        disc_len + core::mem::size_of::<T>(),
        "account length != disc + size_of::<T>()"
    );
    let (disc, body) = data.split_at(disc_len);
    assert_eq!(disc, T::DISCRIMINATOR, "discriminator mismatch");
    assert_eq!(body, bytemuck::bytes_of(expected), "body bytes mismatch");
}

/// Slab-aware counterpart to `assert_anchor_account_eq`. Asserts the
/// account holds `[disc][H][len:u32][pad to align T][T; expected_entries.len()]`,
/// matching anchor-v2's `Slab<H, T>` layout.
pub fn assert_slab_eq<H, T>(
    data: &[u8],
    owner: &Pubkey,
    expected_header: &H,
    expected_entries: &[T],
) where
    H: Discriminator + bytemuck::Pod,
    T: bytemuck::Pod + PartialEq + core::fmt::Debug,
{
    let disc_len = H::DISCRIMINATOR.len();
    let header_size = core::mem::size_of::<H>();
    let len_offset = disc_len + header_size;
    let after_len = len_offset + 4;
    let align = core::mem::align_of::<T>();
    let items_offset = (after_len + align - 1) & !(align - 1);
    let entry_size = core::mem::size_of::<T>();
    let expected_data_len = items_offset + expected_entries.len() * entry_size;

    assert_eq!(owner, &PROGRAM_ID, "account not owned by program");
    assert_eq!(
        data.len(),
        expected_data_len,
        "slab account length != items_offset + n_entries * size_of::<T>()"
    );

    let (disc, rest) = data.split_at(disc_len);
    assert_eq!(disc, H::DISCRIMINATOR, "discriminator mismatch");
    let header_bytes = &rest[..header_size];
    assert_eq!(
        header_bytes,
        bytemuck::bytes_of(expected_header),
        "header bytes mismatch"
    );

    let len_bytes: [u8; 4] = data[len_offset..len_offset + 4].try_into().unwrap();
    let len = u32::from_le_bytes(len_bytes);
    assert_eq!(
        len as usize,
        expected_entries.len(),
        "slab len mismatch"
    );

    let items_bytes = &data[items_offset..items_offset + expected_entries.len() * entry_size];
    let actual: &[T] = bytemuck::cast_slice(items_bytes);
    assert_eq!(actual, expected_entries, "slab entries mismatch");
}

fn send_signed(svm: &mut LiteSVM, signers: &[&Keypair], instructions: &[Instruction]) {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(instructions, Some(&signers[0].pubkey()), &blockhash);
    let txn = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    svm.send_transaction(txn)
        .map_err(|e| format!("setup txn failed: {:?}\nlogs: {:?}", e.err, e.meta.logs))
        .unwrap();
}
