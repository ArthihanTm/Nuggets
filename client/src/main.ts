import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { connect } from "./network";
import { checkAssets } from "./assets";
import { WORLD_WIDTH, WORLD_HEIGHT } from "./level";

const form = document.getElementById("join-form") as HTMLFormElement;
const nameInput = document.getElementById("name-input") as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLElement;
const overlay = document.getElementById("overlay") as HTMLElement;
const joinButton = document.getElementById("join-button") as HTMLButtonElement;

let gameStarted = false;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (gameStarted) return;

  const name = nameInput.value.trim() || "Spieler";
  joinButton.disabled = true;
  statusEl.textContent = "Verbinde mit dem Server...";

  try {
    await connect(name);
    await checkAssets();
    gameStarted = true;
    overlay.style.display = "none";
    startGame();
  } catch (err) {
    console.error(err);
    statusEl.textContent =
      "Verbindung fehlgeschlagen. Läuft der Server? (im server/ Ordner: npm run dev)";
    joinButton.disabled = false;
  }
});

function startGame() {
  new Phaser.Game({
    type: Phaser.AUTO,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    parent: "game-container",
    backgroundColor: "#6ec0e8",
    pixelArt: true,
    roundPixels: true,
    scene: [GameScene],
  });
}
