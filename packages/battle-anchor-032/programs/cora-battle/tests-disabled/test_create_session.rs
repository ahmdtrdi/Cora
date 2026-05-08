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
fn test_create_session_happy_path() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [1u8; 32];
    let question_hash = [42u8; 32];
    let session_pda = do_create_session(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, question_hash,
    );
    assert_ne!(session_pda, Pubkey::default());

    // Verify session account exists
    let acc = svm.get_account(&session_pda);
    assert!(acc.is_some(), "Session PDA should exist after creation");
}

#[test]
fn test_create_session_same_player_fails() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [2u8; 32];
    let (session_pda, _) = find_battle_pda(&match_id, &pid);

    let ix = Instruction::new_with_bytes(
        pid,
        &cora_battle::instruction::CreateSession {
            match_id, question_hash: [0u8; 32],
        }.data(),
        cora_battle::accounts::CreateSession {
            authority: authority.pubkey(),
            player_a: player.pubkey(),
            player_b: player.pubkey(), // same as player_a
            battle_session: session_pda,
            system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &authority, &[&authority]);
    assert!(res.is_err(), "Same player as A and B should be rejected");
}

#[test]
fn test_create_session_duplicate_match_id_fails() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [3u8; 32];
    // First creation should succeed
    do_create_session(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, [0u8; 32],
    );

    // Second creation with same match_id should fail (PDA already exists)
    let player_c = Keypair::new();
    let (session_pda, _) = find_battle_pda(&match_id, &pid);
    let ix = Instruction::new_with_bytes(
        pid,
        &cora_battle::instruction::CreateSession {
            match_id, question_hash: [0u8; 32],
        }.data(),
        cora_battle::accounts::CreateSession {
            authority: authority.pubkey(),
            player_a: player_a.pubkey(),
            player_b: player_c.pubkey(),
            battle_session: session_pda,
            system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &authority, &[&authority]);
    assert!(res.is_err(), "Duplicate match_id should be rejected");
}
