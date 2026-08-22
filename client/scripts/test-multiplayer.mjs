/**
 * Headless multiplayer smoke test.
 * Requires the Colyseus server: cd server && npm run dev
 *
 * Usage: npm run test:multiplayer
 *        SERVER_URL=ws://localhost:2567 npm run test:multiplayer
 */
import { Client } from "colyseus.js";

const SERVER = process.env.SERVER_URL ?? "ws://localhost:2567";
const TIMEOUT_MS = 10_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function join(name) {
  const client = new Client(SERVER);
  const room = await client.joinOrCreate("game", { name });
  return { client, room, name };
}

async function waitForPlayerCount(room, expected, label) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const count = room.state?.players?.size ?? 0;
    if (count >= expected) return count;
    await sleep(50);
  }
  throw new Error(`${label}: expected ${expected} players in room, timed out`);
}

async function waitForMovement(room, sessionId, label) {
  const deadline = Date.now() + TIMEOUT_MS;
  let startX = null;

  while (Date.now() < deadline) {
    const player = room.state?.players?.get?.(sessionId);
    if (!player) {
      await sleep(50);
      continue;
    }
    if (startX === null) startX = player.x;
    if (player.x > startX + 5) return player.x - startX;
    await sleep(50);
  }

  throw new Error(`${label}: player did not move after input`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log(`Connecting to ${SERVER} ...`);

  const playerA = await join("PlayerA");
  await waitForPlayerCount(playerA.room, 1, "PlayerA");

  const playerB = await join("PlayerB");
  await waitForPlayerCount(playerA.room, 2, "PlayerA (after B joined)");
  await waitForPlayerCount(playerB.room, 2, "PlayerB");

  const aInB = playerB.room.state.players.get(playerA.room.sessionId);
  const bInA = playerA.room.state.players.get(playerB.room.sessionId);

  assert(aInB?.name === "PlayerA", "PlayerB should see PlayerA in synced state");
  assert(bInA?.name === "PlayerB", "PlayerA should see PlayerB in synced state");
  console.log("OK: both clients share the same room state (2 players visible)");

  playerA.room.send("input", { left: false, right: true, jump: false });
  const movedOnServer = await waitForMovement(playerA.room, playerA.room.sessionId, "PlayerA");
  const movedOnPeer = await waitForMovement(playerB.room, playerA.room.sessionId, "PlayerB view of A");

  assert(movedOnPeer > 0, "Peer should receive PlayerA movement via state sync");
  console.log(`OK: PlayerA moved ${movedOnServer.toFixed(0)}px; PlayerB observed ${movedOnPeer.toFixed(0)}px`);

  await playerA.room.leave();
  await playerB.room.leave();
  console.log("OK: multiplayer test passed");
}

main().catch((err) => {
  console.error("FAIL:", err.message ?? err);
  process.exit(1);
});
