export type RoundPhase = "title" | "playing" | "won" | "lost";

export interface RoundPlayer {
  ready: boolean;
  alive: boolean;
}

export interface RoundEnemy {
  alive: boolean;
}

export function isPlayingPhase(phase: RoundPhase): boolean {
  return phase === "playing";
}

export function canStartRound(
  players: Iterable<RoundPlayer>,
  targetPlayers: number,
): boolean {
  const entries = Array.from(players);
  return (
    entries.length === targetPlayers && entries.every((entry) => entry.ready)
  );
}

export function isTeamWiped(players: Iterable<RoundPlayer>): boolean {
  const entries = Array.from(players);
  return entries.length > 0 && entries.every((entry) => !entry.alive);
}

export function isRoundWon(
  bossAlive: boolean,
  enemies: Iterable<RoundEnemy>,
): boolean {
  return !bossAlive && Array.from(enemies).every((entry) => !entry.alive);
}
