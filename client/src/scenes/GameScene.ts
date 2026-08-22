import Phaser from "phaser";
import { getStateCallbacks, Room } from "colyseus.js";
import { getRoom } from "../network";
import {
  ANT_DEFEAT_PATH,
  ANT_PATH,
  BACKGROUND_PATH,
  BOSS_CAST_PATH,
  BOSS_FRONT_PATH,
  BOSS_DEFEAT_PATH,
  BOSS_LIGHT_ORB_PATH,
  BOSS_SIDE_PATH,
  BOSS_STOMP_PATH,
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
const BOSS_STOMP_KEY = "boss-stomp";
const BOSS_STOMP_SRC_KEY = "boss-stomp-src";
const BOSS_CAST_KEY = "boss-cast";
const BOSS_CAST_SRC_KEY = "boss-cast-src";
const BOSS_LIGHT_ORB_KEY = "boss-light-orb";
const BOSS_LIGHT_ORB_SRC_KEY = "boss-light-orb-src";
const PLATFORM_SRC_KEY = "platforms-src";
const FEATHER_KEY = "feather";
const NUGGET_KEY = "nugget";
const PLAYER_DEFEAT_KEY = "player-defeat";
const RAVEN_DEFEAT_KEY = "raven-defeat";
const ANT_DEFEAT_KEY = "ant-defeat";
const PLAYER_DEFEAT_SRC_KEY = "player-defeat-src";
const RAVEN_DEFEAT_SRC_KEY = "raven-defeat-src";
const ANT_DEFEAT_SRC_KEY = "ant-defeat-src";
const platformTextureKey = (segment: number) => `platform-${segment}`;

const FEATHER_DISPLAY_HEIGHT = 20;
const NUGGET_DISPLAY_SIZE = 24;
const BOSS_PROJECTILE_DISPLAY_SIZE = 30;
const DUCK_MAX_LIVES = 3;
const BOSS_MAX_HP = 15;

const PLAYER_DEFEAT_FRAME_WIDTH = 170;
const PLAYER_DEFEAT_FRAME_HEIGHT = 168;
const PLAYER_DEFEAT_FRAME_COUNT = 6;
const PLAYER_DEFEAT_FRAMES = [0, 1, 2, 3, 4, 5];
const PLAYER_DEFEAT_FRAME_RATE = 10;

const ANT_DEFEAT_FRAME_WIDTH = 170;
const ANT_DEFEAT_FRAME_HEIGHT = 168;
const ANT_DEFEAT_FRAME_COUNT = 6;
const ANT_DEFEAT_FRAMES = [0, 1, 2, 3, 4, 5];
const ANT_DEFEAT_FRAME_RATE = 12;

// raven-defeat: 1024×1024, 3×3 grid — all 9 frames play in order (fall sequence).
const RAVEN_DEFEAT_FRAME_WIDTH = 341;
const RAVEN_DEFEAT_FRAME_HEIGHT = 341;
const RAVEN_DEFEAT_FRAME_COUNT = 9;
const RAVEN_DEFEAT_FRAMES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const RAVEN_DEFEAT_FRAME_RATE = 9;
const RAVEN_DEFEAT_SCALE = RAVEN_HEIGHT / RAVEN_DEFEAT_FRAME_HEIGHT;
const RAVEN_DEFEAT_FALL_PX = 56;
const RAVEN_DEFEAT_HOLD_MS = 800;
const DEFEAT_HOLD_MS = 500;

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
const BOSS_ATTACK_FRAME_COUNT = 6;
const BOSS_LIGHT_ORB_CROP = { x: 20, y: 10, width: 400, height: 390 };

// boss-defeat: 1024×1024, 3×2 grid — 6-frame knockdown sequence.
const BOSS_DEFEAT_KEY = "boss-defeat";
const BOSS_DEFEAT_SRC_KEY = "boss-defeat-src";
const BOSS_DEFEAT_FRAME_WIDTH = BOSS_SIDE_FRAME_WIDTH;
const BOSS_DEFEAT_FRAME_HEIGHT = BOSS_SIDE_FRAME_HEIGHT;
const BOSS_DEFEAT_FRAME_COUNT = 6;
const BOSS_DEFEAT_FRAMES = [0, 1, 2, 3, 4, 5];
const BOSS_DEFEAT_FRAME_RATE = 8;
const BOSS_DEFEAT_SCALE = BOSS_HEIGHT / BOSS_DEFEAT_FRAME_HEIGHT;

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
  defeatAnimStarted: boolean;
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
  stompSprite: Phaser.GameObjects.Sprite | null;
  castSprite: Phaser.GameObjects.Sprite | null;
  mode: "idle" | "walk" | "stomp" | "cast" | null;
}

