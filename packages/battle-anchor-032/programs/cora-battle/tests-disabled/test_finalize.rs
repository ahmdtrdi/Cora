mod common;

use {
    anchor_lang::{
        solana_program::instruction::Instruction,
        InstructionData, ToAccountMetas,
    },
    solana_keypair::Keypair,
    solana_signer::Signer,
};
use common::*;

#[test]
fn test_finalize_match_happy_path() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [30u8; 32];
    let (session_pda, card_pdas) = setup_active_battle(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, 4, 100,
    );

    // Player A wins 2 rounds → Finished
    do_apply_damage(&mut svm, pid, &authority, session_pda, card_pdas[0], player_a.pubkey()).unwrap();
    do_apply_damage(&mut svm, pid, &authority, session_pda, card_pdas[1], player_a.pubkey()).unwrap();

    // Finalize should succeed
    let res = do_finalize_match(&mut svm, pid, &authority, session_pda);
    assert!(res.is_ok(), "Finalize should succeed on Finished session");
}

#[test]
fn test_finalize_match_not_finished_fails() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [31u8; 32];
    let (session_pda, _) = setup_active_battle(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, 4, 25,
    );

    // Try to finalize an Active session
    let res = do_finalize_match(&mut svm, pid, &authority, session_pda);
    assert!(res.is_err(), "Should not finalize a non-Finished session");
}

#[test]
fn test_finalize_match_unauthorized_fails() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let imposter = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&imposter.pubkey(), 10_000_000_000).unwrap();

    let match_id = [32u8; 32];
    let (session_pda, card_pdas) = setup_active_battle(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, 4, 100,
    );

    // Finish the match
    do_apply_damage(&mut svm, pid, &authority, session_pda, card_pdas[0], player_a.pubkey()).unwrap();
    do_apply_damage(&mut svm, pid, &authority, session_pda, card_pdas[1], player_a.pubkey()).unwrap();

    // Imposter tries to finalize
    let ix = Instruction::new_with_bytes(
        pid,
        &cora_battle::instruction::FinalizeMatch {}.data(),
        cora_battle::accounts::FinalizeMatch {
            authority: imposter.pubkey(),
            battle_session: session_pda,
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &imposter, &[&imposter]);
    assert!(res.is_err(), "Non-authority should not finalize");
}

#[test]
fn test_close_session_happy_path() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [33u8; 32];
    let (session_pda, card_pdas) = setup_active_battle(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, 4, 100,
    );

    // Finish the match
    do_apply_damage(&mut svm, pid, &authority, session_pda, card_pdas[0], player_a.pubkey()).unwrap();
    do_apply_damage(&mut svm, pid, &authority, session_pda, card_pdas[1], player_a.pubkey()).unwrap();

    // Close session — should reclaim rent
    let res = do_close_session(&mut svm, pid, &authority, session_pda);
    assert!(res.is_ok(), "Close should succeed on Finished session");

    // Account should be gone
    let acc = svm.get_account(&session_pda);
    assert!(acc.is_none(), "Session account should be closed");
}

#[test]
fn test_close_session_active_fails() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [34u8; 32];
    let (session_pda, _) = setup_active_battle(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, 4, 25,
    );

    // Try to close an Active session
    let res = do_close_session(&mut svm, pid, &authority, session_pda);
    assert!(res.is_err(), "Should not close an Active session");
}

#[test]
fn test_force_end_before_timeout_fails() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [35u8; 32];
    let (session_pda, _) = setup_active_battle(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, 4, 25,
    );

    // Try force-end immediately (timeout not reached)
    let res = do_force_end(&mut svm, pid, &authority, session_pda);
    assert!(res.is_err(), "Force-end before timeout should be rejected");
}

#[test]
fn test_activate_session_double_activation_fails() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [36u8; 32];
    let session_pda = do_create_session(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, [0u8; 32],
    );
    do_activate_session(&mut svm, pid, &authority, session_pda);

    // Double activation should fail (status is Active, not WaitingCards)
    let ix = Instruction::new_with_bytes(
        pid,
        &cora_battle::instruction::ActivateSession {}.data(),
        cora_battle::accounts::ActivateSession {
            authority: authority.pubkey(),
            battle_session: session_pda,
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &authority, &[&authority]);
    assert!(res.is_err(), "Double activation should be rejected");
}
