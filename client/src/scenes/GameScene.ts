import Phaser from "phaser";
import { getStateCallbacks, Room } from "colyseus.js";
import { getRoom } from "../network";
import { isSpriteAvailable, SPRITE_PATH } from "../assets";
import { PLATFORMS, PLAYER_WIDTH, PLAYER_HEIGHT } from "../level";

// ---------------------------------------------------------------------
// Sprite / animation setup. Draw pixel art in a tool like piskelapp.com
// (free, browser-based) or Aseprite, export as ONE spritesheet PNG where
// every frame has the same width/height, and drop it in
// client/public/assets/player.png — that's it, no other code changes
// needed unless your frame size or frame order differs from the
// defaults below.
//
// If no assets/player.png exists yet, the game automatically falls back
// to drawing players as simple colored rectangles (what it did before),
// so this never breaks the project — it just looks nicer once you add
// real art.
// ---------------------------------------------------------------------
const SPRITE_KEY = "player";

// Must match the frame size you exported. Phaser slices the sheet into a
// grid of this size, reading left-to-right, top-to-bottom, starting at
// frame index 0 — it doesn't matter whether your sheet is one row or
// several, as long as every frame is exactly this size.
const SPRITE_FRAME_WIDTH = 32;
const SPRITE_FRAME_HEIGHT = 48;

// Which frame indices belong to which animation. Adjust these to match
// how you laid out your sheet. ANIM_JUMP_FRAME can be -1 if you don't
// have a dedicated jump/fall pose yet — it'll just hold the idle frame.
const ANIM_IDLE_FRAMES = [0];
const ANIM_WALK_FRAMES = [1, 2, 3, 4, 5];
const ANIM_JUMP_FRAME = -1;
const WALK_FRAME_RATE = 10;

interface PlayerVisual {
  container: Phaser.GameObjects.Container;
  visual: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite;
  isSprite: boolean;
  label: Phaser.GameObjects.Text;
  currentAnim: "idle" | "walk" | "jump" | null;
}

// How quickly rendered players catch up to the server's position.
// Higher = snappier but jerkier on a laggy connection; lower = smoother
// but feels more "delayed". This is a simple interpolation, not full
// client-side prediction — good enough to start with, see README.
const INTERP_SPEED = 14;
const GRASS_HEIGHT = 6;

