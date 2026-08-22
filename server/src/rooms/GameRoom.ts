import { Room, Client } from "@colyseus/core";
import {
  GameState,
  Player,
  Enemy,
  BossProjectile,
  Feather,
  Nugget,
} from "./schema/GameState";
import {
  PLATFORMS,
  SPAWN_POINTS,
  PLAYER_COLORS,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  RAVEN_SPAWNS,
  ANT_SPAWNS,
  BOSS_WAYPOINTS,
  BOSS_WIDTH,
  BOSS_HEIGHT,
  RAVEN_WIDTH,
  RAVEN_HEIGHT,
  ANT_WIDTH,
  ANT_HEIGHT,
  NUGGET_SPAWNS,
} from "../level";

interface PlayerInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  shoot: boolean;
}

interface JoinOptions {
  name?: string;
}

const TICK_RATE = 60;
const GRAVITY = 1800;
const MOVE_SPEED = 240;
const JUMP_VELOCITY = -720;
const RAVEN_SPEED = 90;
const ANT_SPEED = 150;
const RAVEN_BOB_AMPLITUDE = 18;
const RAVEN_BOB_SPEED = 2.2;
const BOSS_SPEED = 90;
const BOSS_WAIT_DURATION = 1.4;
const BOSS_ATTACK_FPS = 8;
const BOSS_ATTACK_FRAMES = 6;
const BOSS_RECOVERY_DURATION = 0.6;
const BOSS_STOMP_HEIGHT = 72;
const BOSS_SHOCKWAVE_RADIUS = 180;
const BOSS_SHOCKWAVE_HEIGHT = 64;
const BOSS_PROJECTILE_SPEED = 110;
const BOSS_PROJECTILE_SIZE = 24;
const LEDGE_SNAP_TOLERANCE = 36;

// --- combat constants ---
const DUCK_MAX_LIVES = 3;
const INVULNERABLE_TIME = 1.0;
const FEATHER_COOLDOWN = 0.5;
const ENEMY_FEATHER_HITS = 3;
const BOSS_MAX_HP = 15;
const FEATHER_SPEED = 480;
const FEATHER_WIDTH = 16;
const FEATHER_HEIGHT = 8;
const FEATHER_SPAWN_OFFSET_X = 20;
const FEATHER_SPAWN_OFFSET_Y = 28;
const NUGGET_PICKUP_RADIUS = 20;

function aabbOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  const aLeft = ax - aw / 2;
  const aRight = ax + aw / 2;
  const aTop = ay - ah;
  const aBottom = ay;
  const bLeft = bx - bw / 2;
  const bRight = bx + bw / 2;
  const bTop = by - bh;
  const bBottom = by;
  return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
}

function enemySize(kind: string): { w: number; h: number } {
  return kind === "ant" ? { w: ANT_WIDTH, h: ANT_HEIGHT } : { w: RAVEN_WIDTH, h: RAVEN_HEIGHT };
}

export class GameRoom extends Room<GameState> {
  maxClients = 4;

  private inputs = new Map<string, PlayerInput>();
  private prevJump = new Map<string, boolean>();
  private prevShoot = new Map<string, boolean>();
  private featherCounter = 0;
  private simTime = 0;
  private bossWaypointIndex = 0;
  private bossTravelFrom = { x: 0, y: 0 };
  private bossTravelTo = { x: 0, y: 0 };
  private bossTravelToIndex = 0;
  private bossTravelElapsed = 0;
  private bossTravelDuration = 1;
  private bossPhaseElapsed = 0;
  private bossNextAttack: "stomp" | "cast" = "stomp";
  private bossAttackTriggered = false;
  private bossAttackLanding = { x: 0, y: 0 };
  private bossProjectileCounter = 0;

  onCreate() {
    this.setState(new GameState());
    this.spawnEnemies();
    this.spawnBoss();
    this.spawnNuggets();

    this.onMessage("input", (client, message: PlayerInput) => {
      this.inputs.set(client.sessionId, {
        left: !!message?.left,
        right: !!message?.right,
        jump: !!message?.jump,
        shoot: !!message?.shoot,
      });
    });

    this.setSimulationInterval((deltaMs) => this.update(deltaMs), 1000 / TICK_RATE);
  }

