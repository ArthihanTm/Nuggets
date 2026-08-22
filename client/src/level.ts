/**
 * Shared level layout — keep this in sync with server/src/level.ts.
 * The server is authoritative for collision; the client only uses this
 * to draw the platforms in the same place.
 */

export type PlatformSegment = 0 | 1 | 2;

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Which slice of platforms.png — 0=narrow, 1=medium, 2=wide. */
  segment: PlatformSegment;
}

export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;

/** Must match client/public/assets/background.png */
export const BACKGROUND_SOURCE_WIDTH = 1024;
export const BACKGROUND_SOURCE_HEIGHT = 572;
/** Top row of the foreground grass platform — player feet align here. */
export const BACKGROUND_GROUND_LINE_Y = 478;
export const BACKGROUND_OVERSCAN = 1.15;

const BACKGROUND_SCALE = Math.max(
  (WORLD_WIDTH * BACKGROUND_OVERSCAN) / BACKGROUND_SOURCE_WIDTH,
  WORLD_HEIGHT / BACKGROUND_SOURCE_HEIGHT,
);

/** Grass walk surface; brown dirt fills the pixels below down to the viewport bottom. */
export const GROUND_SURFACE_Y = Math.round(
  WORLD_HEIGHT - (BACKGROUND_SOURCE_HEIGHT - BACKGROUND_GROUND_LINE_Y) * BACKGROUND_SCALE,
);

/** platforms.png — three segments in one row; grass walk line at y=252. */
export const PLATFORM_SOURCE_WIDTH = 1024;
export const PLATFORM_SOURCE_HEIGHT = 559;
export const PLATFORM_GRASS_LINE_Y = 252;
export const PLATFORM_SEGMENTS = [
  { srcX: 59, srcWidth: 228 },
  { srcX: 340, srcWidth: 254 },
  { srcX: 652, srcWidth: 313 },
] as const;

/** Shorter in-game length — sprite height stays native, only width shrinks. */
export const PLATFORM_LENGTH_SCALE = 0.55;
export const PLATFORM_GAP = 40;

function platformWidth(segment: PlatformSegment): number {
  return Math.round(PLATFORM_SEGMENTS[segment].srcWidth * PLATFORM_LENGTH_SCALE);
}

function floatingPlatform(x: number, y: number, segment: PlatformSegment): Platform {
  return { x, y, width: platformWidth(segment), height: 24, segment };
}

/** Keep in sync with server/src/level.ts — tier heights derived from max jump. */
const MAX_JUMP_HEIGHT = 144;
const STEP_UP = 110;
const LOW_Y = GROUND_SURFACE_Y - MAX_JUMP_HEIGHT;
const MID_Y = LOW_Y - STEP_UP;
const HIGH_Y = MID_Y - STEP_UP;

export const PLATFORMS: Platform[] = [
  { x: 0, y: GROUND_SURFACE_Y, width: 1280, height: WORLD_HEIGHT - GROUND_SURFACE_Y, segment: 0 },
  floatingPlatform(80, LOW_Y, 2),
  floatingPlatform(380, LOW_Y, 0),
  floatingPlatform(680, LOW_Y, 1),
  floatingPlatform(980, LOW_Y, 2),
  floatingPlatform(200, MID_Y, 1),
  floatingPlatform(520, MID_Y, 2),
  floatingPlatform(900, MID_Y, 0),
  floatingPlatform(120, HIGH_Y, 0),
  floatingPlatform(480, HIGH_Y, 2),
  floatingPlatform(850, HIGH_Y, 1),
];

export const PLAYER_WIDTH = 28;
export const PLAYER_HEIGHT = 40;

export const RAVEN_WIDTH = 62;
export const RAVEN_HEIGHT = 56;

export const ANT_WIDTH = 32;
export const ANT_HEIGHT = 28;

export interface NuggetSpawn {
  id: string;
  x: number;
  y: number;
}

/** Keep in sync with server/src/level.ts */
export const NUGGET_SPAWNS: NuggetSpawn[] = [
  { id: "nugget-1", x: 443, y: LOW_Y - 20 },
  { id: "nugget-2", x: 750, y: LOW_Y - 20 },
  { id: "nugget-3", x: 606, y: MID_Y - 20 },
  { id: "nugget-4", x: 270, y: MID_Y - 20 },
  { id: "nugget-5", x: 566, y: HIGH_Y - 20 },
  { id: "nugget-6", x: 320, y: GROUND_SURFACE_Y - 20 },
  { id: "nugget-7", x: 960, y: GROUND_SURFACE_Y - 20 },
  { id: "nugget-8", x: 900, y: MID_Y - 20 },
];

/** Boss display size — about 1/5 of the viewport height (720 / 5). */
export const BOSS_WIDTH = 96;
export const BOSS_HEIGHT = 144;
