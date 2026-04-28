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

  // 2. Connect Player 1
  console.log('2. Connecting Player 1 (alice)...');
  const ws1 = new WebSocket(`ws://localhost:8080/match/${roomId}?address=alice`);
  
  ws1.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log(`[Alice] Received:`, data.type);
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
    console.log(`[Bob] Received:`, data.type, data.payload?.status || '');
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

  await new Promise(r => setTimeout(r, 500));

  // 5. Bob plays a card
  console.log('5. Bob playing a card...');
  ws2.send(JSON.stringify({
    type: 'playCard',
    payload: { cardId: 'mock-card-id', selectedOptionIndex: 0 }
  }));

  await new Promise(r => setTimeout(r, 1500));

  // 6. Bob disconnects
  console.log('6. Bob disconnecting...');
  ws2.close();

  await new Promise(r => setTimeout(r, 1000));

  // 7. Bob reconnects
  console.log('7. Bob reconnecting...');
  const ws3 = new WebSocket(`ws://localhost:8080/match/${roomId}?address=bob`);
  
  ws3.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log(`[Bob Reconnected] Received:`, data.type, data.payload?.status);
  };

  await new Promise(r => setTimeout(r, 1500));

  console.log('--- Test Finished ---');
  ws1.close();
  ws3.close();
  process.exit(0);
}

runTest().catch(console.error);
