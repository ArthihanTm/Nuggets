import Phaser from "phaser";
import { getStateCallbacks, Room } from "colyseus.js";
import { getRoom } from "../network";
import {
  ANT_DEFEAT_PATH,
  ANT_PATH,
  BACKGROUND_PATH,
  BOSS_FRONT_PATH,
  BOSS_SIDE_PATH,
  FEATHER_PATH,
  NUGGET_PATH,
  PLATFORM_PATH,
  PLAYER_DEFEAT_PATH,
  RAVEN_DEFEAT_PATH,
  RAVEN_PATH,
  SPRITE_PATH,
} from "../assets";
import {
  ANT_HEIGHT,
  ANT_WIDTH,
  BACKGROUND_OVERSCAN,
  BACKGROUND_SOURCE_HEIGHT,
  BACKGROUND_SOURCE_WIDTH,
  BOSS_HEIGHT,
  BOSS_WIDTH,
  PLATFORM_GRASS_LINE_Y,
  PLATFORM_SEGMENTS,
  PLATFORM_SOURCE_HEIGHT,
  PLATFORMS,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  RAVEN_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from "../level";

const SPRITE_KEY = "player";
const RAVEN_KEY = "raven";
const ANT_SRC_KEY = "ant-src";
const ANT_KEY = "ant";
const BACKGROUND_KEY = "background";
const BOSS_SIDE_KEY = "boss-side";
const BOSS_SIDE_SRC_KEY = "boss-side-src";
const BOSS_FRONT_KEY = "boss-front";
const PLATFORM_SRC_KEY = "platforms-src";
const FEATHER_KEY = "feather";
const NUGGET_KEY = "nugget";
const PLAYER_DEFEAT_KEY = "player-defeat";
const RAVEN_DEFEAT_KEY = "raven-defeat";
const ANT_DEFEAT_KEY = "ant-defeat";
const platformTextureKey = (segment: number) => `platform-${segment}`;

const FEATHER_DISPLAY_HEIGHT = 20;
const NUGGET_DISPLAY_SIZE = 24;
const DUCK_MAX_LIVES = 3;
const BOSS_MAX_HP = 15;

// Duck spritesheet: 1024×168 px, 6 walk frames in one row.
const SPRITE_FRAME_WIDTH = 170;
const SPRITE_FRAME_HEIGHT = 168;
const SPRITE_FRAME_COUNT = 6;
const SPRITE_SCALE = PLAYER_HEIGHT / SPRITE_FRAME_HEIGHT;
const ANIM_IDLE_FRAMES = [0];
const ANIM_WALK_FRAMES = [0, 1, 2, 3, 4, 5];
const WALK_FRAME_RATE = 12;

const RAVEN_FRAME_WIDTH = 170;
const RAVEN_FRAME_HEIGHT = 168;
const RAVEN_FRAME_COUNT = 6;
const RAVEN_SCALE = RAVEN_HEIGHT / RAVEN_FRAME_HEIGHT;
const RAVEN_FLY_FRAMES = [0, 1, 2, 3, 4, 5];
const RAVEN_FLY_FRAME_RATE = 10;

const ANT_FRAME_WIDTH = 170;
const ANT_FRAME_HEIGHT = 168;
const ANT_FRAME_COUNT = 6;
const ANT_SCALE = ANT_HEIGHT / ANT_FRAME_HEIGHT;
const ANT_WALK_FRAMES = [0, 1, 2, 3, 4, 5];
const ANT_WALK_FRAME_RATE = 14;

// boss-side.png: 1024×1024, clean 3×2 grid of side-profile run frames (all face right).
const BOSS_SIDE_FRAME_WIDTH = 341;
const BOSS_SIDE_FRAME_HEIGHT = 512;
const BOSS_SIDE_FRAME_COUNT = 6;
const BOSS_SCALE = BOSS_HEIGHT / BOSS_SIDE_FRAME_HEIGHT;
const BOSS_WALK_FRAMES = [0, 1, 2, 3, 4, 5];
const BOSS_WALK_FRAME_RATE = 10;

const BACKGROUND_PAN_SPEED = 0.00012;

// platforms.png: three segments in one row. Each segment is cropped at full
// source height (never squashed to the 24px hitbox) and scaled uniformly from
// segment width → platform.width. Origin sits on PLATFORM_GRASS_LINE_Y so the
// walk surface lines up with platform.y while grass tufts and rock base stay visible.
const PLATFORM_DIRT_COLOR = 0x8b5a2b;
const PLATFORM_DIRT_STROKE = 0x5a3a1a;
const PLATFORM_GRASS_COLOR = 0x8fbf7f;
const PLATFORM_GRASS_STRIP_HEIGHT = 6;
const PLATFORM_GRASS_ORIGIN_Y = PLATFORM_GRASS_LINE_Y / PLATFORM_SOURCE_HEIGHT;

interface PlayerVisual {
  body: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  isSprite: boolean;
  currentAnim: "idle" | "walk" | null;
  showingDefeat: boolean;
}

interface EnemyVisual {
  body: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite;
  isSprite: boolean;
  kind: string;
  defeatShown: boolean;
}

interface BossVisual {
  root: Phaser.GameObjects.Container | Phaser.GameObjects.Rectangle;
  idleSprite: Phaser.GameObjects.Sprite | null;
  walkSprite: Phaser.GameObjects.Sprite | null;
  mode: "idle" | "walk" | null;
}

const INTERP_SPEED = 14;

export class GameScene extends Phaser.Scene {
  private room!: Room;
  private mySessionId = "";
  private visuals = new Map<string, PlayerVisual>();
  private enemyVisuals = new Map<string, EnemyVisual>();
  private featherVisuals = new Map<string, Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle>();
  private nuggetVisuals = new Map<string, Phaser.GameObjects.Image>();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };
  private statusText!: Phaser.GameObjects.Text;
  private hasPlayerSprite = false;
  private hasRavenSprite = false;
  private hasAntSprite = false;
  private hasBossSprite = false;
  private hasBossFrontSprite = false;
  private hasPlatformSprites = false;
  private bossFrontScale = BOSS_SCALE;
  private bossVisual: BossVisual | null = null;
  private backgroundImage: Phaser.GameObjects.Image | null = null;
  private backgroundPanRange = 0;
  private inputLeft = false;
  private inputRight = false;
  private inputJump = false;
  private inputShoot = false;
  private connected = true;
  private hasFeatherSprite = false;
  private hasNuggetSprite = false;
  private hasPlayerDefeatSprite = false;
  private hasRavenDefeatSprite = false;
  private hasAntDefeatSprite = false;
  private featherScale = 1;
  private nuggetScale = 1;
  private playerDefeatScale = SPRITE_SCALE;

  constructor() {
    super("Game");
  }

  preload() {
    this.load.spritesheet(SPRITE_KEY, SPRITE_PATH, {
      frameWidth: SPRITE_FRAME_WIDTH,
      frameHeight: SPRITE_FRAME_HEIGHT,
    });
    this.load.spritesheet(RAVEN_KEY, RAVEN_PATH, {
      frameWidth: RAVEN_FRAME_WIDTH,
      frameHeight: RAVEN_FRAME_HEIGHT,
    });
    this.load.image(ANT_SRC_KEY, ANT_PATH);
    this.load.image(BOSS_SIDE_SRC_KEY, BOSS_SIDE_PATH);
    this.load.image(BOSS_FRONT_KEY, BOSS_FRONT_PATH);
    this.load.image(BACKGROUND_KEY, BACKGROUND_PATH);
    this.load.image(PLATFORM_SRC_KEY, PLATFORM_PATH);
    this.load.image(FEATHER_KEY, FEATHER_PATH);
    this.load.image(NUGGET_KEY, NUGGET_PATH);
    this.load.image(PLAYER_DEFEAT_KEY, PLAYER_DEFEAT_PATH);
    this.load.image(RAVEN_DEFEAT_KEY, RAVEN_DEFEAT_PATH);
    this.load.image(ANT_DEFEAT_KEY, ANT_DEFEAT_PATH);
  }

  create() {
    this.room = getRoom();
    this.mySessionId = this.room.sessionId;

    this.setupPlayerAnimations();
    this.setupRavenAnimations();
    this.processAntTexture();
    this.setupAntAnimations();
    this.processBossSideTexture();
    this.processBossFrontTexture();
    this.setupBossAnimations();
    this.processPlatformTextures();
    this.setupCombatAssets();
    this.drawBackground();
    this.drawLevel();
    this.bindRoomState();
    this.bindEnemyState();
    this.bindFeatherState();
    this.bindNuggetState();
    this.createBossVisual();
    this.bindBossState();
    this.bindInput();

    this.statusText = this.add
      .text(16, 16, "", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(1000);

    this.room.onLeave(() => {
      this.connected = false;
      this.statusText.setText("Verbindung zum Server verloren.");
    });
  }

  private setupPlayerAnimations() {
    if (!this.textures.exists(SPRITE_KEY)) {
      console.warn("Player sprite failed to load — using rectangle fallback.");
      return;
    }

    this.hasPlayerSprite = true;
    this.textures.get(SPRITE_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);

    const frameTotal = Math.min(
      SPRITE_FRAME_COUNT,
      Math.max(0, this.textures.get(SPRITE_KEY).frameTotal - 1),
    );
    const clip = (frames: number[]) => frames.filter((f) => f >= 0 && f < frameTotal);

    const idleFrames = clip(ANIM_IDLE_FRAMES);
    const walkFrames = clip(ANIM_WALK_FRAMES);

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
  }

  private setupRavenAnimations() {
    if (!this.textures.exists(RAVEN_KEY)) {
      console.warn("Raven sprite failed to load — using rectangle fallback.");
      return;
    }

    this.hasRavenSprite = true;
    this.textures.get(RAVEN_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);

    const frameTotal = Math.min(
      RAVEN_FRAME_COUNT,
      Math.max(0, this.textures.get(RAVEN_KEY).frameTotal - 1),
    );
    const flyFrames = RAVEN_FLY_FRAMES.filter((f) => f >= 0 && f < frameTotal);

    if (flyFrames.length > 0) {
      this.anims.create({
        key: "raven-fly",
        frames: this.anims.generateFrameNumbers(RAVEN_KEY, { frames: flyFrames }),
        frameRate: RAVEN_FLY_FRAME_RATE,
        repeat: -1,
      });
    }
  }

  private setupAntAnimations() {
    if (!this.textures.exists(ANT_KEY)) {
      console.warn("Ant sprite failed to load — using rectangle fallback.");
      return;
    }

    this.hasAntSprite = true;
    this.textures.get(ANT_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);

    const frameTotal = Math.min(
      ANT_FRAME_COUNT,
      Math.max(0, this.textures.get(ANT_KEY).frameTotal - 1),
    );
    const walkFrames = ANT_WALK_FRAMES.filter((f) => f >= 0 && f < frameTotal);

    if (walkFrames.length > 0) {
      this.anims.create({
        key: "ant-walk",
        frames: this.anims.generateFrameNumbers(ANT_KEY, { frames: walkFrames }),
        frameRate: ANT_WALK_FRAME_RATE,
        repeat: -1,
      });
    }
  }

  private processAntTexture() {
    const canvas = this.chromaKeyGreenScreen(ANT_SRC_KEY);
    if (!canvas) return;

    if (this.textures.exists(ANT_KEY)) this.textures.remove(ANT_KEY);
    if (this.textures.exists(ANT_SRC_KEY)) this.textures.remove(ANT_SRC_KEY);
    this.textures.addSpriteSheet(ANT_KEY, canvas as unknown as HTMLImageElement, {
      frameWidth: ANT_FRAME_WIDTH,
      frameHeight: ANT_FRAME_HEIGHT,
    });
  }

  private chromaKeyGreenScreen(key: string): HTMLCanvasElement | null {
    return this.chromaKey(key, (r, g, b) => g > 160 && r < 140 && b < 140 && g > r + 30 && g > b + 30);
  }

  private chromaKey(
    key: string,
    isBackdrop: (r: number, g: number, b: number) => boolean,
  ): HTMLCanvasElement | null {
    if (!this.textures.exists(key)) return null;

    const texture = this.textures.get(key);
    const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const width = source.width;
    const height = source.height;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(source, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      if (isBackdrop(pixels[i], pixels[i + 1], pixels[i + 2])) {
        pixels[i + 3] = 0;
      }
    }

    // Spill suppression: the outermost ring of remaining pixels is an
    // anti-aliased blend between backdrop and art (a thin green halo around
    // every sprite). Shaving one pixel off the opaque edge removes that halo
    // without visibly changing the silhouette.
    this.erodeOpaqueEdge(imageData, 1);

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /** Sets alpha to 0 for any opaque pixel touching a transparent neighbor, `passes` times. */
  private erodeOpaqueEdge(imageData: ImageData, passes: number) {
    const { width, height, data } = imageData;
    const opaque = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) opaque[i] = data[i * 4 + 3] > 0 ? 1 : 0;

    for (let pass = 0; pass < passes; pass++) {
      const next = opaque.slice();
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (!opaque[idx]) continue;
          const hasTransparentNeighbor =
            (x === 0 || !opaque[idx - 1]) ||
            (x === width - 1 || !opaque[idx + 1]) ||
            (y === 0 || !opaque[idx - width]) ||
            (y === height - 1 || !opaque[idx + width]);
          if (hasTransparentNeighbor) next[idx] = 0;
        }
      }
      opaque.set(next);
    }

    for (let i = 0; i < width * height; i++) {
      if (!opaque[i]) data[i * 4 + 3] = 0;
    }
  }

  private processPlatformTextures() {
    const canvas = this.chromaKeyGreenScreen(PLATFORM_SRC_KEY);
    if (!canvas) {
      console.warn("Platform sprite failed to load — using rectangle fallback.");
      return;
    }

    if (this.textures.exists(PLATFORM_SRC_KEY)) this.textures.remove(PLATFORM_SRC_KEY);

    for (let segment = 0; segment < PLATFORM_SEGMENTS.length; segment++) {
      const { srcX, srcWidth } = PLATFORM_SEGMENTS[segment];
      const key = platformTextureKey(segment);

      const segmentCanvas = document.createElement("canvas");
      segmentCanvas.width = srcWidth;
      segmentCanvas.height = PLATFORM_SOURCE_HEIGHT;
      const ctx = segmentCanvas.getContext("2d");
      if (!ctx) continue;

      ctx.drawImage(
        canvas,
        srcX,
        0,
        srcWidth,
        PLATFORM_SOURCE_HEIGHT,
        0,
        0,
        srcWidth,
        PLATFORM_SOURCE_HEIGHT,
      );

      if (this.textures.exists(key)) this.textures.remove(key);
      this.textures.addImage(key, segmentCanvas as unknown as HTMLImageElement);
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    this.hasPlatformSprites = true;
  }

  private setupCombatAssets() {
    if (this.textures.exists(FEATHER_KEY)) {
      this.hasFeatherSprite = true;
      this.textures.get(FEATHER_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.featherScale = FEATHER_DISPLAY_HEIGHT / this.textures.get(FEATHER_KEY).getSourceImage().height;
    }
    if (this.textures.exists(NUGGET_KEY)) {
      this.hasNuggetSprite = true;
      this.textures.get(NUGGET_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
      const nuggetHeight = this.textures.get(NUGGET_KEY).getSourceImage().height;
      this.nuggetScale = NUGGET_DISPLAY_SIZE / nuggetHeight;
    }
    if (this.textures.exists(PLAYER_DEFEAT_KEY)) {
      this.hasPlayerDefeatSprite = true;
      this.textures.get(PLAYER_DEFEAT_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.playerDefeatScale = PLAYER_HEIGHT / this.textures.get(PLAYER_DEFEAT_KEY).getSourceImage().height;
    }
    if (this.textures.exists(RAVEN_DEFEAT_KEY)) {
      this.hasRavenDefeatSprite = true;
      this.textures.get(RAVEN_DEFEAT_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    if (this.textures.exists(ANT_DEFEAT_KEY)) {
      this.hasAntDefeatSprite = true;
      this.textures.get(ANT_DEFEAT_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  private processBossSideTexture() {
    const canvas = this.chromaKeyGreenScreen(BOSS_SIDE_SRC_KEY);
    if (!canvas) return;

    if (this.textures.exists(BOSS_SIDE_KEY)) this.textures.remove(BOSS_SIDE_KEY);
    if (this.textures.exists(BOSS_SIDE_SRC_KEY)) this.textures.remove(BOSS_SIDE_SRC_KEY);
    this.textures.addSpriteSheet(BOSS_SIDE_KEY, canvas as unknown as HTMLImageElement, {
      frameWidth: BOSS_SIDE_FRAME_WIDTH,
      frameHeight: BOSS_SIDE_FRAME_HEIGHT,
    });
  }

  private processBossFrontTexture() {
    const canvas = this.chromaKeyGreenScreen(BOSS_FRONT_KEY);
    if (!canvas) return;

    this.textures.remove(BOSS_FRONT_KEY);
    this.textures.addImage(BOSS_FRONT_KEY, canvas as unknown as HTMLImageElement);
    this.textures.get(BOSS_FRONT_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.bossFrontScale = BOSS_HEIGHT / canvas.height;
    this.hasBossFrontSprite = true;
  }

  private setupBossAnimations() {
    if (!this.textures.exists(BOSS_SIDE_KEY)) {
      console.warn("Boss side sprite failed to load — using rectangle fallback.");
      return;
    }

    this.hasBossSprite = true;
    this.textures.get(BOSS_SIDE_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);

    const frameTotal = Math.min(
      BOSS_SIDE_FRAME_COUNT,
      Math.max(0, this.textures.get(BOSS_SIDE_KEY).frameTotal - 1),
    );
    const walkFrames = BOSS_WALK_FRAMES.filter((f) => f >= 0 && f < frameTotal);

    if (walkFrames.length > 0) {
      this.anims.create({
        key: "boss-walk",
        frames: this.anims.generateFrameNumbers(BOSS_SIDE_KEY, { frames: walkFrames }),
        frameRate: BOSS_WALK_FRAME_RATE,
        repeat: -1,
      });
    }
  }

  private drawBackground() {
    if (!this.textures.exists(BACKGROUND_KEY)) return;

    const scale = Math.max(
      (WORLD_WIDTH * BACKGROUND_OVERSCAN) / BACKGROUND_SOURCE_WIDTH,
      WORLD_HEIGHT / BACKGROUND_SOURCE_HEIGHT,
    );
    const displayWidth = BACKGROUND_SOURCE_WIDTH * scale;
    const displayHeight = BACKGROUND_SOURCE_HEIGHT * scale;

    this.backgroundImage = this.add
      .image(WORLD_WIDTH / 2, WORLD_HEIGHT, BACKGROUND_KEY)
      .setOrigin(0.5, 1)
      .setDisplaySize(displayWidth, displayHeight)
      .setDepth(-100);

    this.textures.get(BACKGROUND_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.backgroundPanRange = Math.max(0, (displayWidth - WORLD_WIDTH) / 2);
  }

  private updateBackground(time: number) {
    if (!this.backgroundImage || this.backgroundPanRange <= 0) return;
    const offset = Math.sin(time * BACKGROUND_PAN_SPEED) * this.backgroundPanRange;
    this.backgroundImage.x = WORLD_WIDTH / 2 + offset;
  }

  private drawLevel() {
    for (const [index, platform] of PLATFORMS.entries()) {
      // Ground collision stays server-side; background art provides the floor visual.
      if (index === 0) continue;

      const centerX = platform.x + platform.width / 2;

      if (this.hasPlatformSprites) {
        const segment = PLATFORM_SEGMENTS[platform.segment];
        const scale = platform.width / segment.srcWidth;
        const sprite = this.add.image(centerX, platform.y, platformTextureKey(platform.segment));
        sprite.setOrigin(0.5, PLATFORM_GRASS_ORIGIN_Y);
        sprite.setScale(scale);
        sprite.setDepth(10);
        continue;
      }

      const dirt = this.add.rectangle(
        centerX,
        platform.y + platform.height / 2,
        platform.width,
        platform.height,
        PLATFORM_DIRT_COLOR,
      );
      dirt.setStrokeStyle(2, PLATFORM_DIRT_STROKE);
      dirt.setDepth(10);

      const grassHeight = Math.min(PLATFORM_GRASS_STRIP_HEIGHT, platform.height);
      this.add
        .rectangle(centerX, platform.y + grassHeight / 2, platform.width, grassHeight, PLATFORM_GRASS_COLOR)
        .setDepth(11);
    }
  }

  private bindRoomState() {
    const $ = getStateCallbacks(this.room);

    const addPlayerVisual = (player: any, sessionId: string) => {
      if (this.visuals.has(sessionId)) return;

      const isMe = sessionId === this.mySessionId;
      let body: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite;

      if (this.hasPlayerSprite) {
        const sprite = this.add.sprite(player.x, player.y, SPRITE_KEY, 0);
        sprite.setOrigin(0.5, 1);
        sprite.setScale(SPRITE_SCALE);
        sprite.setDepth(100);
        if (this.anims.exists("idle")) sprite.play("idle");
        body = sprite;
      } else {
        const rect = this.add.rectangle(
          player.x,
          player.y - PLAYER_HEIGHT / 2,
          PLAYER_WIDTH,
          PLAYER_HEIGHT,
          player.color,
        );
        rect.setStrokeStyle(2, isMe ? 0xffffff : 0x222222);
        rect.setDepth(100);
        body = rect;
      }

      const label = this.add
        .text(player.x, player.y - PLAYER_HEIGHT - 16, player.name, {
          fontFamily: "monospace",
          fontSize: "13px",
          color: isMe ? "#ffffff" : "#dddddd",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(101);

      this.visuals.set(sessionId, {
        body,
        label,
        isSprite: this.hasPlayerSprite,
        currentAnim: this.hasPlayerSprite ? "idle" : null,
        showingDefeat: false,
      });
    };

    $(this.room.state).players.onAdd((player, sessionId: string) => {
      addPlayerVisual(player, sessionId);
    });

    $(this.room.state).players.onRemove((_player, sessionId: string) => {
      const entry = this.visuals.get(sessionId);
      if (!entry) return;
      entry.body.destroy();
      entry.label.destroy();
      this.visuals.delete(sessionId);
    });

    this.room.state.players.forEach((player: any, sessionId: string) => {
      addPlayerVisual(player, sessionId);
    });
  }

  private bindEnemyState() {
    const $ = getStateCallbacks(this.room);

    const addEnemyVisual = (enemy: any, enemyId: string) => {
      if (this.enemyVisuals.has(enemyId) || !enemy.alive) return;

      let body: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite;
      let isSprite = false;

      if (this.hasRavenSprite && enemy.kind === "raven") {
        const sprite = this.add.sprite(enemy.x, enemy.y, RAVEN_KEY, 0);
        sprite.setOrigin(0.5, 0.55);
        sprite.setScale(RAVEN_SCALE);
        sprite.setDepth(90);
        if (this.anims.exists("raven-fly")) sprite.play("raven-fly");
        body = sprite;
        isSprite = true;
      } else if (this.hasAntSprite && enemy.kind === "ant") {
        const sprite = this.add.sprite(enemy.x, enemy.y, ANT_KEY, 0);
        sprite.setOrigin(0.5, 1);
        sprite.setScale(ANT_SCALE);
        sprite.setDepth(90);
        if (this.anims.exists("ant-walk")) sprite.play("ant-walk");
        body = sprite;
        isSprite = true;
      } else {
        const w = enemy.kind === "ant" ? ANT_WIDTH : 44;
        const h = enemy.kind === "ant" ? ANT_HEIGHT : 36;
        const color = enemy.kind === "ant" ? 0x5c3a28 : 0x4a4e69;
        const rect = this.add.rectangle(
          enemy.x,
          enemy.y - (enemy.kind === "ant" ? h / 2 : 0),
          w,
          h,
          color,
        );
        rect.setStrokeStyle(2, 0x222222);
        rect.setDepth(90);
        body = rect;
      }

      this.enemyVisuals.set(enemyId, { body, isSprite, kind: enemy.kind, defeatShown: false });
    };

    $(this.room.state).enemies.onAdd((enemy, enemyId: string) => {
      addEnemyVisual(enemy, enemyId);
    });

    $(this.room.state).enemies.onRemove((_enemy, enemyId: string) => {
      const entry = this.enemyVisuals.get(enemyId);
      if (!entry) return;
      entry.body.destroy();
      this.enemyVisuals.delete(enemyId);
    });

    this.room.state.enemies.forEach((enemy: any, enemyId: string) => {
      addEnemyVisual(enemy, enemyId);
    });
  }

  private showEnemyDefeat(enemyId: string, enemy: any, entry: EnemyVisual) {
    if (entry.defeatShown) return;
    entry.defeatShown = true;

    const x = entry.body.x;
    const y = entry.body.y;
    entry.body.destroy();
    this.enemyVisuals.delete(enemyId);

    const defeatKey =
      enemy.kind === "ant"
        ? this.hasAntDefeatSprite
          ? ANT_DEFEAT_KEY
          : null
        : this.hasRavenDefeatSprite
          ? RAVEN_DEFEAT_KEY
          : null;

    if (defeatKey) {
      const sprite = this.add.sprite(x, y, defeatKey);
      sprite.setOrigin(0.5, enemy.kind === "ant" ? 1 : 0.55);
      sprite.setScale(enemy.kind === "ant" ? ANT_SCALE : RAVEN_SCALE);
      sprite.setDepth(91);
      this.time.delayedCall(600, () => sprite.destroy());
    }
  }

  private bindFeatherState() {
    const $ = getStateCallbacks(this.room);

    const addFeatherVisual = (feather: any, featherId: string) => {
      if (this.featherVisuals.has(featherId)) return;

      let sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
      if (this.hasFeatherSprite) {
        const img = this.add.image(feather.x, feather.y, FEATHER_KEY);
        img.setScale(this.featherScale);
        img.setOrigin(0.5, 0.5);
        img.setFlipX(feather.vx < 0);
        sprite = img;
      } else {
        sprite = this.add.rectangle(feather.x, feather.y, 16, 8, 0xffe066);
      }
      sprite.setDepth(105);
      this.featherVisuals.set(featherId, sprite);
    };

    $(this.room.state).feathers.onAdd((feather, featherId: string) => {
      addFeatherVisual(feather, featherId);
    });

    $(this.room.state).feathers.onRemove((_feather, featherId: string) => {
      const sprite = this.featherVisuals.get(featherId);
      if (!sprite) return;
      sprite.destroy();
      this.featherVisuals.delete(featherId);
    });

    this.room.state.feathers.forEach((feather: any, featherId: string) => {
      addFeatherVisual(feather, featherId);
    });
  }

  private bindNuggetState() {
    const $ = getStateCallbacks(this.room);

    const addNuggetVisual = (nugget: any, nuggetId: string) => {
      if (this.nuggetVisuals.has(nuggetId)) return;

      let sprite: Phaser.GameObjects.Image;
      if (this.hasNuggetSprite) {
        sprite = this.add.image(nugget.x, nugget.y, NUGGET_KEY);
        sprite.setScale(this.nuggetScale);
      } else {
        sprite = this.add.image(nugget.x, nugget.y, NUGGET_KEY);
        sprite.setDisplaySize(NUGGET_DISPLAY_SIZE, NUGGET_DISPLAY_SIZE);
      }
      sprite.setOrigin(0.5, 0.5);
      sprite.setDepth(85);
      sprite.setVisible(nugget.active);
      this.nuggetVisuals.set(nuggetId, sprite);

      $(nugget).listen("active", (active: boolean) => {
        sprite.setVisible(active);
      });
    };

    $(this.room.state).nuggets.onAdd((nugget, nuggetId: string) => {
      addNuggetVisual(nugget, nuggetId);
    });

    $(this.room.state).nuggets.onRemove((_nugget, nuggetId: string) => {
      const sprite = this.nuggetVisuals.get(nuggetId);
      if (!sprite) return;
      sprite.destroy();
      this.nuggetVisuals.delete(nuggetId);
    });

    this.room.state.nuggets.forEach((nugget: any, nuggetId: string) => {
      addNuggetVisual(nugget, nuggetId);
    });
  }

  private bindBossState() {
    const $ = getStateCallbacks(this.room);
    const syncBossVisual = () => {
      if (!this.bossVisual) return;
      this.updateBossVisual(this.bossVisual, this.room.state.boss);
    };

    $(this.room.state).boss.listen("waiting", syncBossVisual);
    $(this.room.state).boss.listen("facing", syncBossVisual);
    $(this.room.state).boss.listen("alive", syncBossVisual);
  }

  private createBossVisual() {
    const boss = this.room.state.boss;

    if (this.hasBossSprite || this.hasBossFrontSprite) {
      const container = this.add.container(boss.x, boss.y).setDepth(110);

      let walkSprite: Phaser.GameObjects.Sprite | null = null;
      if (this.hasBossSprite) {
        walkSprite = this.add.sprite(0, 0, BOSS_SIDE_KEY, 0);
        walkSprite.setOrigin(0.5, 1);
        walkSprite.setScale(BOSS_SCALE);
        container.add(walkSprite);
      }

      let idleSprite: Phaser.GameObjects.Sprite | null = null;
      if (this.hasBossFrontSprite) {
        idleSprite = this.add.sprite(0, 0, BOSS_FRONT_KEY);
        idleSprite.setOrigin(0.5, 1);
        idleSprite.setScale(this.bossFrontScale);
        idleSprite.setVisible(false);
        container.add(idleSprite);
      }

      this.bossVisual = {
        root: container,
        idleSprite,
        walkSprite,
        mode: null,
      };
      this.updateBossVisual(this.bossVisual, boss);
      return;
    }

    const rect = this.add.rectangle(
      boss.x,
      boss.y - BOSS_HEIGHT / 2,
      BOSS_WIDTH,
      BOSS_HEIGHT,
      0xff0000,
    );
    rect.setStrokeStyle(3, 0x880000);
    rect.setDepth(110);

    this.bossVisual = {
      root: rect,
      idleSprite: null,
      walkSprite: null,
      mode: null,
    };
  }

  private bindInput() {
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.addCapture([
        "W", "A", "S", "D", "SPACE", "F", "ENTER",
        "UP", "DOWN", "LEFT", "RIGHT",
      ]);
      this.cursors = keyboard.createCursorKeys();
      this.keys = keyboard.addKeys("W,A,D,SPACE") as typeof this.keys;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") this.inputLeft = true;
      if (event.code === "ArrowRight" || event.code === "KeyD") this.inputRight = true;
      if (event.code === "ArrowUp" || event.code === "KeyW" || event.code === "Space") {
        this.inputJump = true;
        event.preventDefault();
      }
      if (event.code === "KeyF" || event.code === "Enter") {
        this.inputShoot = true;
        event.preventDefault();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") this.inputLeft = false;
      if (event.code === "ArrowRight" || event.code === "KeyD") this.inputRight = false;
      if (event.code === "ArrowUp" || event.code === "KeyW" || event.code === "Space") {
        this.inputJump = false;
      }
      if (event.code === "KeyF" || event.code === "Enter") {
        this.inputShoot = false;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    });

    const canvas = this.game.canvas;
    canvas.setAttribute("tabindex", "0");
    canvas.style.outline = "none";
    canvas.addEventListener("pointerdown", () => canvas.focus());
    canvas.focus();
  }

  update(time: number, delta: number) {
    this.sendInput();
    this.interpolatePlayers(delta);
    this.interpolateEnemies(delta);
    this.interpolateFeathers(delta);
    this.interpolateBoss(delta);
    this.updateBackground(time);
    this.updateStatusText();
  }

  private sendInput() {
    if (!this.connected) return;

    const left = this.inputLeft || this.cursors?.left?.isDown || this.keys?.A?.isDown || false;
    const right = this.inputRight || this.cursors?.right?.isDown || this.keys?.D?.isDown || false;
    const jump =
      this.inputJump ||
      this.cursors?.up?.isDown ||
      this.keys?.W?.isDown ||
      this.keys?.SPACE?.isDown ||
      false;
    const shoot = this.inputShoot || false;

    this.room.send("input", { left, right, jump, shoot });
  }

  private interpolatePlayers(delta: number) {
    const t = Math.min(1, (INTERP_SPEED * delta) / 1000);

    this.room.state.players.forEach((player: any, sessionId: string) => {
      const entry = this.visuals.get(sessionId);
      if (!entry) return;

      const nextX = Phaser.Math.Linear(entry.body.x, player.x, t);
      const targetY = entry.isSprite ? player.y : player.y - PLAYER_HEIGHT / 2;
      const nextY = Phaser.Math.Linear(entry.body.y, targetY, t);
      entry.body.setPosition(nextX, nextY);
      entry.label.setPosition(nextX, player.y - PLAYER_HEIGHT - 16);

      this.updatePlayerCombatVisual(entry, player);

      if (!player.alive) return;

      const facingRight = player.facing >= 0;
      if (entry.isSprite && !entry.showingDefeat) {
        const sprite = entry.body as Phaser.GameObjects.Sprite;
        sprite.setFlipX(!facingRight);
        this.updateSpriteAnimation(entry, player);
      } else if (!entry.isSprite) {
        entry.body.scaleX = facingRight ? 1 : -1;
      }
    });
  }

  private updatePlayerCombatVisual(entry: PlayerVisual, player: any) {
    if (!entry.isSprite) {
      if (!player.alive) {
        entry.body.setAlpha(0.85);
        entry.label.setText(`${player.name} (tot)`);
      } else {
        entry.label.setText(player.name);
        entry.body.setAlpha(
          player.invulnRemaining > 0 ? 0.45 + 0.35 * Math.sin(this.time.now * 0.02) : 1,
        );
      }
      return;
    }

    const sprite = entry.body as Phaser.GameObjects.Sprite;

    if (!player.alive) {
      if (!entry.showingDefeat && entry.isSprite && this.hasPlayerDefeatSprite) {
        sprite.setTexture(PLAYER_DEFEAT_KEY);
        sprite.setScale(this.playerDefeatScale);
        sprite.anims.stop();
        entry.showingDefeat = true;
        entry.currentAnim = null;
      }
      entry.body.setAlpha(0.85);
      entry.label.setText(`${player.name} (tot)`);
      return;
    }

    if (entry.showingDefeat && entry.isSprite && this.hasPlayerSprite) {
      sprite.setTexture(SPRITE_KEY, 0);
      sprite.setScale(SPRITE_SCALE);
      entry.showingDefeat = false;
      entry.currentAnim = "idle";
      if (this.anims.exists("idle")) sprite.play("idle");
    }

    entry.label.setText(player.name);

    if (player.invulnRemaining > 0) {
      entry.body.setAlpha(0.45 + 0.35 * Math.sin(this.time.now * 0.02));
    } else {
      entry.body.setAlpha(1);
    }
  }

  private interpolateEnemies(delta: number) {
    const t = Math.min(1, (INTERP_SPEED * delta) / 1000);

    this.room.state.enemies.forEach((enemy: any, enemyId: string) => {
      const entry = this.enemyVisuals.get(enemyId);
      if (!entry || !enemy.alive) {
        if (entry && !enemy.alive && !entry.defeatShown) {
          this.showEnemyDefeat(enemyId, enemy, entry);
        }
        return;
      }

      const nextX = Phaser.Math.Linear(entry.body.x, enemy.x, t);
      const targetY =
        entry.kind === "ant" && !entry.isSprite ? enemy.y - ANT_HEIGHT / 2 : enemy.y;
      const nextY = Phaser.Math.Linear(entry.body.y, targetY, t);
      entry.body.setPosition(nextX, nextY);

      const facingRight = enemy.facing >= 0;
      if (entry.isSprite) {
        (entry.body as Phaser.GameObjects.Sprite).setFlipX(!facingRight);
      } else {
        entry.body.scaleX = facingRight ? 1 : -1;
      }
    });
  }

  private interpolateFeathers(delta: number) {
    const t = Math.min(1, (INTERP_SPEED * delta) / 1000);

    this.room.state.feathers.forEach((feather: any, featherId: string) => {
      const sprite = this.featherVisuals.get(featherId);
      if (!sprite) return;
      sprite.setPosition(
        Phaser.Math.Linear(sprite.x, feather.x, t),
        Phaser.Math.Linear(sprite.y, feather.y, t),
      );
      if (sprite instanceof Phaser.GameObjects.Image) {
        sprite.setFlipX(feather.vx < 0);
      }
    });
  }

  private interpolateBoss(delta: number) {
    const entry = this.bossVisual;
    if (!entry) return;

    const boss = this.room.state.boss;
    if (!boss.alive) {
      entry.root.setVisible(false);
      return;
    }
    entry.root.setVisible(true);

    const t = Math.min(1, (INTERP_SPEED * delta) / 1000);

    if (entry.walkSprite || entry.idleSprite) {
      const nextX = Phaser.Math.Linear(entry.root.x, boss.x, t);
      const nextY = Phaser.Math.Linear(entry.root.y, boss.y, t);
      entry.root.setPosition(nextX, nextY);
      this.updateBossVisual(entry, boss);
      return;
    }

    const targetY = boss.y - BOSS_HEIGHT / 2;
    const rect = entry.root as Phaser.GameObjects.Rectangle;
    rect.setPosition(
      Phaser.Math.Linear(rect.x, boss.x, t),
      Phaser.Math.Linear(rect.y, targetY, t),
    );
    rect.scaleX = boss.facing >= 0 ? 1 : -1;
  }

  private updateBossVisual(
    entry: BossVisual,
    boss: { waiting: boolean; facing: number },
  ) {
    const waiting = boss.waiting === true;
    const facingRight = boss.facing >= 0;
    const next: BossVisual["mode"] = waiting ? "idle" : "walk";

    if (entry.idleSprite) entry.idleSprite.setVisible(waiting);
    if (entry.walkSprite) entry.walkSprite.setVisible(!waiting);

    if (waiting) {
      if (entry.walkSprite) entry.walkSprite.anims.stop();
      entry.mode = next;
      return;
    }

    if (!entry.walkSprite) {
      entry.mode = next;
      return;
    }

    entry.walkSprite.setFlipX(!facingRight);

    if (entry.mode !== next) {
      entry.walkSprite.setFrame(0);
      entry.walkSprite.anims.stop();
      if (this.anims.exists("boss-walk")) entry.walkSprite.play("boss-walk");
    } else if (!entry.walkSprite.anims.isPlaying && this.anims.exists("boss-walk")) {
      entry.walkSprite.play("boss-walk");
    }

    entry.mode = next;
  }

  private updateSpriteAnimation(entry: PlayerVisual, player: any) {
    const sprite = entry.body as Phaser.GameObjects.Sprite;
    const moving = Math.abs(player.vx) > 1;
    const next: PlayerVisual["currentAnim"] = moving && this.anims.exists("walk") ? "walk" : "idle";

    if (entry.currentAnim !== next) {
      sprite.play(next);
      entry.currentAnim = next;
    }
  }

  private updateStatusText() {
    const me = this.room.state.players.get(this.mySessionId);
    const lives = me?.lives ?? 0;
    const hearts = "♥".repeat(lives) + "♡".repeat(Math.max(0, DUCK_MAX_LIVES - lives));

    let teammateDead = false;
    this.room.state.players.forEach((player: any, sessionId: string) => {
      if (sessionId !== this.mySessionId && player.lives === 0 && !player.alive) {
        teammateDead = true;
      }
    });

    const lines = [
      `${hearts}  (${lives}/${DUCK_MAX_LIVES})  — WASD / F: Feder`,
      `Spieler: ${this.room.state.players.size}/4`,
    ];

    if (teammateDead) {
      lines.push("Teammitglied tot — Nugget sammeln zum Wiederbeleben!");
    }

    const boss = this.room.state.boss;
    if (boss.alive) {
      lines.push(`Boss HP: ${boss.hp}/${BOSS_MAX_HP}`);
    } else if (boss.hp <= 0) {
      lines.push("Boss besiegt!");
    }

    this.statusText.setText(lines.join("\n"));
  }
}
