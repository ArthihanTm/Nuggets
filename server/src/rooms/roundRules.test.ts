import assert from "node:assert/strict";
import test from "node:test";

import {
  canStartRound,
  isPlayingPhase,
  isRoundWon,
  isTeamWiped,
  type RoundEnemy,
  type RoundPhase,
  type RoundPlayer,
} from "./roundRules";

test("round starts only at the exact target count when every player is ready", () => {
  const readyPlayer: RoundPlayer = { ready: true, alive: true };
  const unreadyPlayer: RoundPlayer = { ready: false, alive: true };

  assert.equal(canStartRound([], 2), false);
  assert.equal(canStartRound([readyPlayer], 2), false);
  assert.equal(canStartRound([readyPlayer, unreadyPlayer], 2), false);
  assert.equal(canStartRound([readyPlayer, readyPlayer], 2), true);
  assert.equal(canStartRound([readyPlayer, readyPlayer, readyPlayer], 2), false);
});

test("only the playing phase is considered active gameplay", () => {
  const phases: RoundPhase[] = ["title", "playing", "won", "lost"];

  assert.deepEqual(
    phases.map((phase) => isPlayingPhase(phase)),
    [false, true, false, false],
  );
});

test("team defeat requires a non-empty roster with every player dead", () => {
  const alivePlayer: RoundPlayer = { ready: true, alive: true };
  const deadPlayer: RoundPlayer = { ready: true, alive: false };

  assert.equal(isTeamWiped([]), false);
  assert.equal(isTeamWiped([alivePlayer, deadPlayer]), false);
  assert.equal(isTeamWiped([deadPlayer, deadPlayer]), true);
});

test("round victory requires a dead boss and no living enemies", () => {
  const aliveEnemy: RoundEnemy = { alive: true };
  const deadEnemy: RoundEnemy = { alive: false };

  assert.equal(isRoundWon(true, []), false);
  assert.equal(isRoundWon(false, [deadEnemy, aliveEnemy]), false);
  assert.equal(isRoundWon(false, [deadEnemy, deadEnemy]), true);
  assert.equal(isRoundWon(false, []), true);
});
