/**
 * Shared level layout, used by both the server (for authoritative
 * collision) and the client (for rendering). Keep this file in sync
 * with client/src/level.ts if you change it — see the README for why
 * they're two separate copies instead of one shared package.
 */

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;

export const PLATFORMS: Platform[] = [
  { x: 0, y: 688, width: 1280, height: 32 }, // ground
  { x: 150, y: 560, width: 200, height: 24 },
  { x: 450, y: 480, width: 200, height: 24 },
  { x: 750, y: 400, width: 200, height: 24 },
  { x: 1000, y: 560, width: 220, height: 24 },
  { x: 300, y: 320, width: 160, height: 24 },
  { x: 620, y: 250, width: 160, height: 24 },
];

export const SPAWN_POINTS = [
  { x: 60, y: 640 },
  { x: 160, y: 640 },
  { x: 1120, y: 640 },
  { x: 1220, y: 640 },
];

export const PLAYER_COLORS = [0xff5252, 0x448aff, 0x66bb6a, 0xffca28];

export const PLAYER_WIDTH = 28;
export const PLAYER_HEIGHT = 40;
