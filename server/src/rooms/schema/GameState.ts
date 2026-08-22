import { Schema, type, MapSchema } from "@colyseus/schema";

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
  @type("number") coins = 0;
}

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}
