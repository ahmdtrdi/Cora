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
fn test_apply_damage_happy_path() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [20u8; 32];
    let (session_pda, card_pdas) = setup_active_battle(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, 4, 25,
    );

    // Player A answers correctly → deals 25 damage to player B
    let res = do_apply_damage(
        &mut svm, pid, &authority,
        session_pda, card_pdas[0], player_a.pubkey(),
    );
    assert!(res.is_ok(), "Apply damage should succeed");
}

#[test]
fn test_apply_damage_replay_protection() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [21u8; 32];
    let (session_pda, card_pdas) = setup_active_battle(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, 4, 25,
    );

    // First use should succeed
    do_apply_damage(
        &mut svm, pid, &authority,
        session_pda, card_pdas[0], player_a.pubkey(),
    ).unwrap();

    // Second use of same card should fail (replay protection)
    let res = do_apply_damage(
        &mut svm, pid, &authority,
        session_pda, card_pdas[0], player_a.pubkey(),
    );
    assert!(res.is_err(), "Replaying a used card should be rejected");
}

#[test]
fn test_apply_damage_unauthorized_fails() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let imposter = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&imposter.pubkey(), 10_000_000_000).unwrap();

    let match_id = [22u8; 32];
    let (session_pda, card_pdas) = setup_active_battle(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, 4, 25,
    );

    // Imposter tries to apply damage
    let ix = Instruction::new_with_bytes(
        pid,
        &cora_battle::instruction::ApplyDamage { attacker: player_a.pubkey() }.data(),
        cora_battle::accounts::ApplyDamage {
            authority: imposter.pubkey(),
            battle_session: session_pda,
            registered_card: card_pdas[0],
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &imposter, &[&imposter]);
    assert!(res.is_err(), "Non-authority should not be able to apply damage");
}

#[test]
fn test_apply_damage_invalid_attacker_fails() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let random = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [23u8; 32];
    let (session_pda, card_pdas) = setup_active_battle(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, 4, 25,
    );

    // Try with a non-participant as attacker
    let res = do_apply_damage(
        &mut svm, pid, &authority,
        session_pda, card_pdas[0], random.pubkey(),
    );
    assert!(res.is_err(), "Non-participant attacker should be rejected");
}

#[test]
fn test_apply_damage_before_activation_fails() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [24u8; 32];
    let session_pda = do_create_session(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, [0u8; 32],
    );
    let card_id = card_id_from_index(0);
    let card_pda = do_register_card(&mut svm, pid, &authority, session_pda, card_id, 25);

    // Try damage without activating (still in WaitingCards status)
    let res = do_apply_damage(
        &mut svm, pid, &authority,
        session_pda, card_pda, player_a.pubkey(),
    );
    assert!(res.is_err(), "Damage before activation should be rejected");
}

#[test]
fn test_apply_damage_health_reaches_zero_round_ends() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [25u8; 32];
    // 100 damage cards — one card KOs a player
    let (session_pda, card_pdas) = setup_active_battle(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, 6, 100,
    );

    // Player A one-shots player B → round 1 won by A
    do_apply_damage(
        &mut svm, pid, &authority,
        session_pda, card_pdas[0], player_a.pubkey(),
    ).unwrap();

    // Health should reset for round 2, player A uses another card
    // Player A one-shots again → round 2 won by A → match finished (2 wins)
    do_apply_damage(
        &mut svm, pid, &authority,
        session_pda, card_pdas[1], player_a.pubkey(),
    ).unwrap();

    // Match should be Finished now — further damage should fail
    let res = do_apply_damage(
        &mut svm, pid, &authority,
        session_pda, card_pdas[2], player_b.pubkey(),
    );
    assert!(res.is_err(), "Damage on finished match should be rejected");
}

#[test]
fn test_apply_damage_player_b_wins() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [26u8; 32];
    let (session_pda, card_pdas) = setup_active_battle(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, 6, 100,
    );

    // Player B wins 2 rounds
    do_apply_damage(&mut svm, pid, &authority, session_pda, card_pdas[0], player_b.pubkey()).unwrap();
    do_apply_damage(&mut svm, pid, &authority, session_pda, card_pdas[1], player_b.pubkey()).unwrap();

    // Match should be Finished — no more damage allowed
    let res = do_apply_damage(&mut svm, pid, &authority, session_pda, card_pdas[2], player_a.pubkey());
    assert!(res.is_err(), "Match should be finished after player B wins 2 rounds");
}

#[test]
fn test_apply_damage_gradual_health_depletion() {
    let (mut svm, pid) = setup();
    let authority = Keypair::new();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let match_id = [27u8; 32];
    // 10 cards with 50 damage each — need 2 hits to KO
    let (session_pda, card_pdas) = setup_active_battle(
        &mut svm, pid, &authority,
        player_a.pubkey(), player_b.pubkey(),
        match_id, 10, 50,
    );

    // Round 1: Player A hits twice → Player B KO'd
    do_apply_damage(&mut svm, pid, &authority, session_pda, card_pdas[0], player_a.pubkey()).unwrap();
    do_apply_damage(&mut svm, pid, &authority, session_pda, card_pdas[1], player_a.pubkey()).unwrap();

    // Round 2: Player B fights back, hits twice → Player A KO'd
    do_apply_damage(&mut svm, pid, &authority, session_pda, card_pdas[2], player_b.pubkey()).unwrap();
    do_apply_damage(&mut svm, pid, &authority, session_pda, card_pdas[3], player_b.pubkey()).unwrap();

    // Round 3: Player A wins final round → match over
    do_apply_damage(&mut svm, pid, &authority, session_pda, card_pdas[4], player_a.pubkey()).unwrap();
    do_apply_damage(&mut svm, pid, &authority, session_pda, card_pdas[5], player_a.pubkey()).unwrap();

    // No more plays allowed
    let res = do_apply_damage(&mut svm, pid, &authority, session_pda, card_pdas[6], player_b.pubkey());
    assert!(res.is_err(), "Should not allow damage after match ends");
}
