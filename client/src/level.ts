/**
 * Shared level layout — keep this in sync with server/src/level.ts.
 * The server is authoritative for collision; the client only uses this
 * to draw the platforms in the same place.
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

export const PLAYER_WIDTH = 28;
export const PLAYER_HEIGHT = 40;
