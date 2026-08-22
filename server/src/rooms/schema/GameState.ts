import { Schema, type, MapSchema } from "@colyseus/schema";
import type { RoundPhase } from "../roundRules";

/**
 * State of a single player, synced to every client in the room.
 * `x` / `y` describe the player's FEET position (bottom-center of the
 * sprite) — this matches Phaser's default sprite origin (0.5, 1) that
 * the client uses, so no conversion is needed when rendering.
 */
export class Player extends Schema {
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") vx = 0;
  @type("number") vy = 0;
  @type("boolean") grounded = false;
  @type("number") facing = 1; // 1 = right, -1 = left
  @type("number") color = 0xffffff;
  @type("number") lives = 3;
  @type("boolean") alive = true;
  @type("number") invulnRemaining = 0;
  @type("number") featherCooldown = 0;
  @type("number") spawnIndex = 0;
  @type("boolean") ready = false;
}

export class Enemy extends Schema {
  @type("string") id = "";
  @type("string") kind = "raven";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") baseY = 0;
  @type("number") vx = 0;
  @type("number") facing = 1; // 1 = right, -1 = left
  @type("boolean") alive = true;
  @type("number") featherHits = 3;
}

/** Single end-boss — one instance per room, not a map. */
export class Boss extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") facing = 1; // 1 = right, -1 = left
  @type("boolean") waiting = false; // true while paused on a platform (frontal view)
  @type("string") action = "travel";
  @type("number") attackFrame = 0;
  @type("number") hp = 15;
  @type("boolean") alive = true;
}

export class BossProjectile extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") vx = 0;
  @type("number") vy = 0;
}

export class Feather extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") vx = 0;
  @type("string") ownerId = "";
}

export class Nugget extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("boolean") active = true;
}

export class GameState extends Schema {
  @type("string") phase: RoundPhase = "title";
  @type("number") targetPlayers = 1;
  @type("string") lobbyOwnerId = "";
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Enemy }) enemies = new MapSchema<Enemy>();
  @type(Boss) boss = new Boss();
  @type({ map: BossProjectile }) bossProjectiles = new MapSchema<BossProjectile>();
  @type({ map: Feather }) feathers = new MapSchema<Feather>();
  @type({ map: Nugget }) nuggets = new MapSchema<Nugget>();
}
