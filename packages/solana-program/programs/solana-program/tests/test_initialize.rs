use {
    anchor_lang::{
        solana_program::instruction::Instruction,
        InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_account::Account,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_pubkey::Pubkey,
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

// Well-known program IDs (hardcoded to avoid spl-token version conflicts)
const TOKEN_PROGRAM_ID: Pubkey = solana_pubkey::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const RENT_SYSVAR_ID: Pubkey = solana_pubkey::pubkey!("SysvarRent111111111111111111111111111111111");
const MINT_ACCOUNT_LEN: usize = 82;

/// Creates a pre-initialized SPL Token Mint as raw bytes and injects it into LiteSVM.
/// This avoids importing spl-token crate which causes Pubkey version conflicts.
fn create_mint_account(svm: &mut LiteSVM, mint_keypair: &Keypair, authority: &Pubkey, decimals: u8) {
    // SPL Token Mint layout (82 bytes):
    //   [0..4]   COption<Pubkey> mint_authority tag (1 = Some)
    //   [4..36]  mint_authority pubkey (32 bytes)
    //   [36..44] supply (u64 LE)
    //   [44]     decimals (u8)
    //   [45]     is_initialized (bool)
    //   [46..50] COption<Pubkey> freeze_authority tag (0 = None)
    //   [50..82] freeze_authority pubkey (32 zero bytes)
    let mut data = vec![0u8; MINT_ACCOUNT_LEN];

    // mint_authority = Some(authority)
    data[0..4].copy_from_slice(&1u32.to_le_bytes());
    data[4..36].copy_from_slice(authority.as_ref());

    // supply = 0
    data[36..44].copy_from_slice(&0u64.to_le_bytes());

    // decimals
    data[44] = decimals;

    // is_initialized = true
    data[45] = 1;

    // freeze_authority = None
    data[46..50].copy_from_slice(&0u32.to_le_bytes());

    let rent_lamports = svm.minimum_balance_for_rent_exemption(MINT_ACCOUNT_LEN);

    svm.set_account(
        mint_keypair.pubkey(),
        Account {
            lamports: rent_lamports,
            data,
            owner: TOKEN_PROGRAM_ID,
            executable: false,
            rent_epoch: 0,
        },
    ).unwrap();
}

/// Derive match_state PDA
fn find_match_pda(match_id: &[u8; 32], program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"match", match_id.as_ref()], program_id)
}

/// Derive vault PDA
fn find_vault_pda(match_id: &[u8; 32], program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"vault", match_id.as_ref()], program_id)
}

#[test]
fn test_initialize_match_happy_path() {
    let program_id = solana_program::id();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();

    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/solana_program.so");
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();

    // Create a pre-initialized SPL token mint via raw bytes
    create_mint_account(&mut svm, &token_mint, &player_a.pubkey(), 6);

    // Derive PDAs
    let match_id: [u8; 32] = [1u8; 32];
    let (match_pda, _) = find_match_pda(&match_id, &program_id);
    let (vault_pda, _) = find_vault_pda(&match_id, &program_id);

    let wager_amount: u64 = 1_000_000; // 1 token (6 decimals)

    let accounts = solana_program::accounts::InitializeMatch {
        player_a: player_a.pubkey(),
        player_b: player_b.pubkey(),
        token_mint: token_mint.pubkey(),
        match_state: match_pda,
        vault: vault_pda,
        token_program: TOKEN_PROGRAM_ID,
        system_program: Pubkey::default(), // system_program well-known
        rent: RENT_SYSVAR_ID,
    };

    let data = solana_program::instruction::InitializeMatch {
        match_id,
        wager_amount,
        server_pubkey: server.pubkey(),
    };

    let instruction = Instruction::new_with_bytes(
        program_id,
        &data.data(),
        accounts.to_account_metas(None),
    );

    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[instruction], Some(&player_a.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[&player_a]).unwrap();

    let res = svm.send_transaction(tx);
    assert!(res.is_ok(), "initialize_match should succeed: {:?}", res.err());
}

#[test]
fn test_initialize_match_zero_wager_fails() {
    let program_id = solana_program::id();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();

    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/solana_program.so");
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();

    create_mint_account(&mut svm, &token_mint, &player_a.pubkey(), 6);

    let match_id: [u8; 32] = [2u8; 32];
    let (match_pda, _) = find_match_pda(&match_id, &program_id);
    let (vault_pda, _) = find_vault_pda(&match_id, &program_id);

    let accounts = solana_program::accounts::InitializeMatch {
        player_a: player_a.pubkey(),
        player_b: player_b.pubkey(),
        token_mint: token_mint.pubkey(),
        match_state: match_pda,
        vault: vault_pda,
        token_program: TOKEN_PROGRAM_ID,
        system_program: Pubkey::default(),
        rent: RENT_SYSVAR_ID,
    };

    let data = solana_program::instruction::InitializeMatch {
        match_id,
        wager_amount: 0, // ← should be rejected
        server_pubkey: server.pubkey(),
    };

    let instruction = Instruction::new_with_bytes(
        program_id,
        &data.data(),
        accounts.to_account_metas(None),
    );

    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[instruction], Some(&player_a.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[&player_a]).unwrap();

    let res = svm.send_transaction(tx);
    assert!(res.is_err(), "zero wager should be rejected");
}

#[test]
fn test_initialize_match_same_player_fails() {
    let program_id = solana_program::id();
    let player_a = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();

    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/solana_program.so");
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();

    create_mint_account(&mut svm, &token_mint, &player_a.pubkey(), 6);

    let match_id: [u8; 32] = [3u8; 32];
    let (match_pda, _) = find_match_pda(&match_id, &program_id);
    let (vault_pda, _) = find_vault_pda(&match_id, &program_id);

    let accounts = solana_program::accounts::InitializeMatch {
        player_a: player_a.pubkey(),
        player_b: player_a.pubkey(), // ← same person!
        token_mint: token_mint.pubkey(),
        match_state: match_pda,
        vault: vault_pda,
        token_program: TOKEN_PROGRAM_ID,
        system_program: Pubkey::default(),
        rent: RENT_SYSVAR_ID,
    };

    let data = solana_program::instruction::InitializeMatch {
        match_id,
        wager_amount: 1_000_000,
        server_pubkey: server.pubkey(),
    };

    let instruction = Instruction::new_with_bytes(
        program_id,
        &data.data(),
        accounts.to_account_metas(None),
    );

    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[instruction], Some(&player_a.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[&player_a]).unwrap();

    let res = svm.send_transaction(tx);
    assert!(res.is_err(), "same player as A and B should be rejected");
}