export class GameScene extends Phaser.Scene {
  private room!: Room;
  private mySessionId = "";
  private visuals = new Map<string, PlayerVisual>();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key; SPACE: Phaser.Input.Keyboard.Key };
  private statusText!: Phaser.GameObjects.Text;
  private hasPlayerSprite = false;

  constructor() {
    super("Game");
  }

  preload() {
    // main.ts already checked (via a HEAD request) whether the file
    // exists before starting the game, so we only ever ask Phaser to
    // load it when it's actually there — avoids a noisy console error
    // on every run until you add real art.
    if (isSpriteAvailable()) {
      this.load.spritesheet(SPRITE_KEY, SPRITE_PATH, {
        frameWidth: SPRITE_FRAME_WIDTH,
        frameHeight: SPRITE_FRAME_HEIGHT,
      });
    }
  }

  create() {
    this.room = getRoom();
    this.mySessionId = this.room.sessionId;

    this.setupPlayerAnimations();
    this.drawLevel();
    this.bindRoomState();
    this.bindInput();

    this.statusText = this.add
      .text(16, 16, "", { fontFamily: "monospace", fontSize: "16px", color: "#ffffff" })
      .setScrollFactor(0)
      .setDepth(1000);

    this.room.onLeave(() => {
      this.statusText.setText("Verbindung zum Server verloren.");
    });
  }

  private setupPlayerAnimations() {
    this.hasPlayerSprite = this.textures.exists(SPRITE_KEY);
    if (!this.hasPlayerSprite) return;

    // Frame count actually available on the loaded sheet (Phaser adds an
    // internal "__BASE" frame, hence the -1) — used to defensively clip
    // the animation frame lists above in case they reference an index
    // that doesn't exist on this particular sheet.
    const frameTotal = Math.max(0, this.textures.get(SPRITE_KEY).frameTotal - 1);
    const clip = (frames: number[]) => frames.filter((f) => f >= 0 && f < frameTotal);

    const idleFrames = clip(ANIM_IDLE_FRAMES);
    const walkFrames = clip(ANIM_WALK_FRAMES);
    const jumpFrames = clip([ANIM_JUMP_FRAME]);

    if (idleFrames.length > 0) {
      this.anims.create({
        key: "idle",
        frames: this.anims.generateFrameNumbers(SPRITE_KEY, { frames: idleFrames }),
        frameRate: 1,
        repeat: -1,
      });
    }
    if (walkFrames.length > 0) {
      this.anims.create({
        key: "walk",
        frames: this.anims.generateFrameNumbers(SPRITE_KEY, { frames: walkFrames }),
        frameRate: WALK_FRAME_RATE,
        repeat: -1,
      });
    }
    if (jumpFrames.length > 0) {
      this.anims.create({
        key: "jump",
        frames: this.anims.generateFrameNumbers(SPRITE_KEY, { frames: jumpFrames }),
        frameRate: 1,
        repeat: 0,
      });
    }
  }

  private drawLevel() {
    for (const platform of PLATFORMS) {
      this.add.rectangle(
        platform.x + platform.width / 2,
        platform.y + platform.height / 2,
        platform.width,
        platform.height,
        0x8b5a2b,
      );
      this.add.rectangle(
        platform.x + platform.width / 2,
        platform.y + GRASS_HEIGHT / 2,
        platform.width,
        GRASS_HEIGHT,
        0x4f8a2f,
      );
    }
  }

  private bindRoomState() {
    const $ = getStateCallbacks(this.room);

    $(this.room.state).players.onAdd((player, sessionId: string) => {
      const isMe = sessionId === this.mySessionId;

      let visual: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite;
      if (this.hasPlayerSprite) {
        const sprite = this.add.sprite(0, -SPRITE_FRAME_HEIGHT / 2, SPRITE_KEY, 0);
        if (this.anims.exists("idle")) sprite.play("idle");
        visual = sprite;
      } else {
        const rect = this.add.rectangle(0, -PLAYER_HEIGHT / 2, PLAYER_WIDTH, PLAYER_HEIGHT, player.color);
        rect.setStrokeStyle(2, isMe ? 0xffffff : 0x222222);
        visual = rect;
      }

      const label = this.add
        .text(0, -PLAYER_HEIGHT - 16, player.name, {
          fontFamily: "monospace",
          fontSize: "13px",
          color: isMe ? "#ffffff" : "#dddddd",
        })
        .setOrigin(0.5);

      const container = this.add.container(player.x, player.y, [visual, label]);

      this.visuals.set(sessionId, { container, visual, isSprite: this.hasPlayerSprite, label, currentAnim: this.hasPlayerSprite ? "idle" : null });
    });

    $(this.room.state).players.onRemove((_player, sessionId: string) => {
      const visual = this.visuals.get(sessionId);
      if (visual) {
        visual.container.destroy();
        this.visuals.delete(sessionId);
      }
    });
  }

  private bindInput() {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys("W,A,D,SPACE") as typeof this.keys;
  }

  update(_time: number, delta: number) {
    this.sendInput();
    this.interpolatePlayers(delta);
    this.updateStatusText();
  }

  private sendInput() {
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const jump = this.cursors.up.isDown || this.keys.W.isDown || this.keys.SPACE.isDown;

    this.room.send("input", { left, right, jump });
  }

  private interpolatePlayers(delta: number) {
    const t = Math.min(1, (INTERP_SPEED * delta) / 1000);

    this.room.state.players.forEach((player: any, sessionId: string) => {
      const entry = this.visuals.get(sessionId);
      if (!entry) return;

      entry.container.x = Phaser.Math.Linear(entry.container.x, player.x, t);
      entry.container.y = Phaser.Math.Linear(entry.container.y, player.y, t);

      const facingRight = player.facing >= 0;
      if (entry.isSprite) {
        (entry.visual as Phaser.GameObjects.Sprite).setFlipX(!facingRight);
        this.updateSpriteAnimation(entry, player);
      } else {
        entry.visual.scaleX = facingRight ? 1 : -1;
      }
    });
  }

  private updateSpriteAnimation(entry: PlayerVisual, player: any) {
    const sprite = entry.visual as Phaser.GameObjects.Sprite;
    const moving = Math.abs(player.vx) > 1;

    let next: PlayerVisual["currentAnim"] = "idle";
    if (!player.grounded && this.anims.exists("jump")) next = "jump";
    else if (moving && this.anims.exists("walk")) next = "walk";
    else if (this.anims.exists("idle")) next = "idle";
    else return;

    if (entry.currentAnim !== next) {
      sprite.play(next);
      entry.currentAnim = next;
    }
  }

  private updateStatusText() {
    this.statusText.setText(`Spieler: ${this.room.state.players.size}/4  (du: ${this.mySessionId.slice(0, 6)})`);
  }
}
