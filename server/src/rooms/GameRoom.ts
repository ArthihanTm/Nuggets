import { Room, Client } from "@colyseus/core";
import { GameState, Player } from "./schema/GameState";
import {
  PLATFORMS,
  SPAWN_POINTS,
  PLAYER_COLORS,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from "../level";

interface PlayerInput {
  left: boolean;
  right: boolean;
  jump: boolean;
}

interface JoinOptions {
  name?: string;
}

const TICK_RATE = 60; // server physics steps per second
const GRAVITY = 1800; // px/s^2
const MOVE_SPEED = 240; // px/s
const JUMP_VELOCITY = -650; // px/s (negative = upward)

export class GameRoom extends Room<GameState> {
  maxClients = 4;

  private inputs = new Map<string, PlayerInput>();

  onCreate() {
    this.setState(new GameState());

    this.onMessage("input", (client, message: PlayerInput) => {
      // Trust nothing from the client except "which buttons are held" —
      // all actual movement/physics is computed here on the server.
      this.inputs.set(client.sessionId, {
        left: !!message?.left,
        right: !!message?.right,
        jump: !!message?.jump,
      });
    });

    this.setSimulationInterval((deltaMs) => this.update(deltaMs), 1000 / TICK_RATE);
  }

  onJoin(client: Client, options: JoinOptions) {
    const index = this.state.players.size;
    const spawn = SPAWN_POINTS[index % SPAWN_POINTS.length];

    const player = new Player();
    player.x = spawn.x;
    player.y = spawn.y;
    player.name = (options?.name ?? "").slice(0, 16) || `Player ${index + 1}`;
    player.color = PLAYER_COLORS[index % PLAYER_COLORS.length];

    this.state.players.set(client.sessionId, player);
    this.inputs.set(client.sessionId, { left: false, right: false, jump: false });

    console.log(`${player.name} joined (${client.sessionId}) — ${this.state.players.size}/${this.maxClients}`);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
  }

  private update(deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000; // clamp in case of a stutter

    this.state.players.forEach((player, sessionId) => {
      const input = this.inputs.get(sessionId) ?? { left: false, right: false, jump: false };

      // --- horizontal movement ---
      if (input.left && !input.right) {
        player.vx = -MOVE_SPEED;
        player.facing = -1;
      } else if (input.right && !input.left) {
        player.vx = MOVE_SPEED;
        player.facing = 1;
      } else {
        player.vx = 0;
      }

      // --- gravity ---
      player.vy += GRAVITY * dt;

      // --- jump ---
      if (input.jump && player.grounded) {
        player.vy = JUMP_VELOCITY;
        player.grounded = false;
      }

      // --- integrate position ---
      const prevFeetY = player.y;
      let nextX = player.x + player.vx * dt;
      let nextY = player.y + player.vy * dt;

      nextX = Math.max(PLAYER_WIDTH / 2, Math.min(WORLD_WIDTH - PLAYER_WIDTH / 2, nextX));

      // --- platform collision (landing on top only — good enough for a starter) ---
      player.grounded = false;
      for (const platform of PLATFORMS) {
        const withinX =
          nextX + PLAYER_WIDTH / 2 > platform.x && nextX - PLAYER_WIDTH / 2 < platform.x + platform.width;
        if (!withinX) continue;

        const platformTop = platform.y;
        if (player.vy >= 0 && prevFeetY <= platformTop + 1 && nextY >= platformTop) {
          nextY = platformTop;
          player.vy = 0;
          player.grounded = true;
        }
      }

      player.x = nextX;
      player.y = nextY;

      // --- fell off the world -> respawn ---
      if (player.y > WORLD_HEIGHT + 200) {
        const spawn = SPAWN_POINTS[0];
        player.x = spawn.x;
        player.y = spawn.y;
        player.vx = 0;
        player.vy = 0;
      }
    });
  }
}
