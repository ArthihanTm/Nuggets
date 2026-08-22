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
const BOSS_TIMEOUT_MS = 30_000;

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

async function waitForBossAction(room, expectedAction, label, timeoutMs = BOSS_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const boss = room.state?.boss;
    if (boss?.action === expectedAction) return boss;
    await sleep(20);
  }
  throw new Error(`${label}: boss never entered ${expectedAction}`);
}

async function waitForBossFrame(room, expectedAction, expectedFrame, label) {
  const deadline = Date.now() + BOSS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const boss = room.state?.boss;
    if (boss?.action === expectedAction && boss.attackFrame === expectedFrame) return;
    await sleep(20);
  }
  throw new Error(`${label}: boss never reached ${expectedAction} frame ${expectedFrame}`);
}

async function waitForProjectileBurst(room, label) {
  const deadline = Date.now() + BOSS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const projectiles = room.state?.bossProjectiles;
    if (projectiles?.size === 8) {
      for (const projectile of projectiles.values()) {
        assert(
          [projectile.x, projectile.y, projectile.vx, projectile.vy].every(Number.isFinite),
          `${label}: projectile state should contain finite position and velocity`,
        );
        const speed = Math.hypot(projectile.vx, projectile.vy);
        assert(
          Math.abs(speed - 110) < 0.01,
          `${label}: projectile should retain the configured constant speed`,
        );
      }
      return;
    }
    await sleep(20);
  }
  throw new Error(`${label}: expected an eight-projectile burst`);
}

async function waitForProjectilesToDespawn(room, label) {
  const deadline = Date.now() + BOSS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (room.state?.bossProjectiles?.size === 0) return;
    await sleep(50);
  }
  throw new Error(`${label}: projectiles did not leave the world bounds`);
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

  assert(
    typeof playerA.room.state.boss?.action === "string",
    "Boss should expose a synchronized action",
  );
  assert(
    Number.isInteger(playerA.room.state.boss?.attackFrame),
    "Boss should expose a synchronized integer attack frame",
  );
  assert(
    playerA.room.state.bossProjectiles?.size === 0,
    "Boss projectile map should exist and start empty",
  );
  console.log("OK: boss combat state is synchronized");

  playerA.room.send("input", { left: false, right: true, jump: false });
  const movedOnServer = await waitForMovement(playerA.room, playerA.room.sessionId, "PlayerA");
  const movedOnPeer = await waitForMovement(playerB.room, playerA.room.sessionId, "PlayerB view of A");

  assert(movedOnPeer > 0, "Peer should receive PlayerA movement via state sync");
  console.log(`OK: PlayerA moved ${movedOnServer.toFixed(0)}px; PlayerB observed ${movedOnPeer.toFixed(0)}px`);

  await waitForBossAction(playerA.room, "stomp", "stomp attack");
  await waitForBossFrame(playerA.room, "stomp", 5, "stomp impact");
  await waitForBossAction(playerA.room, "cast", "second boss attack");
  await waitForBossFrame(playerA.room, "cast", 5, "cast release");
  await waitForProjectileBurst(playerA.room, "light-orb attack");
  await waitForProjectilesToDespawn(playerA.room, "light-orb attack");
  console.log("OK: boss alternates attacks, emits eight projectiles, and despawns them at bounds");

  await playerA.room.leave();
  await playerB.room.leave();
  console.log("OK: multiplayer test passed");
}

main().catch((err) => {
  console.error("FAIL:", err.message ?? err);
  process.exit(1);
});
