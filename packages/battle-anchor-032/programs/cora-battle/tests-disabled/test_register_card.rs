mod common;

use {
    anchor_lang::{
        solana_program::instruction::Instruction,
        InstructionData, ToAccountMetas,
    },
    solana_keypair::Keypair,
    solana_pubkey::Pubkey,
    solana_signer::Signer,
};
use common::*;

#[test]
fn test_register_card_happy_path() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [10u8; 32];
    let session_pda = do_create_session(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, [0u8; 32],
    );

    let card_id = card_id_from_index(0);
    let card_pda = do_register_card(&mut svm, pid, &authority, session_pda, card_id, 25);
    let acc = svm.get_account(&card_pda);
    assert!(acc.is_some(), "Card PDA should exist");
}

#[test]
fn test_register_card_unauthorized_fails() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let imposter = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&imposter.pubkey(), 10_000_000_000).unwrap();

    let match_id = [11u8; 32];
    let session_pda = do_create_session(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, [0u8; 32],
    );

    let card_id = card_id_from_index(0);
    let (card_pda, _) = find_card_pda(&session_pda, &card_id, &pid);

    // Imposter tries to register a card
    let ix = Instruction::new_with_bytes(
        pid,
        &cora_battle::instruction::RegisterCard { card_id, damage: 25 }.data(),
        cora_battle::accounts::RegisterCard {
            authority: imposter.pubkey(),
            battle_session: session_pda,
            registered_card: card_pda,
            system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &imposter, &[&imposter]);
    assert!(res.is_err(), "Non-authority should not be able to register cards");
}

#[test]
fn test_register_card_damage_zero_fails() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [12u8; 32];
    let session_pda = do_create_session(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, [0u8; 32],
    );

    let card_id = card_id_from_index(0);
    let (card_pda, _) = find_card_pda(&session_pda, &card_id, &pid);

    let ix = Instruction::new_with_bytes(
        pid,
        &cora_battle::instruction::RegisterCard { card_id, damage: 0 }.data(),
        cora_battle::accounts::RegisterCard {
            authority: authority.pubkey(),
            battle_session: session_pda,
            registered_card: card_pda,
            system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &authority, &[&authority]);
    assert!(res.is_err(), "Zero damage should be rejected");
}

#[test]
fn test_register_card_damage_over_max_fails() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [13u8; 32];
    let session_pda = do_create_session(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, [0u8; 32],
    );

    let card_id = card_id_from_index(0);
    let (card_pda, _) = find_card_pda(&session_pda, &card_id, &pid);

    let ix = Instruction::new_with_bytes(
        pid,
        &cora_battle::instruction::RegisterCard { card_id, damage: 101 }.data(),
        cora_battle::accounts::RegisterCard {
            authority: authority.pubkey(),
            battle_session: session_pda,
            registered_card: card_pda,
            system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &authority, &[&authority]);
    assert!(res.is_err(), "Damage above MAX_DAMAGE should be rejected");
}

#[test]
fn test_register_card_after_activation_fails() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [14u8; 32];
    let session_pda = do_create_session(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, [0u8; 32],
    );

    // Activate first
    do_activate_session(&mut svm, pid, &authority, session_pda);

    // Try to register card after activation
    let card_id = card_id_from_index(0);
    let (card_pda, _) = find_card_pda(&session_pda, &card_id, &pid);
    let ix = Instruction::new_with_bytes(
        pid,
        &cora_battle::instruction::RegisterCard { card_id, damage: 25 }.data(),
        cora_battle::accounts::RegisterCard {
            authority: authority.pubkey(),
            battle_session: session_pda,
            registered_card: card_pda,
            system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &authority, &[&authority]);
    assert!(res.is_err(), "Should not register cards after activation");
}
