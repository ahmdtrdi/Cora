#![allow(dead_code)]

use {
    anchor_lang::{
        solana_program::instruction::Instruction,
        InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_pubkey::Pubkey,
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

pub fn setup() -> (LiteSVM, Pubkey) {
    let pid = cora_battle::id();
    let mut svm = LiteSVM::new();
    svm.add_program(pid, include_bytes!("../../../../target/deploy/cora_battle.so")).unwrap();
    (svm, pid)
}

pub fn find_battle_pda(match_id: &[u8; 32], pid: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"battle", match_id.as_ref()], pid)
}

pub fn find_card_pda(session_pda: &Pubkey, card_id: &[u8; 16], pid: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"card", session_pda.as_ref(), card_id.as_ref()], pid)
}

pub fn send_tx(
    svm: &mut LiteSVM, ixs: &[Instruction], payer: &Keypair, signers: &[&Keypair],
) -> Result<(), String> {
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?}", e))
}

/// Create a battle session and return the session PDA
pub fn do_create_session(
    svm: &mut LiteSVM, pid: Pubkey, authority: &Keypair,
    player_a: Pubkey, player_b: Pubkey,
    match_id: [u8; 32], question_hash: [u8; 32],
) -> Pubkey {
    let (session_pda, _) = find_battle_pda(&match_id, &pid);
    let ix = Instruction::new_with_bytes(
        pid,
        &cora_battle::instruction::CreateSession { match_id, question_hash }.data(),
        cora_battle::accounts::CreateSession {
            authority: authority.pubkey(),
            player_a,
            player_b,
            battle_session: session_pda,
            system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    send_tx(svm, &[ix], authority, &[authority]).unwrap();
    session_pda
}

/// Register a card for a session
pub fn do_register_card(
    svm: &mut LiteSVM, pid: Pubkey, authority: &Keypair,
    session_pda: Pubkey, card_id: [u8; 16], damage: u16,
) -> Pubkey {
    let (card_pda, _) = find_card_pda(&session_pda, &card_id, &pid);
    let ix = Instruction::new_with_bytes(
        pid,
        &cora_battle::instruction::RegisterCard { card_id, damage }.data(),
        cora_battle::accounts::RegisterCard {
            authority: authority.pubkey(),
            battle_session: session_pda,
            registered_card: card_pda,
            system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    send_tx(svm, &[ix], authority, &[authority]).unwrap();
    card_pda
}

/// Activate the session
pub fn do_activate_session(
    svm: &mut LiteSVM, pid: Pubkey, authority: &Keypair, session_pda: Pubkey,
) {
    let ix = Instruction::new_with_bytes(
        pid,
        &cora_battle::instruction::ActivateSession {}.data(),
        cora_battle::accounts::ActivateSession {
            authority: authority.pubkey(),
            battle_session: session_pda,
        }.to_account_metas(None),
    );
    send_tx(svm, &[ix], authority, &[authority]).unwrap();
}

/// Apply damage with a card
pub fn do_apply_damage(
    svm: &mut LiteSVM, pid: Pubkey, authority: &Keypair,
    session_pda: Pubkey, card_pda: Pubkey, attacker: Pubkey,
) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        pid,
        &cora_battle::instruction::ApplyDamage { attacker }.data(),
        cora_battle::accounts::ApplyDamage {
            authority: authority.pubkey(),
            battle_session: session_pda,
            registered_card: card_pda,
        }.to_account_metas(None),
    );
    send_tx(svm, &[ix], authority, &[authority])
}

/// Finalize a finished match
pub fn do_finalize_match(
    svm: &mut LiteSVM, pid: Pubkey, authority: &Keypair, session_pda: Pubkey,
) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        pid,
        &cora_battle::instruction::FinalizeMatch {}.data(),
        cora_battle::accounts::FinalizeMatch {
            authority: authority.pubkey(),
            battle_session: session_pda,
        }.to_account_metas(None),
    );
    send_tx(svm, &[ix], authority, &[authority])
}

/// Force-end a timed-out session
pub fn do_force_end(
    svm: &mut LiteSVM, pid: Pubkey, authority: &Keypair, session_pda: Pubkey,
) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        pid,
        &cora_battle::instruction::ForceEnd {}.data(),
        cora_battle::accounts::ForceEnd {
            authority: authority.pubkey(),
            battle_session: session_pda,
        }.to_account_metas(None),
    );
    send_tx(svm, &[ix], authority, &[authority])
}

/// Close a terminal session
pub fn do_close_session(
    svm: &mut LiteSVM, pid: Pubkey, authority: &Keypair, session_pda: Pubkey,
) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        pid,
        &cora_battle::instruction::CloseSession {}.data(),
        cora_battle::accounts::CloseSession {
            authority: authority.pubkey(),
            battle_session: session_pda,
        }.to_account_metas(None),
    );
    send_tx(svm, &[ix], authority, &[authority])
}

/// Helper to create a card_id from a u8 index
pub fn card_id_from_index(index: u8) -> [u8; 16] {
    let mut id = [0u8; 16];
    id[0] = index;
    id
}

/// Full setup: session + N cards + activate → returns (session_pda, vec of card_pdas)
pub fn setup_active_battle(
    svm: &mut LiteSVM, pid: Pubkey, authority: &Keypair,
    player_a: Pubkey, player_b: Pubkey,
    match_id: [u8; 32], num_cards: u8, damage: u16,
) -> (Pubkey, Vec<Pubkey>) {
    let session_pda = do_create_session(
        svm, pid, authority, player_a, player_b, match_id, [0u8; 32],
    );
    let mut card_pdas = Vec::new();
    for i in 0..num_cards {
        let card_id = card_id_from_index(i);
        let card_pda = do_register_card(svm, pid, authority, session_pda, card_id, damage);
        card_pdas.push(card_pda);
    }
    do_activate_session(svm, pid, authority, session_pda);
    (session_pda, card_pdas)
}
