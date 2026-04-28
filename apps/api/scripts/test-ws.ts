// test-ws.ts
// Run this with `bun run scripts/test-ws.ts` after starting the dev server

async function fetchMatch(address: string): Promise<string> {
  const res = await fetch('http://localhost:8080/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address })
  });
  const data = await res.json() as { roomId?: string, error?: string };
  if (data.error || !data.roomId) {
    throw new Error(`Failed to match for ${address}: ${data.error}`);
  }
  return data.roomId;
}

async function runTest() {
  console.log('--- Starting WebSocket Test ---');
  
  // 1. Get a roomId from matchmaking concurrently
  console.log('1. Fetching match roomId concurrently for Alice and Bob...');
  
  const [roomIdAlice, roomIdBob] = await Promise.all([
    fetchMatch('alice'),
    fetchMatch('bob')
  ]);
  
  console.log(`Got roomId Alice: ${roomIdAlice}`);
  console.log(`Got roomId Bob: ${roomIdBob}`);
  
  if (roomIdAlice !== roomIdBob) {
    throw new Error('Room IDs do not match! Matchmaking failed.');
  }
  
  const roomId = roomIdAlice;

  let aliceHand: any[] = [];
  let bobHand: any[] = [];

  // 2. Connect Player 1
  console.log('2. Connecting Player 1 (alice)...');
  const ws1 = new WebSocket(`ws://localhost:8080/match/${roomId}?address=alice`);
  
  ws1.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type !== 'timerSync' && data.type !== 'cardCountdown') {
       console.log(`[Alice] Received:`, data.type);
    }
    if (data.type === 'gameStateUpdate' && data.payload?.hand?.length > 0) {
      aliceHand = data.payload.hand;
    }
    if (data.type === 'cardCountdown') {
      console.log(`[Alice] Countdown: ${data.payload.remainingMs}ms`);
    }
    if (data.type === 'matchResult') {
      console.log(`[Alice] Match Result Payload:`, data.payload);
    }
  };

  // Wait a bit
  await new Promise(r => setTimeout(r, 500));

  // 3. Connect Player 2
  console.log('3. Connecting Player 2 (bob)...');
  const ws2 = new WebSocket(`ws://localhost:8080/match/${roomId}?address=bob`);
  
  ws2.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type !== 'timerSync' && data.type !== 'cardCountdown') {
      console.log(`[Bob] Received:`, data.type);
    }
    if (data.type === 'gameStateUpdate' && data.payload?.hand?.length > 0) {
      bobHand = data.payload.hand;
    }
    if (data.type === 'matchResult') {
      console.log(`[Bob] Match Result Payload:`, data.payload);
    }
  };

  await new Promise(r => setTimeout(r, 500));

  // 4. Send confirmDeposit for Alice and Bob
  console.log('4. Alice and Bob confirming deposits...');
  ws1.send(JSON.stringify({
    type: 'confirmDeposit',
    payload: { signature: 'sig_alice_123' }
  }));
  ws2.send(JSON.stringify({
    type: 'confirmDeposit',
    payload: { signature: 'sig_bob_456' }
  }));

  await new Promise(r => setTimeout(r, 1000));

  while (aliceHand.length === 0) {
    await new Promise(r => setTimeout(r, 100));
  }

  // 5. Alice opens a card
  const cardToPlay = aliceHand[0];
  console.log(`\n5. Alice opening card ${cardToPlay.id}...`);
  ws1.send(JSON.stringify({
    type: 'openCard',
    payload: { cardId: cardToPlay.id }
  }));

  // Wait 3 seconds to see countdown ticks
  await new Promise(r => setTimeout(r, 3000));

  // 6. Alice answers the card
  console.log(`\n6. Alice answering the card...`);
  ws1.send(JSON.stringify({
    type: 'playCard',
    payload: { cardId: cardToPlay.id, selectedOptionId: cardToPlay.question.options[0].id }
  }));

  await new Promise(r => setTimeout(r, 1000));

  // 7. Alice opens another card but lets it timeout
  const nextCard = aliceHand[1]; // using original hand reference, might be stale but IDs usually persist or we just use [1]
  console.log(`\n7. Alice opening card ${nextCard.id} and waiting for timeout (10s)...`);
  ws1.send(JSON.stringify({
    type: 'openCard',
    payload: { cardId: nextCard.id }
  }));

  // Wait for 11 seconds to guarantee expiry
  await new Promise(r => setTimeout(r, 11000));

  console.log('\n--- Test Finished ---');
  ws1.close();
  ws2.close();
  process.exit(0);
}

runTest().catch(console.error);