  private spawnEnemies() {
    for (const spawn of RAVEN_SPAWNS) {
      const enemy = new Enemy();
      enemy.id = spawn.id;
      enemy.kind = "raven";
      enemy.x = spawn.x;
      enemy.y = spawn.y;
      enemy.baseY = spawn.y;
      enemy.vx = RAVEN_SPEED;
      enemy.facing = 1;
      enemy.alive = true;
      enemy.featherHits = ENEMY_FEATHER_HITS;
      this.state.enemies.set(spawn.id, enemy);
    }

    for (const spawn of ANT_SPAWNS) {
      const enemy = new Enemy();
      enemy.id = spawn.id;
      enemy.kind = "ant";
      enemy.x = spawn.x;
      enemy.y = spawn.y;
      enemy.baseY = spawn.y;
      enemy.vx = ANT_SPEED;
      enemy.facing = 1;
      enemy.alive = true;
      enemy.featherHits = ENEMY_FEATHER_HITS;
      this.state.enemies.set(spawn.id, enemy);
    }
  }

  private spawnBoss() {
    const start = BOSS_WAYPOINTS[0];
    this.state.boss.x = start.x;
    this.state.boss.y = start.y;
    this.state.boss.facing = 1;
    this.state.boss.waiting = false;
    this.state.boss.action = "travel";
    this.state.boss.attackFrame = 0;
    this.state.boss.hp = BOSS_MAX_HP;
    this.state.boss.alive = true;
    this.bossWaypointIndex = 0;
    this.bossTravelFrom = { x: start.x, y: start.y };
    this.bossTravelTo = { x: start.x, y: start.y };
    this.bossTravelToIndex = 0;
    this.bossTravelElapsed = 0;
    this.bossTravelDuration = 1;
    this.bossPhaseElapsed = 0;
    this.bossNextAttack = "stomp";
    this.bossAttackTriggered = false;
    this.bossAttackLanding = { x: start.x, y: start.y };
    this.bossProjectileCounter = 0;
  }

  private spawnNuggets() {
    for (const spawn of NUGGET_SPAWNS) {
      const nugget = new Nugget();
      nugget.x = spawn.x;
      nugget.y = spawn.y;
      nugget.active = true;
      this.state.nuggets.set(spawn.id, nugget);
    }
  }

  private beginBossTravel(
    from: { x: number; y: number },
    to: { x: number; y: number },
    toIndex: number,
  ) {
    this.bossTravelFrom = { x: from.x, y: from.y };
    this.bossTravelTo = { x: to.x, y: to.y };
    this.bossTravelToIndex = toIndex;
    this.bossTravelElapsed = 0;

    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    this.bossTravelDuration = Math.max(1.2, distance / BOSS_SPEED);
    this.state.boss.action = "travel";
    this.state.boss.attackFrame = 0;
    this.state.boss.waiting = false;
    this.state.boss.facing = to.x >= from.x ? 1 : -1;
  }

  onJoin(client: Client, options: JoinOptions) {
    const index = this.state.players.size;
    const spawn = SPAWN_POINTS[index % SPAWN_POINTS.length];

    const player = new Player();
    player.x = spawn.x;
    player.y = spawn.y;
    player.name = (options?.name ?? "").slice(0, 16) || `Player ${index + 1}`;
    player.color = PLAYER_COLORS[index % PLAYER_COLORS.length];
    player.lives = DUCK_MAX_LIVES;
    player.alive = true;
    player.spawnIndex = index;
    player.invulnRemaining = 0;
    player.featherCooldown = 0;

    this.state.players.set(client.sessionId, player);
    this.inputs.set(client.sessionId, { left: false, right: false, jump: false, shoot: false });
    this.prevJump.set(client.sessionId, false);
    this.prevShoot.set(client.sessionId, false);

    console.log(`${player.name} joined (${client.sessionId}) — ${this.state.players.size}/${this.maxClients}`);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.prevJump.delete(client.sessionId);
    this.prevShoot.delete(client.sessionId);
  }

