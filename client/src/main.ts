import Phaser from "phaser";
import { getStateCallbacks, Room } from "colyseus.js";
import { GameScene } from "./scenes/GameScene";
import { connect } from "./network";
import { checkAssets } from "./assets";
import { WORLD_WIDTH, WORLD_HEIGHT } from "./level";

type RoundPhase = "title" | "playing" | "won" | "lost";

const form = document.getElementById("join-form") as HTMLFormElement;
const nameInput = document.getElementById("name-input") as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLElement;
const overlay = document.getElementById("overlay") as HTMLElement;
const joinButton = document.getElementById("join-button") as HTMLButtonElement;
const lobbyView = document.getElementById("lobby-view") as HTMLElement;
const playerList = document.getElementById("player-list") as HTMLUListElement;
const readyButton = document.getElementById("ready-button") as HTMLButtonElement;
const lobbyStatus = document.getElementById("lobby-status") as HTMLElement;
const targetButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".target-button"),
);
const endOverlay = document.getElementById("end-overlay") as HTMLElement;
const endTitle = document.getElementById("end-title") as HTMLElement;
const returnButton = document.getElementById("return-button") as HTMLButtonElement;

let room: Room | null = null;
let game: Phaser.Game | null = null;
let connecting = false;
let roomCleanups: Array<() => void> = [];

function rememberCleanup(value: unknown) {
  if (typeof value === "function") roomCleanups.push(value as () => void);
}

function cleanupRoomBindings() {
  for (const cleanup of roomCleanups.splice(0)) cleanup();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (connecting || room) return;

  const name = nameInput.value.trim() || "Spieler";
  connecting = true;
  joinButton.disabled = true;
  statusEl.textContent = "Verbinde mit dem Server...";

  try {
    room = await connect(name);
    await checkAssets();
    nameInput.disabled = true;
    form.hidden = true;
    lobbyView.hidden = false;
    bindRoom(room);
    startGame();
    renderLobby();
    applySyncedPhase(room.state.phase as RoundPhase);
  } catch (err) {
    console.error(err);
    statusEl.textContent =
      "Verbindung fehlgeschlagen. Läuft der Server? (im server/ Ordner: npm run dev)";
    joinButton.disabled = false;
    room = null;
  } finally {
    connecting = false;
  }
});

readyButton.addEventListener("click", () => {
  if (!room || room.state.phase !== "title") return;
  const me = room.state.players.get(room.sessionId);
  if (!me) return;
  room.send("lobby:setReady", { ready: !me.ready });
});

for (const button of targetButtons) {
  button.addEventListener("click", () => {
    if (!room || room.state.phase !== "title") return;
    room.send("lobby:setTarget", { targetPlayers: Number(button.dataset.target) });
  });
}

returnButton.addEventListener("click", () => {
  if (!room || (room.state.phase !== "won" && room.state.phase !== "lost")) return;
  returnButton.disabled = true;
  room.send("round:returnToTitle");
});

window.addEventListener("nuggets:phasechange", (event) => {
  const phase = (event as CustomEvent<{ phase?: RoundPhase }>).detail?.phase;
  if (phase) requestAnimationFrame(applyCurrentPresentedPhase);
});

function bindRoom(nextRoom: Room) {
  cleanupRoomBindings();
  const $ = getStateCallbacks(nextRoom);
  const boundPlayers = new WeakSet<object>();

  const bindPlayer = (player: any) => {
    if (boundPlayers.has(player)) return;
    boundPlayers.add(player);
    rememberCleanup($(player).listen("name", renderLobby));
    rememberCleanup($(player).listen("ready", renderLobby));
  };

  rememberCleanup($(nextRoom.state).listen("phase", (phase: RoundPhase) => {
    applySyncedPhase(phase);
    renderLobby();
  }));
  rememberCleanup($(nextRoom.state).listen("targetPlayers", renderLobby));
  rememberCleanup($(nextRoom.state).listen("lobbyOwnerId", renderLobby));
  rememberCleanup($(nextRoom.state).players.onAdd((player: any) => {
    bindPlayer(player);
    renderLobby();
  }));
  rememberCleanup($(nextRoom.state).players.onRemove(renderLobby));
  nextRoom.state.players.forEach((player: any) => bindPlayer(player));

  rememberCleanup(nextRoom.onLeave(() => {
    cleanupRoomBindings();
    readyButton.disabled = true;
    returnButton.disabled = true;
    overlay.hidden = false;
    endOverlay.hidden = true;
    lobbyStatus.textContent = "Verbindung zum Server verloren.";
    if (game?.scene.isActive("Game")) game.scene.pause("Game");
  }));
}

function renderLobby() {
  if (!room) return;
  const state = room.state;
  const isTitle = state.phase === "title";
  const isOwner = state.lobbyOwnerId === room.sessionId;
  const me = state.players.get(room.sessionId);

  playerList.replaceChildren();
  state.players.forEach((player: any, sessionId: string) => {
    const item = document.createElement("li");
    if (player.ready) item.classList.add("ready");
    const name = document.createElement("span");
    name.textContent = `${player.name}${sessionId === state.lobbyOwnerId ? " ★" : ""}`;
    const readiness = document.createElement("span");
    readiness.textContent = player.ready ? "bereit" : "wartet";
    item.append(name, readiness);
    playerList.append(item);
  });

  for (const button of targetButtons) {
    const target = Number(button.dataset.target);
    button.classList.toggle("selected", target === state.targetPlayers);
    button.disabled =
      !isTitle || !isOwner || target < state.players.size;
  }

  readyButton.disabled = !isTitle || !me;
  readyButton.textContent = me?.ready ? "Nicht bereit" : "Bereit";
  const missing = Math.max(0, state.targetPlayers - state.players.size);
  const unready = Array.from(state.players.values()).filter((player: any) => !player.ready).length;
  lobbyStatus.textContent =
    missing > 0
      ? `Noch ${missing} Spieler erforderlich.`
      : unready > 0
        ? `Noch ${unready} Spieler nicht bereit.`
        : "Runde startet...";
}

function applySyncedPhase(phase: RoundPhase) {
  if (phase === "title") {
    returnButton.disabled = false;
    endOverlay.hidden = true;
    overlay.hidden = false;
    if (room) {
      form.hidden = true;
      lobbyView.hidden = false;
    }
    if (game?.scene.isActive("Game")) game.scene.pause("Game");
    return;
  }

  if (phase === "playing") {
    overlay.hidden = true;
    endOverlay.hidden = true;
    returnButton.disabled = false;
    if (game?.scene.isPaused("Game")) game.scene.resume("Game");
  }
}

function applyPresentedPhase(phase: RoundPhase) {
  applySyncedPhase(phase);
  if (phase !== "won" && phase !== "lost") return;

  overlay.hidden = true;
  endOverlay.hidden = false;
  endOverlay.classList.toggle("won", phase === "won");
  endOverlay.classList.toggle("lost", phase === "lost");
  endTitle.textContent = phase === "won" ? "Sieg!" : "Niederlage";
  if (game?.scene.isActive("Game")) game.scene.pause("Game");
}

function applyCurrentPresentedPhase() {
  if (!room) return;
  applyPresentedPhase(room.state.phase as RoundPhase);
}

function startGame() {
  if (game) return;
  game = new Phaser.Game({
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
