/**
 * Shared level layout, used by both the server (for authoritative
 * collision) and the client (for rendering). Keep this file in sync
 * with client/src/level.ts if you change it — see the README for why
 * they're two separate copies instead of one shared package.
 */

export type PlatformSegment = 0 | 1 | 2;

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
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

export const PLATFORM_SEGMENTS = [
  { srcX: 59, srcWidth: 228 },
  { srcX: 340, srcWidth: 254 },
  { srcX: 652, srcWidth: 313 },
] as const;

export const PLATFORM_LENGTH_SCALE = 0.55;
export const PLATFORM_GAP = 40;

function platformWidth(segment: PlatformSegment): number {
  return Math.round(PLATFORM_SEGMENTS[segment].srcWidth * PLATFORM_LENGTH_SCALE);
}

function floatingPlatform(x: number, y: number, segment: PlatformSegment): Platform {
  return { x, y, width: platformWidth(segment), height: 24, segment };
}

/** Matches GameRoom JUMP_VELOCITY/GRAVITY apex (~144 px). */
const MAX_JUMP_HEIGHT = 144;
/** Safe vertical step between tiers — climbable but not trivial. */
const STEP_UP = 110;

const LOW_Y = GROUND_SURFACE_Y - MAX_JUMP_HEIGHT;
const MID_Y = LOW_Y - STEP_UP;
const HIGH_Y = MID_Y - STEP_UP;

/**
 * Three tiers — fewer irregular blocks (4 / 3 / 3), same tier heights,
 * staggered in x so vertical hops stay within jump reach.
 */
export const PLATFORMS: Platform[] = [
  { x: 0, y: GROUND_SURFACE_Y, width: 1280, height: WORLD_HEIGHT - GROUND_SURFACE_Y, segment: 0 },
  // tier 1 — one max jump above ground
  floatingPlatform(80, LOW_Y, 2),
  floatingPlatform(380, LOW_Y, 0),
  floatingPlatform(680, LOW_Y, 1),
  floatingPlatform(980, LOW_Y, 2),
  // tier 2 — offset between tier-1 gaps
  floatingPlatform(200, MID_Y, 1),
  floatingPlatform(520, MID_Y, 2),
  floatingPlatform(900, MID_Y, 0),
  // tier 3 — highest
  floatingPlatform(120, HIGH_Y, 0),
  floatingPlatform(480, HIGH_Y, 2),
  floatingPlatform(850, HIGH_Y, 1),
];

export const SPAWN_POINTS = [
  { x: 60, y: GROUND_SURFACE_Y },
  { x: 160, y: GROUND_SURFACE_Y },
  { x: 1120, y: GROUND_SURFACE_Y },
  { x: 1220, y: GROUND_SURFACE_Y },
];

export const PLAYER_COLORS = [0xff5252, 0x448aff, 0x66bb6a, 0xffca28];

export const PLAYER_WIDTH = 28;
export const PLAYER_HEIGHT = 40;

export const RAVEN_WIDTH = 62;
export const RAVEN_HEIGHT = 56;

/** Ant hitbox — low and fast (server patrol + edge clamping). */
export const ANT_WIDTH = 32;
export const ANT_HEIGHT = 28;

export interface NuggetSpawn {
  id: string;
  x: number;
  y: number;
}

/** Collectible nuggets — y is feet/center height above platform surface. */
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

export interface AntSpawn {
  id: string;
  x: number;
  y: number;
  minX: number;
  maxX: number;
}

/** Ground + platform patrols — minX/maxX clamp to surface edges so ants never walk off. */
export const ANT_SPAWNS: AntSpawn[] = [
  { id: "ant-1", x: 320, y: GROUND_SURFACE_Y, minX: 20, maxX: 1260 },
  { id: "ant-2", x: 166, y: LOW_Y, minX: 96, maxX: 244 },
  { id: "ant-3", x: 750, y: LOW_Y, minX: 696, maxX: 804 },
  { id: "ant-4", x: 606, y: MID_Y, minX: 536, maxX: 684 },
];

export interface RavenSpawn {
  id: string;
  x: number;
  y: number;
  minX: number;
  maxX: number;
}

/** Flying raven patrol paths — server simulates, client renders. */
export const RAVEN_SPAWNS: RavenSpawn[] = [
  { id: "raven-1", x: 443, y: LOW_Y - 60, minX: 80, maxX: 820 },
  { id: "raven-2", x: 606, y: MID_Y - 60, minX: 200, maxX: 1025 },
  { id: "raven-3", x: 566, y: HIGH_Y - 60, minX: 120, maxX: 990 },
];

/** Boss hitbox — about 1/5 of the viewport height (720 / 5). */
export const BOSS_WIDTH = 96;
export const BOSS_HEIGHT = 144;

export interface BossWaypoint {
  x: number;
  y: number;
}

/** Feet positions on platform centers — boss loops left → right through tiers. */
export const BOSS_WAYPOINTS: BossWaypoint[] = [
  { x: 166, y: LOW_Y },
  { x: 443, y: LOW_Y },
  { x: 750, y: LOW_Y },
  { x: 1066, y: LOW_Y },
  { x: 270, y: MID_Y },
  { x: 606, y: MID_Y },
  { x: 963, y: MID_Y },
  { x: 183, y: HIGH_Y },
  { x: 566, y: HIGH_Y },
  { x: 920, y: HIGH_Y },
  { x: 640, y: GROUND_SURFACE_Y },
];