  private update(deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000;
    this.simTime += dt;

    this.tickCooldowns(dt);
    this.updateEnemies(dt);
    if (this.state.boss.alive) {
      this.updateBoss(dt);
    }
    this.updateBossProjectiles(dt);
    this.updatePlayers(dt);
    this.processShooting(dt);
    this.updateFeathers(dt);
    this.checkPlayerEnemyCollisions();
    this.checkPlayerBossCollisions();
    this.checkNuggetPickups();
  }

  private tickCooldowns(dt: number) {
    this.state.players.forEach((player) => {
      if (player.invulnRemaining > 0) {
        player.invulnRemaining = Math.max(0, player.invulnRemaining - dt);
      }
      if (player.featherCooldown > 0) {
        player.featherCooldown = Math.max(0, player.featherCooldown - dt);
      }
    });
  }

  private updateBoss(dt: number) {
    const boss = this.state.boss;

    if (boss.action === "wait") {
      boss.waiting = true;
      this.bossPhaseElapsed += dt;
      if (this.bossPhaseElapsed >= BOSS_WAIT_DURATION) {
        boss.action = this.bossNextAttack;
        this.bossNextAttack = this.bossNextAttack === "stomp" ? "cast" : "stomp";
        boss.waiting = false;
        boss.attackFrame = 0;
        this.bossPhaseElapsed = 0;
        this.bossAttackTriggered = false;
        this.bossAttackLanding = { x: boss.x, y: boss.y };
      }
      return;
    }

    if (boss.action === "recovery") {
      boss.waiting = true;
      this.bossPhaseElapsed += dt;
      if (this.bossPhaseElapsed >= BOSS_RECOVERY_DURATION) {
        boss.action = "travel";
        boss.attackFrame = 0;
        boss.waiting = false;
        this.bossTravelElapsed = 0;
        this.bossPhaseElapsed = 0;
      }
      return;
    }

    if (boss.action === "stomp" || boss.action === "cast") {
      this.updateBossAttack(dt);
      return;
    }

    if (this.bossTravelElapsed === 0) {
      const from = BOSS_WAYPOINTS[this.bossWaypointIndex];
      const toIndex = (this.bossWaypointIndex + 1) % BOSS_WAYPOINTS.length;
      const to = BOSS_WAYPOINTS[toIndex];
      this.beginBossTravel(from, to, toIndex);
    }

    boss.waiting = false;

    this.bossTravelElapsed += dt;
    const t = Math.min(1, this.bossTravelElapsed / this.bossTravelDuration);
    const eased = t * t * (3 - 2 * t);

    boss.x = this.bossTravelFrom.x + (this.bossTravelTo.x - this.bossTravelFrom.x) * eased;

    const baseY =
      this.bossTravelFrom.y + (this.bossTravelTo.y - this.bossTravelFrom.y) * eased;
    const jumpArc = Math.abs(this.bossTravelTo.y - this.bossTravelFrom.y) + 40;
    boss.y = baseY - jumpArc * Math.sin(Math.PI * eased);

    if (t >= 1) {
      boss.x = this.bossTravelTo.x;
      boss.y = this.bossTravelTo.y;
      this.bossWaypointIndex = this.bossTravelToIndex;
      this.bossTravelElapsed = 0;
      this.bossPhaseElapsed = 0;
      boss.action = "wait";
      boss.attackFrame = 0;
      boss.waiting = true;
    }
  }

  private updateBossAttack(dt: number) {
    const boss = this.state.boss;
    const attack = boss.action as "stomp" | "cast";
    this.bossPhaseElapsed += dt;
    boss.attackFrame = Math.min(
      BOSS_ATTACK_FRAMES - 1,
      Math.floor(this.bossPhaseElapsed * BOSS_ATTACK_FPS),
    );

    if (attack === "stomp") {
      if (boss.attackFrame < BOSS_ATTACK_FRAMES - 1) {
        const impactTime = (BOSS_ATTACK_FRAMES - 1) / BOSS_ATTACK_FPS;
        const progress = Math.min(1, this.bossPhaseElapsed / impactTime);
        boss.x = this.bossAttackLanding.x;
        boss.y =
          this.bossAttackLanding.y - BOSS_STOMP_HEIGHT * Math.sin(Math.PI * progress);
      } else {
        boss.x = this.bossAttackLanding.x;
        boss.y = this.bossAttackLanding.y;
      }
    }

    if (boss.attackFrame === BOSS_ATTACK_FRAMES - 1 && !this.bossAttackTriggered) {
      this.bossAttackTriggered = true;
      if (attack === "stomp") {
        this.applyBossShockwave();
      } else {
        this.spawnBossProjectileBurst();
      }
    }

    if (this.bossPhaseElapsed >= BOSS_ATTACK_FRAMES / BOSS_ATTACK_FPS) {
      boss.action = "recovery";
      boss.attackFrame = 0;
      boss.waiting = true;
      this.bossPhaseElapsed = 0;
    }
  }

