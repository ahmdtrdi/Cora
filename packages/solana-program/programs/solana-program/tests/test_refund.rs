use {
    anchor_lang::{
        solana_program::{
            clock::Clock,
            instruction::Instruction,
        },
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
const WAGER_AMOUNT: u64 = 1_000_000;

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
fn test_refund_waiting_deposit_timeout() {
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

    let match_id: [u8; 32] = [8u8; 32];
    let (match_pda, _) = find_match_pda(&match_id, &program_id);
    let (vault_pda, _) = find_vault_pda(&match_id, &program_id);

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
        wager_amount: WAGER_AMOUNT,
        server_pubkey: server.pubkey(),
    };
    let init_ix = Instruction::new_with_bytes(program_id, &init_data.data(), init_accounts.to_account_metas(None));
    let init_tx = VersionedTransaction::try_new(
        VersionedMessage::Legacy(Message::new_with_blockhash(&[init_ix], Some(&player_a.pubkey()), &svm.latest_blockhash())),
        &[&player_a]
    ).unwrap();
    svm.send_transaction(init_tx).unwrap();

    let player_a_token = Keypair::new();
    let player_b_token = Keypair::new();
    create_token_account(&mut svm, &player_a_token.pubkey(), &token_mint.pubkey(), &player_a.pubkey(), 5_000_000);
    create_token_account(&mut svm, &player_b_token.pubkey(), &token_mint.pubkey(), &player_b.pubkey(), 5_000_000);

    // Player A deposits
    let deposit_a_ix = Instruction::new_with_bytes(
        program_id,
        &solana_program::instruction::DepositWager {}.data(),
        solana_program::accounts::DepositWager {
            depositor: player_a.pubkey(),
            match_state: match_pda,
            depositor_token_account: player_a_token.pubkey(),
            vault: vault_pda,
            token_mint: token_mint.pubkey(),
            token_program: TOKEN_PROGRAM_ID,
            system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    let deposit_a_tx = VersionedTransaction::try_new(
        VersionedMessage::Legacy(Message::new_with_blockhash(&[deposit_a_ix], Some(&player_a.pubkey()), &svm.latest_blockhash())),
        &[&player_a]
    ).unwrap();
    svm.send_transaction(deposit_a_tx).unwrap();

    let refund_accounts = solana_program::accounts::Refund {
        caller: player_a.pubkey(),
        match_state: match_pda,
        vault: vault_pda,
        player_a_token_account: player_a_token.pubkey(),
        player_b_token_account: player_b_token.pubkey(),
        token_mint: token_mint.pubkey(),
        token_program: TOKEN_PROGRAM_ID,
    };
    let refund_ix = Instruction::new_with_bytes(program_id, &solana_program::instruction::Refund {}.data(), refund_accounts.to_account_metas(None));
    
    // Fails because timeout (15s) has not passed
    let refund_tx_early = VersionedTransaction::try_new(
        VersionedMessage::Legacy(Message::new_with_blockhash(&[refund_ix.clone()], Some(&player_a.pubkey()), &svm.latest_blockhash())),
        &[&player_a]
    ).unwrap();
    let res_early = svm.send_transaction(refund_tx_early);
    assert!(res_early.is_err(), "Refund should fail before timeout");

    // Advance clock by 20s
    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp += 20;
    svm.set_sysvar(&clock);

    // To prevent AlreadyProcessed error, we use player_b as the fee payer to change the transaction signature
    let refund_tx_late = VersionedTransaction::try_new(
        VersionedMessage::Legacy(Message::new_with_blockhash(&[refund_ix], Some(&player_b.pubkey()), &svm.latest_blockhash())),
        &[&player_b, &player_a]
    ).unwrap();
    let res_late = svm.send_transaction(refund_tx_late);
    assert!(res_late.is_ok(), "Refund should succeed after timeout");

    let final_a_bal = get_token_balance(&mut svm, &player_a_token.pubkey());
    assert_eq!(final_a_bal, 5_000_000, "Player A should get 100% refund");
}

#[test]
fn test_refund_active_match_timeout() {
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

    let match_id: [u8; 32] = [9u8; 32];
    let (match_pda, _) = find_match_pda(&match_id, &program_id);
    let (vault_pda, _) = find_vault_pda(&match_id, &program_id);

    let init_ix = Instruction::new_with_bytes(
        program_id,
        &solana_program::instruction::InitializeMatch { match_id, wager_amount: WAGER_AMOUNT, server_pubkey: server.pubkey() }.data(),
        solana_program::accounts::InitializeMatch {
            player_a: player_a.pubkey(),
            player_b: player_b.pubkey(),
            token_mint: token_mint.pubkey(),
            match_state: match_pda,
            vault: vault_pda,
            token_program: TOKEN_PROGRAM_ID,
            system_program: Pubkey::default(),
            rent: RENT_SYSVAR_ID,
        }.to_account_metas(None)
    );
    svm.send_transaction(VersionedTransaction::try_new(VersionedMessage::Legacy(Message::new_with_blockhash(&[init_ix], Some(&player_a.pubkey()), &svm.latest_blockhash())), &[&player_a]).unwrap()).unwrap();

    let player_a_token = Keypair::new();
    let player_b_token = Keypair::new();
    create_token_account(&mut svm, &player_a_token.pubkey(), &token_mint.pubkey(), &player_a.pubkey(), 5_000_000);
    create_token_account(&mut svm, &player_b_token.pubkey(), &token_mint.pubkey(), &player_b.pubkey(), 5_000_000);

    // Both Deposit (Match becomes Active)
    let deposit_a_ix = Instruction::new_with_bytes(
        program_id,
        &solana_program::instruction::DepositWager {}.data(),
        solana_program::accounts::DepositWager { depositor: player_a.pubkey(), match_state: match_pda, depositor_token_account: player_a_token.pubkey(), vault: vault_pda, token_mint: token_mint.pubkey(), token_program: TOKEN_PROGRAM_ID, system_program: Pubkey::default() }.to_account_metas(None),
    );
    svm.send_transaction(VersionedTransaction::try_new(VersionedMessage::Legacy(Message::new_with_blockhash(&[deposit_a_ix], Some(&player_a.pubkey()), &svm.latest_blockhash())), &[&player_a]).unwrap()).unwrap();

    let deposit_b_ix = Instruction::new_with_bytes(
        program_id,
        &solana_program::instruction::DepositWager {}.data(),
        solana_program::accounts::DepositWager { depositor: player_b.pubkey(), match_state: match_pda, depositor_token_account: player_b_token.pubkey(), vault: vault_pda, token_mint: token_mint.pubkey(), token_program: TOKEN_PROGRAM_ID, system_program: Pubkey::default() }.to_account_metas(None),
    );
    svm.send_transaction(VersionedTransaction::try_new(VersionedMessage::Legacy(Message::new_with_blockhash(&[deposit_b_ix], Some(&player_b.pubkey()), &svm.latest_blockhash())), &[&player_b]).unwrap()).unwrap();

    let refund_ix = Instruction::new_with_bytes(
        program_id,
        &solana_program::instruction::Refund {}.data(),
        solana_program::accounts::Refund { caller: player_a.pubkey(), match_state: match_pda, vault: vault_pda, player_a_token_account: player_a_token.pubkey(), player_b_token_account: player_b_token.pubkey(), token_mint: token_mint.pubkey(), token_program: TOKEN_PROGRAM_ID }.to_account_metas(None),
    );

    // Advance clock by 610s (MATCH_TIMEOUT is 600s)
    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp += 610;
    svm.set_sysvar(&clock);

    // Refund should succeed
    let refund_tx = VersionedTransaction::try_new(VersionedMessage::Legacy(Message::new_with_blockhash(&[refund_ix], Some(&player_a.pubkey()), &svm.latest_blockhash())), &[&player_a]).unwrap();
    let res = svm.send_transaction(refund_tx);
    assert!(res.is_ok(), "Refund should succeed after match timeout");

    // Both players should get 100% back
    assert_eq!(get_token_balance(&mut svm, &player_a_token.pubkey()), 5_000_000);
    assert_eq!(get_token_balance(&mut svm, &player_b_token.pubkey()), 5_000_000);
}
