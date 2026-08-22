// Checks whether client/public/assets/player.png exists BEFORE Phaser's
// loader tries to fetch it. Without this, Phaser logs a scary-looking
// console error (though the game still works fine, see GameScene's
// rectangle fallback) every time the file is missing — which it will be
// until you add real pixel art. This keeps the console clean either way.
export const SPRITE_PATH = "assets/player.png";

let spriteAvailable = false;

export async function checkAssets(): Promise<void> {
  try {
    const res = await fetch(SPRITE_PATH, { method: "HEAD" });
    // Vite's dev/preview server answers an unmatched path with its SPA
    // fallback (index.html, status 200) instead of a real 404 — so "ok"
    // alone doesn't mean the file exists. Checking for an image
    // content-type filters that out.
    spriteAvailable = res.ok && (res.headers.get("content-type")?.startsWith("image/") ?? false);
  } catch {
    spriteAvailable = false;
  }
}

export function isSpriteAvailable(): boolean {
  return spriteAvailable;
}
