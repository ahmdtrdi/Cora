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

const TOKEN_PROGRAM_ID: Pubkey = solana_pubkey::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const RENT_SYSVAR_ID: Pubkey = solana_pubkey::pubkey!("SysvarRent111111111111111111111111111111111");
const MINT_ACCOUNT_LEN: usize = 82;
const TOKEN_ACCOUNT_LEN: usize = 165;

fn create_mint_account(svm: &mut LiteSVM, mint_keypair: &Keypair, authority: &Pubkey, decimals: u8) {
    let mut data = vec![0u8; MINT_ACCOUNT_LEN];
    data[0..4].copy_from_slice(&1u32.to_le_bytes());
    data[4..36].copy_from_slice(authority.as_ref());
    data[36..44].copy_from_slice(&0u64.to_le_bytes());
    data[44] = decimals;
    data[45] = 1;
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

fn create_token_account(svm: &mut LiteSVM, token_account: &Pubkey, mint: &Pubkey, owner: &Pubkey, amount: u64) {
    let mut data = vec![0u8; TOKEN_ACCOUNT_LEN];
    data[0..32].copy_from_slice(mint.as_ref());
    data[32..64].copy_from_slice(owner.as_ref());
    data[64..72].copy_from_slice(&amount.to_le_bytes());
    data[72..76].copy_from_slice(&0u32.to_le_bytes());
    data[108] = 1;

    let rent = svm.minimum_balance_for_rent_exemption(TOKEN_ACCOUNT_LEN);
    svm.set_account(
        *token_account,
        Account {
            lamports: rent,
            data,
            owner: TOKEN_PROGRAM_ID,
            executable: false,
            rent_epoch: 0,
        },
    ).unwrap();
}

fn get_token_balance(svm: &mut LiteSVM, token_account: &Pubkey) -> u64 {
    let acc = svm.get_account(token_account).unwrap();
    let mut amount_bytes = [0u8; 8];
    amount_bytes.copy_from_slice(&acc.data[64..72]);
    u64::from_le_bytes(amount_bytes)
}

fn find_match_pda(match_id: &[u8; 32], program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"match", match_id.as_ref()], program_id)
}

fn find_vault_pda(match_id: &[u8; 32], program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"vault", match_id.as_ref()], program_id)
}

#[test]
fn test_deposit_wager_happy_path() {
    let program_id = solana_program::id();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();

    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/solana_program.so");
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&player_b.pubkey(), 10_000_000_000).unwrap();

    create_mint_account(&mut svm, &token_mint, &player_a.pubkey(), 6);

    let match_id: [u8; 32] = [4u8; 32];
    let (match_pda, _) = find_match_pda(&match_id, &program_id);
    let (vault_pda, _) = find_vault_pda(&match_id, &program_id);

    let wager_amount: u64 = 1_000_000;

    let init_accounts = solana_program::accounts::InitializeMatch {
        player_a: player_a.pubkey(),
        player_b: player_b.pubkey(),
        token_mint: token_mint.pubkey(),
        match_state: match_pda,
        vault: vault_pda,
        token_program: TOKEN_PROGRAM_ID,
        system_program: Pubkey::default(),
        rent: RENT_SYSVAR_ID,
    };

    let init_data = solana_program::instruction::InitializeMatch {
        match_id,
        wager_amount,
        server_pubkey: server.pubkey(),
    };

    let init_ix = Instruction::new_with_bytes(
        program_id,
        &init_data.data(),
        init_accounts.to_account_metas(None),
    );

    let init_tx = VersionedTransaction::try_new(
        VersionedMessage::Legacy(Message::new_with_blockhash(&[init_ix], Some(&player_a.pubkey()), &svm.latest_blockhash())),
        &[&player_a]
    ).unwrap();
    svm.send_transaction(init_tx).unwrap();

    // Create player A token account and mint some tokens
    let player_a_token = Keypair::new();
    create_token_account(&mut svm, &player_a_token.pubkey(), &token_mint.pubkey(), &player_a.pubkey(), 5_000_000);

    let deposit_accounts = solana_program::accounts::DepositWager {
        depositor: player_a.pubkey(),
        match_state: match_pda,
        depositor_token_account: player_a_token.pubkey(),
        vault: vault_pda,
        token_mint: token_mint.pubkey(),
        token_program: TOKEN_PROGRAM_ID,
        system_program: Pubkey::default(),
    };

    let deposit_data = solana_program::instruction::DepositWager {};

    let deposit_ix = Instruction::new_with_bytes(
        program_id,
        &deposit_data.data(),
        deposit_accounts.to_account_metas(None),
    );

    let deposit_tx = VersionedTransaction::try_new(
        VersionedMessage::Legacy(Message::new_with_blockhash(&[deposit_ix], Some(&player_a.pubkey()), &svm.latest_blockhash())),
        &[&player_a]
    ).unwrap();
    let res = svm.send_transaction(deposit_tx);
    assert!(res.is_ok(), "Deposit should succeed: {:?}", res.err());

    let vault_balance = get_token_balance(&mut svm, &vault_pda);
    assert_eq!(vault_balance, wager_amount);
}