const INTERP_SPEED = 14;

export class GameScene extends Phaser.Scene {
  private room!: Room;
  private mySessionId = "";
  private visuals = new Map<string, PlayerVisual>();
  private enemyVisuals = new Map<string, EnemyVisual>();
  private featherVisuals = new Map<string, Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle>();
  private bossProjectileVisuals = new Map<
    string,
    Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
  >();
  private nuggetVisuals = new Map<string, Phaser.GameObjects.Image>();
  private nuggetSubscriptions = new Map<string, Array<() => void>>();
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
  private hasBossStompSprite = false;
  private hasBossCastSprite = false;
  private hasBossLightOrbSprite = false;
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
  private hasBossDefeatSprite = false;
  private bossDefeatShown = false;
  private bossDefeatSprite: Phaser.GameObjects.Sprite | null = null;
  private defeatEffects = new Set<Phaser.GameObjects.GameObject>();
  private featherScale = 1;
  private nuggetScale = 1;
  private playerDefeatScale = SPRITE_SCALE;
  private currentPhase: "title" | "playing" | "won" | "lost" = "title";
  private phaseSequence = 0;
  private endscreenTimer: Phaser.Time.TimerEvent | null = null;
  private cleanupCallbacks: Array<() => void> = [];

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
    this.load.image(BOSS_STOMP_SRC_KEY, BOSS_STOMP_PATH);
    this.load.image(BOSS_CAST_SRC_KEY, BOSS_CAST_PATH);
    this.load.image(BOSS_LIGHT_ORB_SRC_KEY, BOSS_LIGHT_ORB_PATH);
    this.load.image(BACKGROUND_KEY, BACKGROUND_PATH);
    this.load.image(PLATFORM_SRC_KEY, PLATFORM_PATH);
    this.load.image(FEATHER_KEY, FEATHER_PATH);
    this.load.image(NUGGET_KEY, NUGGET_PATH);
    this.load.image(PLAYER_DEFEAT_SRC_KEY, PLAYER_DEFEAT_PATH);
    this.load.image(RAVEN_DEFEAT_SRC_KEY, RAVEN_DEFEAT_PATH);
    this.load.image(ANT_DEFEAT_SRC_KEY, ANT_DEFEAT_PATH);
    this.load.image(BOSS_DEFEAT_SRC_KEY, BOSS_DEFEAT_PATH);
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
    this.processBossAttackTextures();
    this.processBossLightOrbTexture();
    this.setupBossAnimations();
    this.processPlatformTextures();
    this.processDefeatTextures();
    this.setupDefeatAnimations();
    this.setupCombatAssets();
    this.drawBackground();
    this.drawLevel();
    this.bindPhaseState();
    this.bindRoomState();
    this.bindEnemyState();
    this.bindFeatherState();
    this.bindBossProjectileState();
    this.bindNuggetState();
    this.createBossVisual();
    this.bindBossState();
    this.bindInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    if (!this.room.state.boss.alive) {
      this.showBossDefeat();
    }

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