  private applyBossShockwave() {
    this.state.players.forEach((player) => {
      if (
        player.alive &&
        aabbOverlap(
          player.x,
          player.y,
          PLAYER_WIDTH,
          PLAYER_HEIGHT,
          this.bossAttackLanding.x,
          this.bossAttackLanding.y,
          BOSS_SHOCKWAVE_RADIUS * 2,
          BOSS_SHOCKWAVE_HEIGHT,
        )
      ) {
        this.applyContactDamage(player);
      }
    });
  }

  private spawnBossProjectileBurst() {
    const boss = this.state.boss;
    const originY = boss.y - BOSS_HEIGHT / 2;

    for (let index = 0; index < 8; index++) {
      const angle = (index * Math.PI) / 4;
      const projectile = new BossProjectile();
      projectile.x = boss.x;
      projectile.y = originY;
      projectile.vx = Math.cos(angle) * BOSS_PROJECTILE_SPEED;
      projectile.vy = Math.sin(angle) * BOSS_PROJECTILE_SPEED;
      this.state.bossProjectiles.set(
        `boss-projectile-${this.bossProjectileCounter++}`,
        projectile,
      );
    }
  }

  private updateBossProjectiles(dt: number) {
    const toRemove: string[] = [];
    const halfSize = BOSS_PROJECTILE_SIZE / 2;

    this.state.bossProjectiles.forEach((projectile, id) => {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;

      let hitPlayer = false;
      this.state.players.forEach((player) => {
        if (
          hitPlayer ||
          !player.alive ||
          !aabbOverlap(
            projectile.x,
            projectile.y + halfSize,
            BOSS_PROJECTILE_SIZE,
            BOSS_PROJECTILE_SIZE,
            player.x,
            player.y,
            PLAYER_WIDTH,
            PLAYER_HEIGHT,
          )
        ) {
          return;
        }

        this.applyContactDamage(player);
        hitPlayer = true;
      });

      if (
        hitPlayer ||
        projectile.x + halfSize < 0 ||
        projectile.x - halfSize > WORLD_WIDTH ||
        projectile.y + halfSize < 0 ||
        projectile.y - halfSize > WORLD_HEIGHT
      ) {
        toRemove.push(id);
      }
    });

    for (const id of toRemove) {
      this.state.bossProjectiles.delete(id);
    }
  }

  private updateEnemies(dt: number) {
    for (const spawn of RAVEN_SPAWNS) {
      const enemy = this.state.enemies.get(spawn.id);
      if (!enemy || !enemy.alive) continue;

      enemy.x += enemy.vx * dt;

      if (enemy.x <= spawn.minX) {
        enemy.x = spawn.minX;
        enemy.vx = RAVEN_SPEED;
        enemy.facing = 1;
      } else if (enemy.x >= spawn.maxX) {
        enemy.x = spawn.maxX;
        enemy.vx = -RAVEN_SPEED;
        enemy.facing = -1;
      }

      enemy.y = enemy.baseY + Math.sin(this.simTime * RAVEN_BOB_SPEED + spawn.x) * RAVEN_BOB_AMPLITUDE;
    }

    for (const spawn of ANT_SPAWNS) {
      const enemy = this.state.enemies.get(spawn.id);
      if (!enemy || !enemy.alive) continue;

      enemy.x += enemy.vx * dt;
      enemy.y = spawn.y;

      if (enemy.x <= spawn.minX) {
        enemy.x = spawn.minX;
        enemy.vx = ANT_SPEED;
        enemy.facing = 1;
      } else if (enemy.x >= spawn.maxX) {
        enemy.x = spawn.maxX;
        enemy.vx = -ANT_SPEED;
        enemy.facing = -1;
      }
    }
  }

