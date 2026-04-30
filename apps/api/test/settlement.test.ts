import { test, expect, describe } from 'bun:test';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { buildSettlementMessage, deriveMatchId } from '@shared/escrow';
import { signSettlementAuthorization, serverPublicKey } from '../src/utils/settlement';

describe('settlement', () => {
  test('serverPublicKey is a valid base58 string', () => {
    expect(typeof serverPublicKey).toBe('string');
    expect(serverPublicKey.length).toBeGreaterThan(30);
    // Should be decodable as base58
    const decoded = bs58.decode(serverPublicKey);
    expect(decoded.length).toBe(32);
  });

  test('signSettlementAuthorization produces a valid signature', () => {
    const matchId = deriveMatchId('test-room-settlement');
    const winner = 'WinnerPubkeyBase58Mock1111111111111111111111';

    const sig = signSettlementAuthorization(matchId, winner);

    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);

    // Decode and verify signature length (ed25519 = 64 bytes)
    const sigBytes = bs58.decode(sig);
    expect(sigBytes.length).toBe(64);
  });

  test('signature is deterministic for same inputs', () => {
    const matchId = deriveMatchId('deterministic-room');
    const winner = 'SameWinner111111111111111111111111111111111';

    const sig1 = signSettlementAuthorization(matchId, winner);
    const sig2 = signSettlementAuthorization(matchId, winner);

    expect(sig1).toBe(sig2);
  });

  test('different inputs produce different signatures', () => {
    const matchId1 = deriveMatchId('room-A');
    const matchId2 = deriveMatchId('room-B');
    const winner = 'Winner1111111111111111111111111111111111111';

    const sig1 = signSettlementAuthorization(matchId1, winner);
    const sig2 = signSettlementAuthorization(matchId2, winner);

    expect(sig1).not.toBe(sig2);
  });

  test('signature verifies against server public key', () => {
    const matchId = deriveMatchId('verify-room');
    const winner = 'VerifyWinner1111111111111111111111111111111';

    const sig = signSettlementAuthorization(matchId, winner);

    // Reconstruct message the same way
    const message = buildSettlementMessage(matchId, winner);
    const messageBytes = Buffer.from(message, 'utf-8');
    const sigBytes = bs58.decode(sig);
    const pubKeyBytes = bs58.decode(serverPublicKey);

    const valid = nacl.sign.detached.verify(messageBytes, sigBytes, pubKeyBytes);
    expect(valid).toBe(true);
  });

  test('settlement message format matches shared escrow spec', () => {
    const matchId = deriveMatchId('format-room');
    const winner = 'FormatWinner11111111111111111111111111111111';

    const message = buildSettlementMessage(matchId, winner);
    const matchIdHex = Buffer.from(matchId).toString('hex');

    expect(message).toBe(`SETTLE:${matchIdHex}:${winner}`);
  });
});

describe('deriveMatchId', () => {
  test('produces 32-byte Uint8Array', () => {
    const id = deriveMatchId('room-123');
    expect(id).toBeInstanceOf(Uint8Array);
    expect(id.length).toBe(32);
  });

  test('is deterministic', () => {
    const a = deriveMatchId('room-xyz');
    const b = deriveMatchId('room-xyz');
    expect(a).toEqual(b);
  });

  test('different room IDs produce different match IDs', () => {
    const a = deriveMatchId('room-1');
    const b = deriveMatchId('room-2');
    expect(a).not.toEqual(b);
  });
});