    this.trackSubscription(this.room.onLeave(() => {
      this.connected = false;
      this.statusText.setText("Verbindung zum Server verloren.");
    }));
  }

  private trackSubscription(value: unknown) {
    if (typeof value === "function") {
      this.cleanupCallbacks.push(value as () => void);
    }
  }

  private bindPhaseState() {
    const $ = getStateCallbacks(this.room);
    this.trackSubscription(
      $(this.room.state).listen("phase", (phase: typeof this.currentPhase) => {
        this.handlePhaseChange(phase);
      }),
    );
    this.handlePhaseChange((this.room.state.phase ?? "title") as typeof this.currentPhase);
  }

  private handlePhaseChange(phase: typeof this.currentPhase) {
    this.currentPhase = phase;
    const sequence = ++this.phaseSequence;
    this.endscreenTimer?.remove(false);
    this.endscreenTimer = null;

    if (phase === "playing") {
      this.resetRoundVisuals();
      this.dispatchPhaseChange(phase);
      return;
    }

    this.stopLocalInput();
    if (phase === "title") {
      this.dispatchPhaseChange(phase);
      return;
    }

    const delay =
      phase === "lost"
        ? this.hasPlayerDefeatSprite && this.anims.exists("player-defeat")
          ? (PLAYER_DEFEAT_FRAME_COUNT / PLAYER_DEFEAT_FRAME_RATE) * 1000
          : 0
        : this.hasBossDefeatSprite && this.anims.exists("boss-defeat")
          ? (BOSS_DEFEAT_FRAME_COUNT / BOSS_DEFEAT_FRAME_RATE) * 1000
          : 0;

    if (delay === 0) {
      this.dispatchPhaseChange(phase);
      return;
    }

    this.endscreenTimer = this.time.delayedCall(delay, () => {
      this.endscreenTimer = null;
      if (
        sequence === this.phaseSequence &&
        this.currentPhase === phase &&
        this.room.state.phase === phase
      ) {
        this.dispatchPhaseChange(phase);
      }
    });
  }

  private dispatchPhaseChange(phase: typeof this.currentPhase) {
    window.dispatchEvent(
      new CustomEvent("nuggets:phasechange", { detail: { phase } }),
    );
  }

  private stopLocalInput() {
    this.inputLeft = false;
    this.inputRight = false;
    this.inputJump = false;
    this.inputShoot = false;
  }

  private resetRoundVisuals() {
    this.stopLocalInput();
    for (const effect of this.defeatEffects) effect.destroy();
    this.defeatEffects.clear();
    this.bossDefeatSprite?.destroy();
    this.bossDefeatSprite = null;
    this.bossDefeatShown = false;
    if (this.bossVisual) {
      this.bossVisual.root.setVisible(true);
      this.updateBossVisual(this.bossVisual, this.room.state.boss);
    }
    this.visuals.forEach((entry) => {
      entry.showingDefeat = false;
      entry.defeatAnimStarted = false;
      entry.body.setAlpha(1);
      if (entry.isSprite) {
        const sprite = entry.body as Phaser.GameObjects.Sprite;
        sprite.anims.stop();
        sprite.setTexture(SPRITE_KEY, 0);
        sprite.setScale(SPRITE_SCALE);
        entry.currentAnim = "idle";
        if (this.anims.exists("idle")) sprite.play("idle");
      }
    });
  }

  private cleanup() {
    this.endscreenTimer?.remove(false);
    this.endscreenTimer = null;
    for (const subscriptions of this.nuggetSubscriptions.values()) {
      for (const unsubscribe of subscriptions) unsubscribe();
    }
    this.nuggetSubscriptions.clear();
    for (const cleanup of this.cleanupCallbacks.splice(0)) cleanup();
    for (const effect of this.defeatEffects) effect.destroy();
    this.defeatEffects.clear();
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

  private processDefeatSpritesheet(
    srcKey: string,
    outKey: string,
    frameWidth: number,
    frameHeight: number,
  ): boolean {
    const canvas = this.chromaKeyGreenScreen(srcKey);
    if (!canvas) return false;

    if (this.textures.exists(outKey)) this.textures.remove(outKey);
    if (this.textures.exists(srcKey)) this.textures.remove(srcKey);
    this.textures.addSpriteSheet(outKey, canvas as unknown as HTMLImageElement, {
      frameWidth,
      frameHeight,
    });
    this.textures.get(outKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return true;
  }

  private processDefeatTextures() {
    if (
      this.processDefeatSpritesheet(
        PLAYER_DEFEAT_SRC_KEY,
        PLAYER_DEFEAT_KEY,
        PLAYER_DEFEAT_FRAME_WIDTH,
        PLAYER_DEFEAT_FRAME_HEIGHT,
      )
    ) {
      this.hasPlayerDefeatSprite = true;
    }

    if (
      this.processDefeatSpritesheet(
        ANT_DEFEAT_SRC_KEY,
        ANT_DEFEAT_KEY,
        ANT_DEFEAT_FRAME_WIDTH,
        ANT_DEFEAT_FRAME_HEIGHT,
      )
    ) {
      this.hasAntDefeatSprite = true;
    }

    if (
      this.processDefeatSpritesheet(
        RAVEN_DEFEAT_SRC_KEY,
        RAVEN_DEFEAT_KEY,
        RAVEN_DEFEAT_FRAME_WIDTH,
        RAVEN_DEFEAT_FRAME_HEIGHT,
      )
    ) {
      this.hasRavenDefeatSprite = true;
    }

    if (
      this.processDefeatSpritesheet(
        BOSS_DEFEAT_SRC_KEY,
        BOSS_DEFEAT_KEY,
        BOSS_DEFEAT_FRAME_WIDTH,
        BOSS_DEFEAT_FRAME_HEIGHT,
      )
    ) {
      this.hasBossDefeatSprite = true;
    }
  }

  private setupDefeatAnimations() {
    if (this.hasPlayerDefeatSprite) {
      const frameTotal = Math.min(
        PLAYER_DEFEAT_FRAME_COUNT,
        Math.max(0, this.textures.get(PLAYER_DEFEAT_KEY).frameTotal - 1),
      );
      const frames = PLAYER_DEFEAT_FRAMES.filter((f) => f >= 0 && f < frameTotal);
      if (frames.length > 0) {
        this.anims.create({
          key: "player-defeat",
          frames: this.anims.generateFrameNumbers(PLAYER_DEFEAT_KEY, { frames }),
          frameRate: PLAYER_DEFEAT_FRAME_RATE,
          repeat: 0,
        });
      }
    }

    if (this.hasAntDefeatSprite) {
      const frameTotal = Math.min(
        ANT_DEFEAT_FRAME_COUNT,
        Math.max(0, this.textures.get(ANT_DEFEAT_KEY).frameTotal - 1),
      );
      const frames = ANT_DEFEAT_FRAMES.filter((f) => f >= 0 && f < frameTotal);
      if (frames.length > 0) {
        this.anims.create({
          key: "ant-defeat",
          frames: this.anims.generateFrameNumbers(ANT_DEFEAT_KEY, { frames }),
          frameRate: ANT_DEFEAT_FRAME_RATE,
          repeat: 0,
        });
      }
    }

    if (this.hasRavenDefeatSprite) {
      const frameTotal = Math.min(
        RAVEN_DEFEAT_FRAME_COUNT,
        Math.max(0, this.textures.get(RAVEN_DEFEAT_KEY).frameTotal - 1),
      );
      const frames = RAVEN_DEFEAT_FRAMES.filter((f) => f >= 0 && f <= frameTotal);
      if (frames.length > 0) {
        this.anims.create({
          key: "raven-defeat",
          frames: this.anims.generateFrameNumbers(RAVEN_DEFEAT_KEY, { frames }),
          frameRate: RAVEN_DEFEAT_FRAME_RATE,
          repeat: 0,
        });
      }
    }

    if (this.hasBossDefeatSprite) {
      const frameTotal = Math.min(
        BOSS_DEFEAT_FRAME_COUNT,
        Math.max(0, this.textures.get(BOSS_DEFEAT_KEY).frameTotal - 1),
      );
      const frames = BOSS_DEFEAT_FRAMES.filter((f) => f >= 0 && f <= frameTotal);
      if (frames.length > 0) {
        this.anims.create({
          key: "boss-defeat",
          frames: this.anims.generateFrameNumbers(BOSS_DEFEAT_KEY, { frames }),
          frameRate: BOSS_DEFEAT_FRAME_RATE,
          repeat: 0,
        });
      }
    }
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
    if (this.hasPlayerDefeatSprite) {
      this.playerDefeatScale = PLAYER_HEIGHT / PLAYER_DEFEAT_FRAME_HEIGHT;
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

  private processBossAttackSpritesheet(srcKey: string, outKey: string): boolean {
    const canvas = this.chromaKeyGreenScreen(srcKey);
    if (!canvas) return false;

    if (this.textures.exists(outKey)) this.textures.remove(outKey);
    if (this.textures.exists(srcKey)) this.textures.remove(srcKey);
    this.textures.addSpriteSheet(outKey, canvas as unknown as HTMLImageElement, {
      frameWidth: BOSS_SIDE_FRAME_WIDTH,
      frameHeight: BOSS_SIDE_FRAME_HEIGHT,
    });
    this.textures.get(outKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return true;
  }

  private processBossAttackTextures() {
    this.hasBossStompSprite = this.processBossAttackSpritesheet(
      BOSS_STOMP_SRC_KEY,
      BOSS_STOMP_KEY,
    );
    this.hasBossCastSprite = this.processBossAttackSpritesheet(BOSS_CAST_SRC_KEY, BOSS_CAST_KEY);
  }

  private processBossLightOrbTexture() {
    const sourceCanvas = this.chromaKeyGreenScreen(BOSS_LIGHT_ORB_SRC_KEY);
    if (!sourceCanvas) return;

    const crop = BOSS_LIGHT_ORB_CROP;
    const orbCanvas = document.createElement("canvas");
    orbCanvas.width = crop.width;
    orbCanvas.height = crop.height;
    const ctx = orbCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      sourceCanvas,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height,
    );

    if (this.textures.exists(BOSS_LIGHT_ORB_KEY)) this.textures.remove(BOSS_LIGHT_ORB_KEY);
    if (this.textures.exists(BOSS_LIGHT_ORB_SRC_KEY)) this.textures.remove(BOSS_LIGHT_ORB_SRC_KEY);
    this.textures.addImage(BOSS_LIGHT_ORB_KEY, orbCanvas as unknown as HTMLImageElement);
    this.textures.get(BOSS_LIGHT_ORB_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.hasBossLightOrbSprite = true;
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
        defeatAnimStarted: false,
      });
    };

    this.trackSubscription(
      $(this.room.state).players.onAdd((player, sessionId: string) => {
        addPlayerVisual(player, sessionId);
      }),
    );

    this.trackSubscription(
      $(this.room.state).players.onRemove((_player, sessionId: string) => {
        const entry = this.visuals.get(sessionId);
        if (!entry) return;
        entry.body.destroy();
        entry.label.destroy();
        this.visuals.delete(sessionId);
      }),
    );

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

    this.trackSubscription(
      $(this.room.state).enemies.onAdd((enemy, enemyId: string) => {
        addEnemyVisual(enemy, enemyId);
      }),
    );

    this.trackSubscription(
      $(this.room.state).enemies.onRemove((_enemy, enemyId: string) => {
        const entry = this.enemyVisuals.get(enemyId);
        if (!entry) return;
        entry.body.destroy();
        this.enemyVisuals.delete(enemyId);
      }),
    );

    this.room.state.enemies.forEach((enemy: any, enemyId: string) => {
      addEnemyVisual(enemy, enemyId);
    });
  }

  private showEnemyDefeat(enemyId: string, enemy: any, entry: EnemyVisual) {
    if (entry.defeatShown) return;
    entry.defeatShown = true;

    const isAnt = enemy.kind === "ant";
    const x = entry.body.x;
    const y = entry.body.y;
    const facingRight = enemy.facing >= 0;

    let defeatScale = isAnt ? ANT_SCALE : RAVEN_DEFEAT_SCALE;
    if (!isAnt && entry.isSprite) {
      defeatScale =
        (entry.body as Phaser.GameObjects.Sprite).displayHeight / RAVEN_DEFEAT_FRAME_HEIGHT;
    }

    entry.body.destroy();
    this.enemyVisuals.delete(enemyId);

    const hasDefeat = isAnt ? this.hasAntDefeatSprite : this.hasRavenDefeatSprite;
    const defeatKey = isAnt ? ANT_DEFEAT_KEY : RAVEN_DEFEAT_KEY;
    const animKey = isAnt ? "ant-defeat" : "raven-defeat";

    if (!hasDefeat || !this.anims.exists(animKey)) return;

    const sprite = this.add.sprite(x, y, defeatKey, 0);
    this.defeatEffects.add(sprite);
    sprite.setOrigin(0.5, isAnt ? 1 : 0.55);
    sprite.setScale(defeatScale);
    sprite.setFlipX(!facingRight);
    sprite.setDepth(91);
    sprite.play(animKey);

    if (!isAnt) {
      const fallDuration = (RAVEN_DEFEAT_FRAMES.length / RAVEN_DEFEAT_FRAME_RATE) * 1000;
      this.tweens.add({
        targets: sprite,
        y: y + RAVEN_DEFEAT_FALL_PX,
        duration: fallDuration,
        ease: "Quad.easeIn",
      });
    }

    const holdMs = isAnt ? DEFEAT_HOLD_MS : RAVEN_DEFEAT_HOLD_MS;
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.time.delayedCall(holdMs, () => {
        this.defeatEffects.delete(sprite);
        sprite.destroy();
      });
    });
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

    this.trackSubscription(
      $(this.room.state).feathers.onAdd((feather, featherId: string) => {
        addFeatherVisual(feather, featherId);
      }),
    );

    this.trackSubscription(
      $(this.room.state).feathers.onRemove((_feather, featherId: string) => {
        const sprite = this.featherVisuals.get(featherId);
        if (!sprite) return;
        sprite.destroy();
        this.featherVisuals.delete(featherId);
      }),
    );

    this.room.state.feathers.forEach((feather: any, featherId: string) => {
      addFeatherVisual(feather, featherId);
    });
  }

  private bindBossProjectileState() {
    const $ = getStateCallbacks(this.room);

    const addBossProjectileVisual = (projectile: any, projectileId: string) => {
      if (this.bossProjectileVisuals.has(projectileId)) return;

      let visual: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
      if (this.hasBossLightOrbSprite) {
        const scale =
          BOSS_PROJECTILE_DISPLAY_SIZE / Math.max(BOSS_LIGHT_ORB_CROP.width, BOSS_LIGHT_ORB_CROP.height);
        visual = this.add
          .image(projectile.x, projectile.y, BOSS_LIGHT_ORB_KEY)
          .setOrigin(0.5)
          .setScale(scale);
      } else {
        visual = this.add.rectangle(
          projectile.x,
          projectile.y,
          BOSS_PROJECTILE_DISPLAY_SIZE,
          BOSS_PROJECTILE_DISPLAY_SIZE,
          0xfff3a1,
        );
        visual.setStrokeStyle(2, 0x8a78e8);
      }
      visual.setDepth(108);
      this.bossProjectileVisuals.set(projectileId, visual);
    };

    this.trackSubscription(
      $(this.room.state).bossProjectiles.onAdd((projectile, projectileId: string) => {
        addBossProjectileVisual(projectile, projectileId);
      }),
    );

    this.trackSubscription(
      $(this.room.state).bossProjectiles.onRemove((_projectile, projectileId: string) => {
        const visual = this.bossProjectileVisuals.get(projectileId);
        if (!visual) return;
        visual.destroy();
        this.bossProjectileVisuals.delete(projectileId);
      }),
    );

    this.room.state.bossProjectiles.forEach((projectile: any, projectileId: string) => {
      addBossProjectileVisual(projectile, projectileId);
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

      const unsubscribe = $(nugget).listen("active", (active: boolean) => {
        sprite.setVisible(active);
      });
      if (typeof unsubscribe === "function") {
        this.nuggetSubscriptions.set(nuggetId, [unsubscribe]);
      }
    };

    this.trackSubscription(
      $(this.room.state).nuggets.onAdd((nugget, nuggetId: string) => {
        addNuggetVisual(nugget, nuggetId);
      }),
    );

    this.trackSubscription(
      $(this.room.state).nuggets.onRemove((_nugget, nuggetId: string) => {
        const subscriptions = this.nuggetSubscriptions.get(nuggetId) ?? [];
        for (const unsubscribe of subscriptions) unsubscribe();
        this.nuggetSubscriptions.delete(nuggetId);

        const sprite = this.nuggetVisuals.get(nuggetId);
        if (!sprite) return;
        sprite.destroy();
        this.nuggetVisuals.delete(nuggetId);
      }),
    );

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

    this.trackSubscription($(this.room.state).boss.listen("waiting", syncBossVisual));
    this.trackSubscription($(this.room.state).boss.listen("facing", syncBossVisual));
    this.trackSubscription($(this.room.state).boss.listen("action", syncBossVisual));
    this.trackSubscription($(this.room.state).boss.listen("attackFrame", syncBossVisual));
    this.trackSubscription(
      $(this.room.state).boss.listen("alive", (alive: boolean) => {
        if (!alive) this.showBossDefeat();
        else syncBossVisual();
      }),
    );
  }

  private showBossDefeat() {
    if (this.bossDefeatShown || !this.bossVisual) return;
    this.bossDefeatShown = true;

    const boss = this.room.state.boss;
    const entry = this.bossVisual;
    const x = entry.root.x;
    const y = entry.root.y;
    const facingRight = boss.facing >= 0;

    let defeatScale = BOSS_DEFEAT_SCALE;
    if (entry.walkSprite) {
      defeatScale = entry.walkSprite.displayHeight / BOSS_DEFEAT_FRAME_HEIGHT;
    } else if (entry.idleSprite) {
      defeatScale = entry.idleSprite.displayHeight / BOSS_DEFEAT_FRAME_HEIGHT;
    } else if (entry.stompSprite) {
      defeatScale = entry.stompSprite.displayHeight / BOSS_DEFEAT_FRAME_HEIGHT;
    } else if (entry.castSprite) {
      defeatScale = entry.castSprite.displayHeight / BOSS_DEFEAT_FRAME_HEIGHT;
    }

    entry.root.setVisible(false);

    if (!this.hasBossDefeatSprite || !this.anims.exists("boss-defeat")) return;

    const sprite = this.add.sprite(x, y, BOSS_DEFEAT_KEY, 0);
    sprite.setOrigin(0.5, 1);
    sprite.setScale(defeatScale);
    sprite.setFlipX(!facingRight);
    sprite.setDepth(110);
    sprite.play("boss-defeat");
    this.bossDefeatSprite = sprite;
  }

  private createBossVisual() {
    const boss = this.room.state.boss;

    if (
      this.hasBossSprite ||
      this.hasBossFrontSprite ||
      this.hasBossStompSprite ||
      this.hasBossCastSprite
    ) {
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

      let stompSprite: Phaser.GameObjects.Sprite | null = null;
      if (this.hasBossStompSprite) {
        stompSprite = this.add.sprite(0, 0, BOSS_STOMP_KEY, 0);
        stompSprite.setOrigin(0.5, 1);
        stompSprite.setScale(BOSS_SCALE);
        stompSprite.setVisible(false);
        container.add(stompSprite);
      }

      let castSprite: Phaser.GameObjects.Sprite | null = null;
      if (this.hasBossCastSprite) {
        castSprite = this.add.sprite(0, 0, BOSS_CAST_KEY, 0);
        castSprite.setOrigin(0.5, 1);
        castSprite.setScale(BOSS_SCALE);
        castSprite.setVisible(false);
        container.add(castSprite);
      }

      this.bossVisual = {
        root: container,
        idleSprite,
        walkSprite,
        stompSprite,
        castSprite,
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
      stompSprite: null,
      castSprite: null,
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
      if (this.currentPhase !== "playing") return;
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
    this.cleanupCallbacks.push(() => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    });

    const canvas = this.game.canvas;
    const focusCanvas = () => canvas.focus();
    canvas.setAttribute("tabindex", "0");
    canvas.style.outline = "none";
    canvas.addEventListener("pointerdown", focusCanvas);
    this.cleanupCallbacks.push(() => {
      canvas.removeEventListener("pointerdown", focusCanvas);
      keyboard?.removeCapture([
        "W", "A", "S", "D", "SPACE", "F", "ENTER",
        "UP", "DOWN", "LEFT", "RIGHT",
      ]);
    });
    canvas.focus();
  }

  update(time: number, delta: number) {
    this.sendInput();
    this.interpolatePlayers(delta);
    this.interpolateEnemies(delta);
    this.interpolateFeathers(delta);
    this.interpolateBossProjectiles(delta);
    this.interpolateBoss(delta);
    this.updateBackground(time);
    this.updateStatusText();
  }

  private sendInput() {
    if (!this.connected || this.currentPhase !== "playing") return;

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
      if (
        !entry.defeatAnimStarted &&
        this.hasPlayerDefeatSprite &&
        this.anims.exists("player-defeat")
      ) {
        sprite.setTexture(PLAYER_DEFEAT_KEY, 0);
        sprite.setScale(this.playerDefeatScale);
        sprite.setFlipX(player.facing < 0);
        sprite.anims.stop();
        sprite.play("player-defeat");
        entry.showingDefeat = true;
        entry.defeatAnimStarted = true;
        entry.currentAnim = null;
      }
      entry.body.setAlpha(0.85);
      entry.label.setText(`${player.name} (tot)`);
      return;
    }

    if (entry.defeatAnimStarted || entry.showingDefeat) {
      sprite.setTexture(SPRITE_KEY, 0);
      sprite.setScale(SPRITE_SCALE);
      entry.showingDefeat = false;
      entry.defeatAnimStarted = false;
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

  private interpolateBossProjectiles(delta: number) {
    const t = Math.min(1, (INTERP_SPEED * delta) / 1000);

    this.room.state.bossProjectiles.forEach((projectile: any, projectileId: string) => {
      const visual = this.bossProjectileVisuals.get(projectileId);
      if (!visual) return;
      visual.setPosition(
        Phaser.Math.Linear(visual.x, projectile.x, t),
        Phaser.Math.Linear(visual.y, projectile.y, t),
      );
    });
  }

  private interpolateBoss(delta: number) {
    const entry = this.bossVisual;
    if (!entry) return;

    const boss = this.room.state.boss;
    if (!boss.alive) {
      if (this.bossDefeatShown) return;
      entry.root.setVisible(false);
      return;
    }
    entry.root.setVisible(true);

    const t = Math.min(1, (INTERP_SPEED * delta) / 1000);

    if (entry.walkSprite || entry.idleSprite || entry.stompSprite || entry.castSprite) {
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
    boss: { waiting: boolean; facing: number; action?: string; attackFrame?: number },
  ) {
    const facingRight = boss.facing >= 0;
    const action =
      boss.action === "travel" ||
      boss.action === "wait" ||
      boss.action === "stomp" ||
      boss.action === "cast" ||
      boss.action === "recovery"
        ? boss.action
        : boss.waiting
          ? "wait"
          : "travel";
    const next: BossVisual["mode"] =
      action === "travel"
        ? "walk"
        : action === "stomp"
          ? "stomp"
          : action === "cast"
            ? "cast"
            : "idle";
    const attackFrame = Phaser.Math.Clamp(
      Math.floor(boss.attackFrame ?? 0),
      0,
      BOSS_ATTACK_FRAME_COUNT - 1,
    );

    if (entry.walkSprite) {
      entry.walkSprite.setVisible(false);
      entry.walkSprite.setFlipX(!facingRight);
    }
    if (entry.idleSprite) {
      entry.idleSprite.setVisible(false);
      entry.idleSprite.setFlipX(!facingRight);
    }
    if (entry.stompSprite) {
      entry.stompSprite.setVisible(false);
      entry.stompSprite.setFlipX(!facingRight);
      entry.stompSprite.setFrame(attackFrame);
    }
    if (entry.castSprite) {
      entry.castSprite.setVisible(false);
      entry.castSprite.setFlipX(!facingRight);
      entry.castSprite.setFrame(attackFrame);
    }

    const desiredSprite =
      next === "walk"
        ? entry.walkSprite
        : next === "stomp"
          ? entry.stompSprite
          : next === "cast"
            ? entry.castSprite
            : entry.idleSprite;
    const fallbackSprite =
      entry.idleSprite ?? entry.walkSprite ?? entry.stompSprite ?? entry.castSprite;
    const visibleSprite = desiredSprite ?? fallbackSprite;
    if (
      visibleSprite &&
      !desiredSprite &&
      (visibleSprite === entry.stompSprite || visibleSprite === entry.castSprite)
    ) {
      visibleSprite.setFrame(0);
    }
    visibleSprite?.setVisible(true);

    if (entry.walkSprite && visibleSprite !== entry.walkSprite) {
      entry.walkSprite.anims.stop();
    } else if (entry.walkSprite && visibleSprite === entry.walkSprite) {
      if (entry.mode !== next) {
        entry.walkSprite.setFrame(0);
        entry.walkSprite.anims.stop();
      }
      if (!entry.walkSprite.anims.isPlaying && this.anims.exists("boss-walk")) {
        entry.walkSprite.play("boss-walk");
      }
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