  private updatePlayers(dt: number) {
    this.state.players.forEach((player, sessionId) => {
      if (!player.alive) {
        player.vx = 0;
        player.vy = 0;
        return;
      }

      const input = this.inputs.get(sessionId) ?? {
        left: false,
        right: false,
        jump: false,
        shoot: false,
      };

      if (input.left && !input.right) {
        player.vx = -MOVE_SPEED;
        player.facing = -1;
      } else if (input.right && !input.left) {
        player.vx = MOVE_SPEED;
        player.facing = 1;
      } else {
        player.vx = 0;
      }

      player.vy += GRAVITY * dt;

      const jumpPressed = input.jump && !this.prevJump.get(sessionId);
      this.prevJump.set(sessionId, input.jump);
      if (jumpPressed && player.grounded) {
        player.vy = JUMP_VELOCITY;
        player.grounded = false;
      }

      const prevFeetY = player.y;
      let nextX = player.x + player.vx * dt;
      let nextY = player.y + player.vy * dt;

      nextX = Math.max(PLAYER_WIDTH / 2, Math.min(WORLD_WIDTH - PLAYER_WIDTH / 2, nextX));

      player.grounded = false;
      for (const platform of PLATFORMS) {
        const withinX =
          nextX + PLAYER_WIDTH / 2 > platform.x && nextX - PLAYER_WIDTH / 2 < platform.x + platform.width;
        if (!withinX) continue;

        const platformTop = platform.y;
        if (player.vy >= 0 && prevFeetY <= platformTop + LEDGE_SNAP_TOLERANCE && nextY >= platformTop) {
          nextY = platformTop;
          player.vy = 0;
          player.grounded = true;
        }
      }

      player.x = nextX;
      player.y = nextY;

      if (player.y > WORLD_HEIGHT + 200) {
        this.respawnAtSpawn(player);
      }
    });
  }

  private respawnAtSpawn(player: Player) {
    const spawn = SPAWN_POINTS[player.spawnIndex % SPAWN_POINTS.length];
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
  }

  private processShooting(_dt: number) {
    this.state.players.forEach((player, sessionId) => {
      if (!player.alive) {
        this.prevShoot.set(sessionId, false);
        return;
      }

      const input = this.inputs.get(sessionId);
      const shootPressed = !!(input?.shoot && !this.prevShoot.get(sessionId));
      this.prevShoot.set(sessionId, !!input?.shoot);

      if (!shootPressed || player.featherCooldown > 0) return;

      const feather = new Feather();
      feather.x = player.x + player.facing * FEATHER_SPAWN_OFFSET_X;
      feather.y = player.y - FEATHER_SPAWN_OFFSET_Y;
      feather.vx = player.facing * FEATHER_SPEED;
      feather.ownerId = sessionId;

      const id = `feather-${this.featherCounter++}`;
      this.state.feathers.set(id, feather);
      player.featherCooldown = FEATHER_COOLDOWN;
    });
  }

  private updateFeathers(dt: number) {
    const toRemove: string[] = [];

    this.state.feathers.forEach((feather, id) => {
      feather.x += feather.vx * dt;

      if (
        feather.x < -FEATHER_WIDTH ||
        feather.x > WORLD_WIDTH + FEATHER_WIDTH ||
        feather.y < -FEATHER_HEIGHT ||
        feather.y > WORLD_HEIGHT + FEATHER_HEIGHT
      ) {
        toRemove.push(id);
        return;
      }

      for (const platform of PLATFORMS) {
        if (
          feather.x + FEATHER_WIDTH / 2 > platform.x &&
          feather.x - FEATHER_WIDTH / 2 < platform.x + platform.width &&
          feather.y >= platform.y &&
          feather.y <= platform.y + platform.height
        ) {
          toRemove.push(id);
          return;
        }
      }

      if (this.state.boss.alive) {
        const boss = this.state.boss;
        if (
          aabbOverlap(
            feather.x,
            feather.y,
            FEATHER_WIDTH,
            FEATHER_HEIGHT,
            boss.x,
            boss.y,
            BOSS_WIDTH,
            BOSS_HEIGHT,
          )
        ) {
          boss.hp--;
          if (boss.hp <= 0) {
            boss.hp = 0;
            boss.alive = false;
            boss.action = "recovery";
            boss.attackFrame = 0;
            boss.waiting = true;
          }
          toRemove.push(id);
          return;
        }
      }

      this.state.enemies.forEach((enemy) => {
        if (!enemy.alive || toRemove.includes(id)) return;
        const { w, h } = enemySize(enemy.kind);
        if (aabbOverlap(feather.x, feather.y, FEATHER_WIDTH, FEATHER_HEIGHT, enemy.x, enemy.y, w, h)) {
          enemy.featherHits--;
          if (enemy.featherHits <= 0) {
            enemy.alive = false;
          }
          if (!toRemove.includes(id)) toRemove.push(id);
        }
      });
    });

    for (const id of toRemove) {
      this.state.feathers.delete(id);
    }
  }

  private isStomp(player: Player, enemy: Enemy): boolean {
    if (player.vy <= 0) return false;
    const { h } = enemySize(enemy.kind);
    const enemyCenterY = enemy.y - h / 2;
    return player.y > enemyCenterY;
  }

  private applyContactDamage(player: Player) {
    if (!player.alive || player.invulnRemaining > 0) return;

    player.lives--;
    player.invulnRemaining = INVULNERABLE_TIME;

    if (player.lives <= 0) {
      player.lives = 0;
      player.alive = false;
      this.respawnAtSpawn(player);
    }
  }

  private checkPlayerEnemyCollisions() {
    this.state.players.forEach((player) => {
      if (!player.alive) return;

      this.state.enemies.forEach((enemy) => {
        if (!enemy.alive) return;

        const { w, h } = enemySize(enemy.kind);
        if (!aabbOverlap(player.x, player.y, PLAYER_WIDTH, PLAYER_HEIGHT, enemy.x, enemy.y, w, h)) {
          return;
        }

        if (this.isStomp(player, enemy)) {
          enemy.alive = false;
          player.vy = JUMP_VELOCITY * 0.35;
          player.grounded = false;
          return;
        }

        this.applyContactDamage(player);
      });
    });
  }

  private checkPlayerBossCollisions() {
    if (!this.state.boss.alive) return;

    const boss = this.state.boss;
    this.state.players.forEach((player) => {
      if (!player.alive) return;

      if (
        !aabbOverlap(
          player.x,
          player.y,
          PLAYER_WIDTH,
          PLAYER_HEIGHT,
          boss.x,
          boss.y,
          BOSS_WIDTH,
          BOSS_HEIGHT,
        )
      ) {
        return;
      }

      // Boss is immune to stomp — always contact damage.
      this.applyContactDamage(player);
    });
  }

  private findDeadTeammate(excludeSessionId: string): Player | null {
    let found: Player | null = null;
    this.state.players.forEach((player, sessionId) => {
      if (sessionId === excludeSessionId) return;
      if (player.lives === 0 && !player.alive) {
        found = player;
      }
    });
    return found;
  }

  private checkNuggetPickups() {
    this.state.nuggets.forEach((nugget) => {
      if (!nugget.active) return;

      let consumed = false;
      this.state.players.forEach((player, sessionId) => {
        if (consumed || !nugget.active || !player.alive) return;

        const dx = player.x - nugget.x;
        const dy = player.y - nugget.y;
        if (Math.hypot(dx, dy) > NUGGET_PICKUP_RADIUS) return;

        const deadTeammate = this.findDeadTeammate(sessionId);
        if (deadTeammate) {
          deadTeammate.lives = 1;
          deadTeammate.alive = true;
          deadTeammate.invulnRemaining = INVULNERABLE_TIME;
          this.respawnAtSpawn(deadTeammate);
          nugget.active = false;
          consumed = true;
          return;
        }

        if (player.lives < DUCK_MAX_LIVES) {
          player.lives++;
          nugget.active = false;
          consumed = true;
        }
      });
    });
  }
}
