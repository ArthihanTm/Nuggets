# Game-Screens und serverautoritatives Rundenmodell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen raumweit synchronisierten Ablauf `title -> playing -> won | lost -> title` mit serverautoritativem Start, Sieg, Team-Wipe-Niederlage, vollständigem Rundenreset sowie Lobby- und Endscreen-Overlays bauen.

**Architecture:** `GameRoom` bleibt alleiniger Besitzer von Phase, Lobbyregeln, Room-Lock, Simulation, Endbedingungen und Reset. `main.ts` hält genau eine Phaser-Instanz und rendert DOM-Overlays; die bestehende `GameScene` meldet synchronisierte Phasen über genau ein `"nuggets:phasechange"`-Event, stoppt Eingaben sofort und lässt vorhandene Defeat-Animationen vor dem Pausieren auslaufen.

**Tech Stack:** Node.js 22 Bordmittel (`node:test`, `node:assert/strict`), TypeScript 5.9, Colyseus 0.16 / `@colyseus/schema` 3, Phaser 4.2, Vite 8.

---

## Arbeitsgrundlage und Änderungsgrenzen

- Vor jeder Bearbeitung von `client/src/scenes/GameScene.ts`, `client/src/assets.ts`, `client/public/assets/boss-defeat.png` oder `client/scripts/test-multiplayer.mjs` den aktuellen `git diff -- <pfad>` erneut ansehen. Nur kleine Patches auf den dann aktuellen Inhalt anwenden; keine Datei durch eine ältere Komplettkopie ersetzen.
- `client/src/assets.ts` und `client/public/assets/boss-defeat.png` werden für dieses Vorhaben nicht geändert. Die vorhandene Boss-Defeat-Integration in `GameScene.ts` ist Grundlage für das Endscreen-Timing.
- Beim finalen Self-Review waren `.gitignore`, `client/scripts/test-multiplayer.mjs`, `client/src/scenes/GameScene.ts`, `server/Procfile`, `server/package.json` und `server/src/index.ts` geändert sowie `docs/` und `server/scripts/` untracked. Diese unabhängigen beziehungsweise parallel entstandenen Änderungen sind zu erhalten; der erneute Preflight-Status bei Ausführungsbeginn ist maßgeblich.
- `client/scripts/test-multiplayer.mjs` kann unabhängige lokale Änderungen enthalten. Seine Erweiterung erfolgt erst nach einem pfadspezifischen Diff und nur um die in Task 8 bezeichneten Helfer und Assertions.
- Es wird kein Commit ausgeführt oder eingeplant. Commits erfolgen ausschließlich nach einer späteren, separaten ausdrücklichen Freigabe.

## Geplante Dateistruktur

- Create: `server/src/rooms/roundRules.ts` — zustandsfreie Start-, Niederlagen- und Siegesprädikate.
- Create: `server/src/rooms/roundRules.test.ts` — schnelle Node-Bordmitteltests für alle Randfälle der Prädikate.
- Modify: `server/package.json` — ein fokussiertes Script zum Kompilieren und Ausführen des Node-Tests.
- Modify: `server/src/rooms/schema/GameState.ts` — synchronisierte Phase, Zielspielerzahl, Lobby-Owner und Spieler-Ready.
- Modify: `server/src/rooms/GameRoom.ts` — Lobby-Nachrichten, Locking, zentraler Reset, Phasengrenzen und terminale Übergänge.
- Modify: `client/index.html` — ein dauerhaft gebundenes Pixel-Panel für Join, Lobby und Endscreens.
- Modify: `client/src/main.ts` — DOM-Zustände, Room-Subscriptions, genau eine Phaser-Instanz und Pause/Resume.
- Modify: `client/src/scenes/GameScene.ts` — Phasenbeobachtung, visuelles End-Timing, Input-Guard, Visual-Reset und vollständiges Cleanup.
- Modify: `client/scripts/test-multiplayer.mjs` — Zwei-Client-Smoke-Test für Lobby, Guards, Team-Wipe, Rückkehr und nächsten Reset.

### Task 1: Reine Rundenregeln testgetrieben einführen

**Files:**
- Create: `server/src/rooms/roundRules.ts`
- Create: `server/src/rooms/roundRules.test.ts`
- Modify: `server/package.json:6-13`

- [ ] **Step 1: Working Tree und Zielpfade vor dem ersten Patch prüfen**

Run:

```powershell
git status --short
git diff -- server/package.json server/src/rooms/GameRoom.ts server/src/rooms/schema/GameState.ts client/index.html client/src/main.ts client/src/scenes/GameScene.ts client/src/assets.ts client/public/assets/boss-defeat.png client/scripts/test-multiplayer.mjs
```

Expected: Der Status wird dokumentiert; bestehende Änderungen bleiben unangetastet. Falls einer der Zielpfade einen Diff hat, wird jeder folgende Patch auf genau diesen aktuellen Inhalt zugeschnitten.

- [ ] **Step 2: Failing Node-Test für Start, Team-Wipe und Sieg schreiben**

Create `server/src/rooms/roundRules.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  canStartRound,
  isPlayingPhase,
  isRoundWon,
  isTeamWiped,
  type RoundPhase,
  type RoundEnemy,
  type RoundPlayer,
} from "./roundRules";

const player = (ready: boolean, alive = true): RoundPlayer => ({ ready, alive });
const enemy = (alive: boolean): RoundEnemy => ({ alive });

test("start requires exact target count and every player ready", () => {
  assert.equal(canStartRound([], 2), false);
  assert.equal(canStartRound([player(true)], 2), false);
  assert.equal(canStartRound([player(true), player(false)], 2), false);
  assert.equal(canStartRound([player(true), player(true)], 2), true);
  assert.equal(canStartRound([player(true), player(true), player(true)], 2), false);
});

test("only playing accepts gameplay input and simulation", () => {
  const phases: RoundPhase[] = ["title", "playing", "won", "lost"];
  assert.deepEqual(phases.map(isPlayingPhase), [false, true, false, false]);
});

test("defeat requires at least one player and a complete team wipe", () => {
  assert.equal(isTeamWiped([]), false);
  assert.equal(isTeamWiped([player(false, false), player(false, true)]), false);
  assert.equal(isTeamWiped([player(false, false), player(false, false)]), true);
});

test("victory requires a dead boss and no living regular enemy", () => {
  assert.equal(isRoundWon(true, []), false);
  assert.equal(isRoundWon(false, [enemy(true), enemy(false)]), false);
  assert.equal(isRoundWon(false, [enemy(false), enemy(false)]), true);
  assert.equal(isRoundWon(false, []), true);
});
```

- [ ] **Step 3: Test-Script ergänzen und RED nachweisen**

Add to `server/package.json` scripts:

```json
"test:round-rules": "tsc -p tsconfig.json && node --test dist/rooms/roundRules.test.js"
```

Run: `cd server; npm run test:round-rules`

Expected RED: TypeScript meldet `Cannot find module './roundRules'`.

- [ ] **Step 4: Minimale, iterable-kompatible Prädikate implementieren**

Create `server/src/rooms/roundRules.ts`:

```ts
export type RoundPhase = "title" | "playing" | "won" | "lost";

export interface RoundPlayer {
  ready: boolean;
  alive: boolean;
}

export interface RoundEnemy {
  alive: boolean;
}

export function isPlayingPhase(phase: RoundPhase): boolean {
  return phase === "playing";
}

export function canStartRound(
  players: Iterable<RoundPlayer>,
  targetPlayers: number,
): boolean {
  const entries = Array.from(players);
  return entries.length === targetPlayers && entries.every((entry) => entry.ready);
}

export function isTeamWiped(players: Iterable<RoundPlayer>): boolean {
  const entries = Array.from(players);
  return entries.length > 0 && entries.every((entry) => !entry.alive);
}

export function isRoundWon(
  bossAlive: boolean,
  enemies: Iterable<RoundEnemy>,
): boolean {
  return !bossAlive && Array.from(enemies).every((entry) => !entry.alive);
}
```

Die Signaturen akzeptieren Arrays in den Tests und `MapSchema.values()` in `GameRoom`; spätere Tasks verwenden exakt diese Namen und Parameterreihenfolge.

- [ ] **Step 5: GREEN nachweisen**

Run: `cd server; npm run test:round-rules`

Expected GREEN: vier Subtests bestehen, Summary enthält `pass 4` und `fail 0`.

### Task 2: Synchronisiertes Schema und serverautoritatives Lobby-Modell ergänzen

**Files:**
- Modify: `server/src/rooms/schema/GameState.ts:9-23,69-76`
- Modify: `server/src/rooms/GameRoom.ts:30-39,99-135,218-246`

- [ ] **Step 1: Schema-Verwendung zuerst einbauen und den TypeScript-RED-Zustand prüfen**

In `GameRoom.onCreate()` zunächst auf die noch nicht vorhandenen Felder referenzieren:

```ts
this.state.phase = "title";
this.state.targetPlayers = 2;
this.state.lobbyOwnerId = "";
```

Run: `cd server; npm run typecheck`

Expected RED: `GameState` besitzt `phase`, `targetPlayers` und `lobbyOwnerId` noch nicht.

- [ ] **Step 2: Schemafelder mit eindeutigen Defaults ergänzen**

In `Player` nach `spawnIndex`:

```ts
@type("boolean") ready = false;
```

In `GameState.ts` importiere den Union-Typ ohne Laufzeitabhängigkeit:

```ts
import type { RoundPhase } from "../roundRules";
```

In `GameState` vor den Maps:

```ts
@type("string") phase: RoundPhase = "title";
@type("number") targetPlayers = 2;
@type("string") lobbyOwnerId = "";
```

Run: `cd server; npm run typecheck`

Expected GREEN: Die neuen Felder kompilieren mit den vorhandenen Decorator-Einstellungen.

- [ ] **Step 3: Exakte Lobby-Payloadtypen und stabile Beitrittsreihenfolge anlegen**

Neben `JoinOptions`:

```ts
interface SetTargetMessage {
  targetPlayers?: unknown;
}

interface SetReadyMessage {
  ready?: unknown;
}
```

In `GameRoom` neben den Input-Maps:

```ts
private joinOrder: string[] = [];
```

In `onJoin`, unmittelbar nach dem Einfügen des Spielers:

```ts
player.ready = false;
this.joinOrder.push(client.sessionId);
if (!this.state.lobbyOwnerId) {
  this.state.lobbyOwnerId = client.sessionId;
}
this.refreshRoomAvailability();
this.tryStartRound();
```

In `onLeave`, nach dem Löschen der Input-Maps:

```ts
this.joinOrder = this.joinOrder.filter((sessionId) => sessionId !== client.sessionId);
if (this.state.phase === "title") {
  this.normalizeLobbyOwner();
  this.refreshRoomAvailability();
  this.tryStartRound();
} else if (
  this.state.phase === "playing" &&
  isTeamWiped(this.state.players.values())
) {
  this.state.phase = "lost";
  this.refreshRoomAvailability();
}
```

Damit bleibt die Aussage „`lost` genau bei mindestens einem vorhandenen und ausschließlich toten Spielern“ auch dann wahr, wenn während `playing` ein noch lebender Spieler den Room verlässt. Verlässt der letzte Spieler den Room, liefert `isTeamWiped([])` weiterhin `false`.

- [ ] **Step 4: Lobby-Owner, Locking und Startprüfung als kleine Methoden ergänzen**

Import at `GameRoom.ts:10`:

```ts
import {
  canStartRound,
  isPlayingPhase,
  isRoundWon,
  isTeamWiped,
} from "./roundRules";
```

Add:

```ts
private normalizeLobbyOwner() {
  if (this.state.phase !== "title") return;
  const currentOwnerStillPresent =
    this.state.lobbyOwnerId !== "" &&
    this.state.players.has(this.state.lobbyOwnerId);
  if (!currentOwnerStillPresent) {
    this.state.lobbyOwnerId =
      this.joinOrder.find((sessionId) => this.state.players.has(sessionId)) ?? "";
  }
}

private refreshRoomAvailability() {
  if (
    this.state.phase === "title" &&
    this.state.players.size < this.state.targetPlayers
  ) {
    this.unlock();
  } else {
    this.lock();
  }
}

private tryStartRound() {
  if (this.state.phase !== "title") return;
  if (!canStartRound(this.state.players.values(), this.state.targetPlayers)) return;
  this.resetRound();
  this.state.phase = "playing";
  this.refreshRoomAvailability();
}
```

`resetRound()` wird in Task 3 vollständig definiert. Bis dahin ist ein TypeScript-Fehler wegen der fehlenden Methode das erwartete Zwischenresultat; Task 2 wird zusammen mit dem minimalen Stub aus dem nächsten Schritt grün abgeschlossen.

- [ ] **Step 5: Lobby-Nachrichten strikt nach Phase, Owner und Payload validieren**

In `onCreate()` vor dem Simulationstakt:

```ts
this.onMessage("lobby:setTarget", (client, message: SetTargetMessage) => {
  if (this.state.phase !== "title") return;
  if (client.sessionId !== this.state.lobbyOwnerId) return;
  const targetPlayers = message?.targetPlayers;
  if (
    typeof targetPlayers !== "number" ||
    !Number.isInteger(targetPlayers) ||
    targetPlayers < 2 ||
    targetPlayers > 4 ||
    targetPlayers < this.state.players.size
  ) {
    return;
  }
  this.state.targetPlayers = targetPlayers;
  this.refreshRoomAvailability();
  this.tryStartRound();
});

this.onMessage("lobby:setReady", (client, message: SetReadyMessage) => {
  if (this.state.phase !== "title") return;
  if (typeof message?.ready !== "boolean") return;
  const player = this.state.players.get(client.sessionId);
  if (!player) return;
  player.ready = message.ready;
  this.tryStartRound();
});
```

Vor Task 3 vorübergehend exakt diesen Stub ergänzen, damit Task 2 isoliert typgeprüft werden kann:

```ts
private resetRound() {
  this.state.players.forEach((player) => {
    player.ready = false;
  });
}
```

Run: `cd server; npm run typecheck`

Expected GREEN: Lobbytypen, Schemafelder, `lock()`/`unlock()` und die pure Startregel kompilieren ohne Fehler.

### Task 3: Vollständigen zentralen Rundenreset implementieren

**Files:**
- Modify: `server/src/rooms/GameRoom.ts:102-117,137-198,218-239`

- [ ] **Step 1: Reset-Nachbedingungen gegen den noch unvollständigen Stub abgrenzen**

Der Task ersetzt den Stub aus Task 2. Die Implementierung muss in genau einer Methode Spieler/Ready/Inputflanken, Gegner/Boss/Projektile/Federn/Nuggets sowie sämtliche Counter, Simulations- und Boss-Timingfelder setzen. Die folgenden beiden Schritte liefern den vollständigen Methodenkörper.

Vor dem Ersetzen Run: `cd server; npm run typecheck`

Expected: Der Stub ist typkorrekt, aber verhaltensseitig unvollständig. Die ausführbaren Reset-Assertions werden in Task 8 vor dessen RED-Lauf eingefügt; Task 3 implementiert exakt deren aufgezählte öffentliche Nachbedingungen. Die pure Regel-Suite bleibt auf Start-/Endprädikate begrenzt und wird nicht zu einem Room-Mock-Test ausgeweitet.

- [ ] **Step 2: Spieler in stabiler Join-Reihenfolge vollständig zurücksetzen**

Ersetze den Stub und beginne die Methode mit:

```ts
private resetRound() {
  let activeIndex = 0;
  for (const sessionId of this.joinOrder) {
    const player = this.state.players.get(sessionId);
    if (!player) continue;
    const spawnIndex = activeIndex % SPAWN_POINTS.length;
    const spawn = SPAWN_POINTS[spawnIndex];

    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    player.facing = 1;
    player.color = PLAYER_COLORS[spawnIndex % PLAYER_COLORS.length];
    player.lives = DUCK_MAX_LIVES;
    player.alive = true;
    player.invulnRemaining = 0;
    player.featherCooldown = 0;
    player.spawnIndex = spawnIndex;
    player.ready = false;

    this.inputs.set(sessionId, {
      left: false,
      right: false,
      jump: false,
      shoot: false,
    });
    this.prevJump.set(sessionId, false);
    this.prevShoot.set(sessionId, false);
    activeIndex++;
  }
```

Namen, `joinOrder`, `lobbyOwnerId` und `targetPlayers` werden nicht verändert.

- [ ] **Step 3: Maps neu befüllen und alle internen Counter zurücksetzen**

Direkt anschließend innerhalb derselben Methode:

```ts
  this.state.enemies.clear();
  this.spawnEnemies();

  this.state.bossProjectiles.clear();
  this.state.feathers.clear();
  this.featherCounter = 0;

  this.spawnBoss();

  this.state.nuggets.clear();
  this.spawnNuggets();

  this.simTime = 0;
}
```

`spawnBoss()` setzt bereits Bossposition, Facing, `waiting`, `action`, `attackFrame`, HP, Alive sowie `bossWaypointIndex`, Reiseziele, Reise-/Phasenzeiten, nächste Attacke, Trigger, Landepunkt und `bossProjectileCounter` zurück. Diese bestehende Methode wird nicht dupliziert.

- [ ] **Step 4: Join-Initialisierung mit denselben stabilen Grundwerten ausrichten**

In `onJoin` bleibt die existierende Initialisierung erhalten, wird aber um diese expliziten Werte ergänzt:

```ts
player.vx = 0;
player.vy = 0;
player.grounded = true;
player.facing = 1;
player.ready = false;
```

Run:

```powershell
cd server
npm run typecheck
npm run test:round-rules
```

Expected GREEN: Typecheck erfolgreich; vier Regeltests bestehen.

### Task 4: Phasengrenzen, Input-Guard und terminale Bedingungen verdrahten

**Files:**
- Modify: `server/src/rooms/GameRoom.ts:119-135,248-264,384-467,605-720,685-747`

- [ ] **Step 1: Außerhalb `playing` Input und den gesamten Simulationstick abweisen**

Ersetze den Anfang des bestehenden Input-Handlers:

```ts
this.onMessage("input", (client, message: PlayerInput) => {
  if (!isPlayingPhase(this.state.phase)) return;
  this.inputs.set(client.sessionId, {
    left: !!message?.left,
    right: !!message?.right,
    jump: !!message?.jump,
    shoot: !!message?.shoot,
  });
});
```

Ersetze den Beginn von `update()`:

```ts
private update(deltaMs: number) {
  if (!isPlayingPhase(this.state.phase)) return;
  const dt = Math.min(deltaMs, 50) / 1000;
  this.simTime += dt;
```

Nach jedem potenziell terminalen Teilschritt sofort abbrechen:

```ts
if (this.state.boss.alive) {
  this.updateBoss(dt);
  if (this.state.phase !== "playing") return;
}
this.updateBossProjectiles(dt);
if (this.state.phase !== "playing") return;
this.updatePlayers(dt);
this.processShooting(dt);
this.updateFeathers(dt);
if (this.state.phase !== "playing") return;
this.checkPlayerEnemyCollisions();
if (this.state.phase !== "playing") return;
this.checkPlayerBossCollisions();
if (this.state.phase !== "playing") return;
this.checkNuggetPickups();
```

Die Guards und Prädikate wurden in Task 1 bereits RED/GREEN getestet; ihre Room-Integration wird in Task 8 zunächst gegen den alten Ablauf rot und anschließend gegen diese Implementierung grün ausgeführt.

- [ ] **Step 2: Team-Wipe ausschließlich unmittelbar nach einem Tod setzen**

Ändere `applyContactDamage` auf die konsistente Signatur:

```ts
private applyContactDamage(player: Player): boolean {
  if (
    this.state.phase !== "playing" ||
    !player.alive ||
    player.invulnRemaining > 0
  ) {
    return false;
  }

  player.lives--;
  player.invulnRemaining = INVULNERABLE_TIME;
  if (player.lives > 0) return false;

  player.lives = 0;
  player.alive = false;
  this.respawnAtSpawn(player);
  if (isTeamWiped(this.state.players.values())) {
    this.state.phase = "lost";
    this.refreshRoomAvailability();
    return true;
  }
  return false;
}
```

Jeder Aufrufer stoppt seine Schleife, sobald `true` zurückkommt. Beispiel für Shockwave:

```ts
if (this.applyContactDamage(player)) return;
```

Bei `MapSchema.forEach` zusätzlich am Anfang jedes Callbacks prüfen:

```ts
if (this.state.phase !== "playing") return;
```

Dies ist insbesondere in `applyBossShockwave`, `updateBossProjectiles`, `checkPlayerEnemyCollisions` und `checkPlayerBossCollisions` nötig, damit nach dem ersten Team-Wipe im aktuellen Tick weder weitere Treffer noch Nugget-Wiederbelebungen stattfinden.

Direkt nach `applyBossShockwave()` in `updateBossAttack()` verhindert derselbe Guard, dass der Boss nach einem terminalen Shockwave noch in `recovery` wechselt:

```ts
this.applyBossShockwave();
if (this.state.phase !== "playing") return;
```

In `updateBossProjectiles()` und den beiden Kollisionsmethoden steht der Guard sowohl am Anfang jedes äußeren `forEach`-Callbacks als auch unmittelbar nach der inneren Player-Schleife. So werden nach einem `true` aus `applyContactDamage()` weder Projektile entfernt noch weitere Kollisionen verarbeitet.

- [ ] **Step 3: Eine gemeinsame Siegsprüfung nach jedem Boss- und Gegnertod aufrufen**

Add:

```ts
private checkVictoryAfterDeath(): boolean {
  if (
    this.state.phase === "playing" &&
    isRoundWon(this.state.boss.alive, this.state.enemies.values())
  ) {
    this.state.phase = "won";
    this.refreshRoomAvailability();
    return true;
  }
  return false;
}
```

Nach Boss-Tod in `updateFeathers()`:

```ts
boss.hp = 0;
boss.alive = false;
boss.action = "recovery";
boss.attackFrame = 0;
boss.waiting = true;
this.checkVictoryAfterDeath();
```

Nach regulärem Feder-Tod:

```ts
if (enemy.featherHits <= 0) {
  enemy.featherHits = 0;
  enemy.alive = false;
  this.checkVictoryAfterDeath();
}
```

Nach Stomp-Tod:

```ts
enemy.alive = false;
player.vy = JUMP_VELOCITY * 0.35;
player.grounded = false;
this.checkVictoryAfterDeath();
return;
```

In `updateFeathers()` und `checkPlayerEnemyCollisions()` muss nach jeder dieser Stellen bei `phase !== "playing"` die äußere Verarbeitung beendet werden. Die Bedingung bleibt exakt: `boss.alive === false` **und** alle Einträge in `enemies` haben `alive === false`. Boss-Tod allein gewinnt nicht, solange ein regulärer Gegner lebt.

- [ ] **Step 4: Rückkehrnachricht idempotent und raumweit implementieren**

In `onCreate()`:

```ts
this.onMessage("round:returnToTitle", () => {
  if (this.state.phase !== "won" && this.state.phase !== "lost") return;
  this.state.phase = "title";
  this.state.players.forEach((player) => {
    player.ready = false;
  });
  this.normalizeLobbyOwner();
  this.refreshRoomAvailability();
});
```

Der Gameplay-State bleibt hier absichtlich unverändert und eingefroren. Erst `tryStartRound()` ruft beim nächsten All-ready-Start `resetRound()` auf.

- [ ] **Step 5: Server-Verifikation ausführen**

Run:

```powershell
cd server
npm run typecheck
npm run test:round-rules
```

Expected GREEN: Typecheck erfolgreich; Regeltests belegen die Guards aller vier Phasen, Null-Spieler-Nichtniederlage, exakten Start und die kombinierte Boss-/Enemy-Siegbedingung.

### Task 5: Kombiniertes Join-, Lobby- und Endscreen-DOM bauen

**Files:**
- Modify: `client/index.html:8-96`

- [ ] **Step 1: Fehlende Lobby-DOM-Struktur mit einem Bordmittel-Check rot nachweisen**

Run:

```powershell
node -e "const fs=require('node:fs');const html=fs.readFileSync('client/index.html','utf8');for(const id of ['lobby-view','player-list','ready-button','end-view','return-button'])if(!html.includes('id=\"'+id+'\"'))throw new Error('missing '+id)"
```

Expected RED: Der Prozess endet mit `Error: missing lobby-view`.

- [ ] **Step 2: Die benötigten statischen DOM-IDs einfügen**

Ersetze nur den Inhalt von `#overlay` durch:

```html
<div id="overlay" data-phase="title">
  <section id="screen-panel" class="pixel-panel">
    <h1>Nuggets</h1>

    <form id="join-form">
      <label for="name-input">Dein Name</label>
      <input id="name-input" type="text" maxlength="16" autofocus />
      <button id="join-button" type="submit">Beitreten</button>
    </form>

    <div id="lobby-view" hidden>
      <p id="lobby-status"></p>
      <ul id="player-list" aria-label="Spielerliste"></ul>
      <fieldset id="target-fieldset">
        <legend>Zielspielerzahl</legend>
        <div id="target-options">
          <button type="button" data-target-players="2">2</button>
          <button type="button" data-target-players="3">3</button>
          <button type="button" data-target-players="4">4</button>
        </div>
      </fieldset>
      <button id="ready-button" type="button">Bereit</button>
      <p class="controls">Laufen: WASD/Pfeile · Springen: W/↑/Leertaste · Feder: F/Enter</p>
    </div>

    <div id="end-view" hidden>
      <h2 id="end-title"></h2>
      <button id="return-button" type="button">Zurück zur Lobby</button>
    </div>

    <div id="status" role="status"></div>
  </section>
</div>
```

- [ ] **Step 3: Pixel-Styling und phasenabhängigen Tint konkret ergänzen**

Ersetze die bisherigen `#join-form`-spezifischen Panelregeln durch:

```css
#overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 20, 0.82);
  z-index: 10;
}
#overlay[data-phase="won"] { background: rgba(104, 72, 12, 0.68); }
#overlay[data-phase="lost"] { background: rgba(8, 8, 18, 0.82); }
.pixel-panel {
  width: min(440px, calc(100vw - 40px));
  box-sizing: border-box;
  padding: 28px;
  border: 4px solid #f2c14e;
  border-radius: 2px;
  background: #24243e;
  box-shadow: 8px 8px 0 #111126;
}
.pixel-panel h1, .pixel-panel h2 { margin: 0 0 18px; color: #f2c14e; }
#join-form, #lobby-view, #end-view { display: flex; flex-direction: column; gap: 12px; }
[hidden] { display: none !important; }
input, button {
  padding: 10px 12px;
  border: 2px solid #111126;
  border-radius: 0;
  font: inherit;
}
button { background: #f2c14e; color: #1a1a2e; font-weight: 700; cursor: pointer; }
button:disabled { opacity: 0.45; cursor: default; }
#target-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
#target-options button[aria-pressed="true"] { outline: 3px solid #e8792b; }
#player-list { margin: 0; padding: 0; list-style: none; }
#player-list li { display: flex; justify-content: space-between; padding: 5px 0; }
.ready-state { color: #8fbf7f; }
.waiting-state, #status { color: #ffb4b4; }
.controls { margin: 4px 0 0; font-size: 13px; line-height: 1.5; }
```

- [ ] **Step 4: DOM-Check und Markup-Build grün prüfen**

Run:

```powershell
node -e "const fs=require('node:fs');const html=fs.readFileSync('client/index.html','utf8');for(const id of ['lobby-view','player-list','ready-button','end-view','return-button'])if(!html.includes('id=\"'+id+'\"'))throw new Error('missing '+id)"
cd client
npm run build
```

Expected GREEN: Der DOM-Check beendet sich ohne Ausgabe; Vite übernimmt das neue HTML und CSS, ohne neue Assets anzufordern.

### Task 6: `main.ts` als einmaligen DOM- und Phaser-Orchestrator umbauen

**Files:**
- Modify: `client/src/main.ts:1-48`

- [ ] **Step 1: Typen, DOM-Referenzen und Room-State-Verwendung zuerst hinzufügen**

Verwende exakt:

```ts
import Phaser from "phaser";
import { getStateCallbacks, type Room } from "colyseus.js";
import { GameScene, type RoundPhase } from "./scenes/GameScene";
```

Ergänze die DOM-Referenzen:

```ts
const lobbyView = document.getElementById("lobby-view") as HTMLElement;
const lobbyStatus = document.getElementById("lobby-status") as HTMLElement;
const playerList = document.getElementById("player-list") as HTMLUListElement;
const targetFieldset = document.getElementById("target-fieldset") as HTMLFieldSetElement;
const targetButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-target-players]"),
);
const readyButton = document.getElementById("ready-button") as HTMLButtonElement;
const endView = document.getElementById("end-view") as HTMLElement;
const endTitle = document.getElementById("end-title") as HTMLElement;
const returnButton = document.getElementById("return-button") as HTMLButtonElement;
```

State:

```ts
let game: Phaser.Game | null = null;
let room: Room | null = null;
let roomUnsubscribes: Array<() => void> = [];
const playerUnsubscribes = new Map<string, Array<() => void>>();
```

Run: `cd client; npm run typecheck`

Expected RED: `GameScene` exportiert `RoundPhase` noch nicht; TypeScript meldet den fehlenden Export. Für den GREEN-Zwischenstand von Task 6 wird der Import vorübergehend in diese zwei Zeilen geändert:

```ts
import { GameScene } from "./scenes/GameScene";
type RoundPhase = "title" | "playing" | "won" | "lost";
```

In Task 7 wird der lokale Typ entfernt und der ursprüngliche `GameScene, type RoundPhase`-Import wiederhergestellt.

- [ ] **Step 2: Join-Handler so ändern, dass Phaser genau einmal entsteht**

Der Submit-Handler setzt nach `connect`:

```ts
room = await connect(name);
await checkAssets();
nameInput.disabled = true;
joinButton.disabled = true;
form.hidden = true;
statusEl.textContent = "";
bindRoomUi(room);
ensureGame();
renderLobby();
```

Die bisherige `gameStarted`-Variable entfällt. Implementiere:

```ts
function ensureGame() {
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
```

`overlay` bleibt nach dem Join sichtbar, weil der Room initial in `title` steht.

- [ ] **Step 3: Room-Subscriptions genau einmal binden und vollständig lösbar machen**

Implementiere:

```ts
function clearRoomSubscriptions() {
  for (const unsubscribe of roomUnsubscribes.splice(0)) unsubscribe();
  for (const unsubscribes of playerUnsubscribes.values()) {
    for (const unsubscribe of unsubscribes) unsubscribe();
  }
  playerUnsubscribes.clear();
}

function bindRoomUi(nextRoom: Room) {
  clearRoomSubscriptions();
  const $ = getStateCallbacks(nextRoom);
  const rerender = () => renderLobby();

  roomUnsubscribes.push(
    $(nextRoom.state).listen("targetPlayers", rerender),
    $(nextRoom.state).listen("lobbyOwnerId", rerender),
    $(nextRoom.state).players.onAdd((player, sessionId: string) => {
      playerUnsubscribes.set(sessionId, [
        $(player).listen("ready", rerender),
        $(player).listen("name", rerender),
      ]);
      rerender();
    }),
    $(nextRoom.state).players.onRemove((_player, sessionId: string) => {
      for (const unsubscribe of playerUnsubscribes.get(sessionId) ?? []) {
        unsubscribe();
      }
      playerUnsubscribes.delete(sessionId);
      rerender();
    }),
    nextRoom.onLeave(() => {
      clearRoomSubscriptions();
      statusEl.textContent = "Verbindung zum Server verloren.";
      overlay.style.display = "flex";
      readyButton.disabled = true;
      returnButton.disabled = true;
    }),
  );
}
```

Colyseus 0.16 liefert für `listen`, `onAdd`, `onRemove` und `Room.onLeave` jeweils eine Lösfunktion; die Snippets erfassen und lösen alle Rückgaben bei Spielerentfernung oder Room-Verlust.

- [ ] **Step 4: Lobby ausschließlich aus synchronisiertem State rendern**

Implementiere:

```ts
function renderLobby() {
  if (!room) return;
  const state = room.state as any;
  const players = Array.from(state.players.entries()) as Array<[string, any]>;
  const me = state.players.get(room.sessionId);
  const isOwner = state.lobbyOwnerId === room.sessionId;
  const missingPlayers = Math.max(0, state.targetPlayers - players.length);
  const waitingReady = players.filter(([, player]) => !player.ready).length;

  playerList.replaceChildren(
    ...players.map(([sessionId, player]) => {
      const item = document.createElement("li");
      const label = sessionId === room!.sessionId ? `${player.name} (du)` : player.name;
      item.innerHTML = `<span></span><span class="${player.ready ? "ready-state" : "waiting-state"}"></span>`;
      item.children[0].textContent = label;
      item.children[1].textContent = player.ready ? "Bereit" : "Wartet";
      return item;
    }),
  );

  targetFieldset.disabled = !isOwner || state.phase !== "title";
  for (const button of targetButtons) {
    const value = Number(button.dataset.targetPlayers);
    button.disabled = !isOwner || value < players.length || state.phase !== "title";
    button.setAttribute("aria-pressed", String(value === state.targetPlayers));
  }

  readyButton.disabled = !me || state.phase !== "title";
  readyButton.textContent = me?.ready ? "Nicht bereit" : "Bereit";
  lobbyStatus.textContent =
    missingPlayers > 0
      ? `Noch ${missingPlayers} Spieler benötigt.`
      : waitingReady > 0
        ? `Noch ${waitingReady} Spieler nicht bereit.`
        : "Runde startet...";
}
```

Es gibt keinen lokalen Startaufruf.

- [ ] **Step 5: DOM-Handler einmalig binden**

Beim Modulstart:

```ts
for (const button of targetButtons) {
  button.addEventListener("click", () => {
    if (!room) return;
    room.send("lobby:setTarget", {
      targetPlayers: Number(button.dataset.targetPlayers),
    });
  });
}

readyButton.addEventListener("click", () => {
  if (!room) return;
  const me = (room.state as any).players.get(room.sessionId);
  if (me) room.send("lobby:setReady", { ready: !me.ready });
});

returnButton.addEventListener("click", () => {
  if (!room) return;
  returnButton.disabled = true;
  room.send("round:returnToTitle");
});
```

Keiner dieser Handler wird bei einem Phasenwechsel neu registriert.

- [ ] **Step 6: Genau ein Phase-Event steuert Overlays und Scene-Pause**

Add:

```ts
window.addEventListener("nuggets:phasechange", (event) => {
  const phase = (event as CustomEvent<{ phase: RoundPhase }>).detail.phase;
  overlay.dataset.phase = phase;

  if (phase === "playing") {
    overlay.style.display = "none";
    game?.scene.resume("Game");
    return;
  }

  overlay.style.display = "flex";
  if (phase === "title") {
    lobbyView.hidden = false;
    endView.hidden = true;
    returnButton.disabled = false;
    renderLobby();
  } else {
    lobbyView.hidden = true;
    endView.hidden = false;
    endTitle.textContent = phase === "won" ? "Sieg!" : "Niederlage";
    returnButton.disabled = false;
  }
  game?.scene.pause("Game");
});
```

Das Event wird erst in Task 7 gesendet. `won`/`lost` treffen nach dem dort berechneten Animationstiming ein; `main.ts` dupliziert keine Millisekundenwerte.

- [ ] **Step 7: Zwischenstand typprüfen**

Run: `cd client; npm run typecheck`

Expected GREEN mit dem vorübergehenden lokalen `RoundPhase`; nach Task 7 bleibt es mit dem gemeinsamen Export grün.

### Task 7: `GameScene` phasenbewusst, animationssicher und cleanup-fest machen

**Files:**
- Modify incrementally: `client/src/scenes/GameScene.ts:41-138,177-225,255-302,818-1127,1241-1315,1345-1397`
- Do not modify: `client/src/assets.ts`
- Do not modify: `client/public/assets/boss-defeat.png`

- [ ] **Step 1: Aktuellen WIP-Diff unmittelbar vor dem Patch erneut prüfen**

Run:

```powershell
git diff -- client/src/scenes/GameScene.ts client/src/assets.ts client/public/assets/boss-defeat.png
```

Expected: Der tatsächliche aktuelle Inhalt ist bekannt. Bestehende Defeat-Konstanten, Chroma-Key-Verarbeitung und Boss-Defeat-Visuals werden inkrementell erweitert.

- [ ] **Step 2: Gemeinsamen Client-Phasentyp und aus Framekonstanten berechnete Zeiten ergänzen**

Nahe den Konstanten:

```ts
export type RoundPhase = "title" | "playing" | "won" | "lost";

const PLAYER_DEFEAT_DURATION_MS =
  (PLAYER_DEFEAT_FRAME_COUNT / PLAYER_DEFEAT_FRAME_RATE) * 1000;
const BOSS_DEFEAT_DURATION_MS =
  (BOSS_DEFEAT_FRAME_COUNT / BOSS_DEFEAT_FRAME_RATE) * 1000;
```

Das ergibt 600 ms für `lost` und 750 ms für `won`, ohne zweite Timingquelle.

In der Klasse:

```ts
private currentPhase: RoundPhase = "title";
private terminalTimer: Phaser.Time.TimerEvent | null = null;
private roomUnsubscribes: Array<() => void> = [];
private pointerFocusHandler: (() => void) | null = null;
private temporaryDefeatVisuals = new Set<Phaser.GameObjects.Sprite>();
```

- [ ] **Step 3: Phasenlistener mit stale-sicherem Endscreen-Timer binden**

Add:

```ts
private bindPhaseState() {
  const $ = getStateCallbacks(this.room);
  const onPhase = (phase: RoundPhase) => {
    this.currentPhase = phase;
    this.terminalTimer?.remove(false);
    this.terminalTimer = null;

    if (phase === "playing") {
      this.resetRoundVisuals();
      this.dispatchPhase(phase);
      return;
    }

    if (phase === "won" || phase === "lost") {
      const delay =
        phase === "won"
          ? this.hasBossDefeatSprite && this.anims.exists("boss-defeat")
            ? BOSS_DEFEAT_DURATION_MS
            : 0
          : this.hasPlayerDefeatSprite && this.anims.exists("player-defeat")
            ? PLAYER_DEFEAT_DURATION_MS
            : 0;
      if (delay === 0) {
        this.dispatchPhase(phase);
        return;
      }
      this.terminalTimer = this.time.delayedCall(delay, () => {
        this.terminalTimer = null;
        if ((this.room.state.phase as RoundPhase) === phase) {
          this.dispatchPhase(phase);
        }
      });
      return;
    }

    this.dispatchPhase(phase);
  };

  this.roomUnsubscribes.push(
    $(this.room.state).listen("phase", (phase: RoundPhase) => onPhase(phase)),
  );
  onPhase(this.room.state.phase as RoundPhase);
}

private dispatchPhase(phase: RoundPhase) {
  window.dispatchEvent(
    new CustomEvent("nuggets:phasechange", { detail: { phase } }),
  );
}
```

In `create()` wird `bindPhaseState()` nach Assets/Animationen und vor Input-Binding genau einmal aufgerufen.

- [ ] **Step 4: Beim neuen `playing` alle einmaligen Rundenvisuals zurücksetzen**

Implementiere:

```ts
private resetRoundVisuals() {
  this.terminalTimer?.remove(false);
  this.terminalTimer = null;
  this.bossDefeatSprite?.destroy();
  this.bossDefeatSprite = null;
  this.bossDefeatShown = false;
  this.bossVisual?.root.setVisible(true);

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

  for (const sprite of this.temporaryDefeatVisuals) sprite.destroy();
  this.temporaryDefeatVisuals.clear();
}
```

Die Server-Maps für Gegner und Nuggets werden beim Reset geleert und neu befüllt; ihre vorhandenen `onRemove`-/`onAdd`-Callbacks erstellen die normalen Visuals deterministisch neu.

In `showEnemyDefeat()` wird jedes erzeugte Defeat-Sprite erfasst und bei seinem normalen Ende wieder entfernt:

```ts
this.temporaryDefeatVisuals.add(sprite);
sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
  this.time.delayedCall(holdMs, () => {
    this.temporaryDefeatVisuals.delete(sprite);
    sprite.destroy();
  });
});
```

- [ ] **Step 5: Input sofort anhand des synchronisierten State stoppen**

Ersetze den Guard in `sendInput()`:

```ts
private sendInput() {
  if (!this.connected || this.room.state.phase !== "playing") return;
```

Vor dem `return` wird keine neutrale Inputnachricht gesendet: Der Server setzt beim Start alle Inputs zurück und akzeptiert außerhalb `playing` ohnehin keine Inputnachricht.

- [ ] **Step 6: Jede Room-Subscription erfassen**

Die bereits vorhandenen Callback-Bodies bleiben erhalten; jede Registrierung wird jedoch unmittelbar erfasst. Für `players` ist die konkrete Form:

```ts
this.roomUnsubscribes.push(
  $(this.room.state).players.onAdd((player, sessionId: string) => {
    addPlayerVisual(player, sessionId);
  }),
  $(this.room.state).players.onRemove((_player, sessionId: string) => {
    const entry = this.visuals.get(sessionId);
    if (!entry) return;
    entry.body.destroy();
    entry.label.destroy();
    this.visuals.delete(sessionId);
  }),
);
```

Dieselbe äußere `this.roomUnsubscribes.push(registration)`-Form wird auf die vorhandenen `enemies.onAdd/onRemove`, `feathers.onAdd/onRemove`, `bossProjectiles.onAdd/onRemove`, `nuggets.onAdd/onRemove`, die fünf Boss-`listen`-Registrierungen (`waiting`, `facing`, `action`, `attackFrame`, `alive`) und `this.room.onLeave` angewandt. Die jeweiligen bestehenden Callback-Bodies werden dabei nicht ersetzt. Für elementbezogene Listener eine Map pro Collection verwenden, damit `onRemove` sie sofort löst:

```ts
private nuggetUnsubscribes = new Map<string, Array<() => void>>();
```

Beim Nugget-Add:

```ts
this.nuggetUnsubscribes.set(nuggetId, [
  $(nugget).listen("active", (active: boolean) => sprite.setVisible(active)),
]);
```

Beim Nugget-Remove:

```ts
for (const unsubscribe of this.nuggetUnsubscribes.get(nuggetId) ?? []) {
  unsubscribe();
}
this.nuggetUnsubscribes.delete(nuggetId);
```

- [ ] **Step 7: Globalen Input und Phaser-Shutdown an einer Stelle bereinigen**

Ändere den anonymen Pointer-Handler:

```ts
this.pointerFocusHandler = () => canvas.focus();
canvas.addEventListener("pointerdown", this.pointerFocusHandler);
```

Entferne den bisherigen lokalen `SHUTDOWN`-Block aus `bindInput()` und registriere am Ende von `create()` genau einmal:

```ts
this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
```

Implementiere:

```ts
private cleanup() {
  this.terminalTimer?.remove(false);
  this.terminalTimer = null;
  for (const unsubscribe of this.roomUnsubscribes.splice(0)) unsubscribe();
  for (const unsubscribes of this.nuggetUnsubscribes.values()) {
    for (const unsubscribe of unsubscribes) unsubscribe();
  }
  this.nuggetUnsubscribes.clear();
  for (const sprite of this.temporaryDefeatVisuals) sprite.destroy();
  this.temporaryDefeatVisuals.clear();
  window.removeEventListener("keydown", this.onKeyDown);
  window.removeEventListener("keyup", this.onKeyUp);
  if (this.pointerFocusHandler) {
    this.game.canvas.removeEventListener("pointerdown", this.pointerFocusHandler);
    this.pointerFocusHandler = null;
  }
}
```

Dafür werden `onKeyDown` und `onKeyUp` von lokalen Closures zu stabilen privaten Arrow-Properties:

```ts
private onKeyDown = (event: KeyboardEvent) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") this.inputLeft = true;
  if (event.code === "ArrowRight" || event.code === "KeyD") this.inputRight = true;
  if (
    event.code === "ArrowUp" ||
    event.code === "KeyW" ||
    event.code === "Space"
  ) {
    this.inputJump = true;
    event.preventDefault();
  }
  if (event.code === "KeyF" || event.code === "Enter") {
    this.inputShoot = true;
    event.preventDefault();
  }
};

private onKeyUp = (event: KeyboardEvent) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") this.inputLeft = false;
  if (event.code === "ArrowRight" || event.code === "KeyD") this.inputRight = false;
  if (
    event.code === "ArrowUp" ||
    event.code === "KeyW" ||
    event.code === "Space"
  ) {
    this.inputJump = false;
  }
  if (event.code === "KeyF" || event.code === "Enter") {
    this.inputShoot = false;
  }
};
```

- [ ] **Step 8: Client-Typen und Build grün prüfen**

Run:

```powershell
cd client
npm run typecheck
npm run build
```

Expected GREEN: TypeScript akzeptiert `RoundPhase`, Subscription-Rückgaben und Phaser-Timer; Vite erzeugt den Client-Build. Es gibt weiterhin genau eine `GameScene`, eine Phaser-Instanz und ein globales Phase-Event.

### Task 8: Vorhandenen Multiplayer-Smoke-Test gezielt erweitern

**Files:**
- Modify incrementally: `client/scripts/test-multiplayer.mjs:1-135`

- [ ] **Step 1: Unabhängige lokale Änderungen vor der Testbearbeitung prüfen**

Run:

```powershell
git diff -- client/scripts/test-multiplayer.mjs
```

Expected: Der Diff ist bekannt. Vorhandene Boss-Aktions-/Projectile-Prüfungen oder andere lokale Ergänzungen werden erhalten; die folgenden Helfer und Testblöcke werden gezielt eingefügt.

- [ ] **Step 2: Generische Polling-Helfer ergänzen**

Add:

```js
async function waitFor(label, predicate, timeoutMs = TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await sleep(50);
  }
  throw new Error(`${label}: timed out`);
}

async function waitForPhase(room, phase, label, timeoutMs = TIMEOUT_MS) {
  return waitFor(
    label,
    () => room.state?.phase === phase && room.state.phase,
    timeoutMs,
  );
}

function snapshotGameplay(room, sessionId) {
  const player = room.state.players.get(sessionId);
  return {
    x: player.x,
    y: player.y,
    cooldown: player.featherCooldown,
    feathers: room.state.feathers.size,
  };
}
```

- [ ] **Step 3: Lobby-, Owner- und Title-Input-Assertions zuerst schreiben**

Nach dem Join beider Clients:

```js
assert(playerA.room.state.phase === "title", "room should start in title");
assert(playerA.room.state.targetPlayers === 2, "default target should be two");
assert(
  playerA.room.state.lobbyOwnerId === playerA.room.sessionId,
  "first player should own the lobby",
);

playerB.room.send("lobby:setTarget", { targetPlayers: 4 });
await sleep(150);
assert(playerA.room.state.targetPlayers === 2, "non-owner target change must be ignored");

playerA.room.send("lobby:setTarget", { targetPlayers: 1 });
await sleep(150);
assert(
  playerA.room.state.targetPlayers === 2,
  "target below 2 and below current player count must be ignored",
);

const frozenInTitle = snapshotGameplay(playerA.room, playerA.room.sessionId);
playerA.room.send("input", { left: false, right: true, jump: true, shoot: true });
await sleep(300);
assert(
  JSON.stringify(snapshotGameplay(playerA.room, playerA.room.sessionId)) ===
    JSON.stringify(frozenInTitle),
  "input in title must not move or shoot",
);
```

Run against the old server: `cd client; npm run test:multiplayer`

Expected RED: `phase`, Lobbyfelder oder das erwartete `title`-Verhalten fehlen.

- [ ] **Step 4: Exakten All-ready-Start und Playing-Input prüfen**

```js
playerA.room.send("lobby:setReady", { ready: true });
await sleep(150);
assert(playerA.room.state.phase === "title", "one ready player must not start");

playerB.room.send("lobby:setReady", { ready: true });
await waitForPhase(playerA.room, "playing", "all-ready start");
await waitForPhase(playerB.room, "playing", "peer all-ready start");
assert(
  Array.from(playerA.room.state.players.values()).every((entry) => !entry.ready),
  "start must clear all ready flags",
);
```

Danach bleiben die vorhandenen Movement-, Boss-Action- und Projectile-Tests bestehen. Ergänze eine Federprüfung:

```js
playerA.room.send("input", { left: false, right: false, jump: false, shoot: true });
await waitFor("first feather after reset", () => playerA.room.state.feathers.size > 0);
assert(
  playerA.room.state.feathers.has("feather-0"),
  "first round should begin with feather counter zero",
);
playerA.room.send("input", { left: false, right: false, jump: false, shoot: false });
```

- [ ] **Step 5: Team-Wipe über reales Gameplay erreichen und `lost`-Guard prüfen**

Keine Test-only Servernachricht einführen. Bewege beide Spieler zum bodennahen Gegnerbereich und halte sie dort beziehungsweise korrigiere ihre Richtung, bis regulärer Gegner- oder Bosskontakt alle Leben verbraucht:

```js
async function driveUntilDead(connection, peerRoom, label) {
  const sessionId = connection.room.sessionId;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const player = peerRoom.state.players.get(sessionId);
    if (!player?.alive) {
      connection.room.send("input", {
        left: false, right: false, jump: false, shoot: false,
      });
      return;
    }
    const moveRight = player.x < 600;
    connection.room.send("input", {
      left: !moveRight && player.x > 630,
      right: moveRight,
      jump: false,
      shoot: false,
    });
    await sleep(100);
  }
  throw new Error(`${label}: player did not die through contact damage`);
}
```

Führe beide Treiber parallel aus:

```js
await Promise.all([
  driveUntilDead(playerA, playerA.room, "PlayerA"),
  driveUntilDead(playerB, playerA.room, "PlayerB"),
]);
await waitForPhase(playerA.room, "lost", "team wipe", 60_000);
assert(
  Array.from(playerA.room.state.players.values()).every((entry) => !entry.alive),
  "lost must mean complete team wipe",
);

const frozenInLost = snapshotGameplay(playerA.room, playerA.room.sessionId);
playerA.room.send("input", { left: true, right: false, jump: true, shoot: true });
await sleep(300);
assert(
  JSON.stringify(snapshotGameplay(playerA.room, playerA.room.sessionId)) ===
    JSON.stringify(frozenInLost),
  "input in lost must not mutate gameplay",
);
```

- [ ] **Step 6: Raumweite Rückkehr und vollständigen nächsten Reset prüfen**

```js
playerB.room.send("round:returnToTitle");
await waitForPhase(playerA.room, "title", "group return to title");
await waitForPhase(playerB.room, "title", "peer group return to title");
assert(
  Array.from(playerA.room.state.players.values()).every((entry) => !entry.ready),
  "return to title must clear every ready flag",
);

playerA.room.send("lobby:setReady", { ready: true });
playerB.room.send("lobby:setReady", { ready: true });
await waitForPhase(playerA.room, "playing", "second round start");

const resetPlayers = Array.from(playerA.room.state.players.values())
  .sort((left, right) => left.spawnIndex - right.spawnIndex);
assert(
  resetPlayers.map((player) => player.spawnIndex).join(",") === "0,1",
  "players must receive stable unique spawn indices",
);
assert(
  new Set(resetPlayers.map((player) => player.color)).size === 2,
  "players must receive unique colors",
);
assert(
  resetPlayers[0].x === 60 && resetPlayers[1].x === 160,
  "players must return to their ordered spawn positions",
);
for (const player of resetPlayers) {
  assert(player.lives === 3 && player.alive, "players must reset to three lives and alive");
  assert(player.vx === 0 && player.vy === 0, "player velocity must reset");
  assert(player.grounded && player.facing === 1, "grounding and facing must reset");
  assert(player.invulnRemaining === 0, "invulnerability must reset");
  assert(player.featherCooldown === 0, "feather cooldown must reset");
}
assert(
  Array.from(playerA.room.state.enemies.values()).every(
    (entry) => entry.alive && entry.featherHits === 3,
  ),
  "all enemies must respawn alive at full feather health",
);
assert(
  playerA.room.state.boss.alive &&
    playerA.room.state.boss.hp === 15 &&
    playerA.room.state.boss.action === "travel" &&
    playerA.room.state.boss.attackFrame === 0,
  "boss must reset to full initial state",
);
assert(playerA.room.state.feathers.size === 0, "feathers must be empty");
assert(playerA.room.state.bossProjectiles.size === 0, "boss projectiles must be empty");
assert(
  Array.from(playerA.room.state.nuggets.values()).every((entry) => entry.active),
  "all nuggets must be active",
);
```

Schieße anschließend erneut und erwarte wieder `feather-0`; dies belegt Reset von Counter und Shoot-Flanke:

```js
playerA.room.send("input", { left: false, right: false, jump: false, shoot: true });
await waitFor("reset feather counter", () => playerA.room.state.feathers.size > 0);
assert(
  playerA.room.state.feathers.has("feather-0"),
  "second round must reset feather IDs and shoot edge",
);
```

- [ ] **Step 7: GREEN gegen frisch gebauten Server nachweisen**

In Terminal 1:

```powershell
cd server
npm run build
npm start
```

In Terminal 2:

```powershell
cd client
npm run test:multiplayer
```

Expected GREEN: Beide Clients sehen dieselben Phasen; Owner-/Payload-Guards, title/lost-Input-Freeze, All-ready-Start, Team-Wipe, raumweite Rückkehr und vollständiger zweiter Reset bestehen. Der Prozess endet mit `OK: multiplayer test passed`.

### Task 9: Finale Builds, Wiederholungsprüfung und Scope-Verifikation

**Files:**
- Verify only: alle in diesem Plan genannten Dateien

- [ ] **Step 1: Pure Tests und beide Typechecks ausführen**

Run:

```powershell
cd server
npm run test:round-rules
npm run typecheck
cd ../client
npm run typecheck
```

Expected GREEN: vier Regeltests bestehen; beide TypeScript-Projekte melden keine Fehler.

- [ ] **Step 2: Beide geforderten Builds separat ausführen**

Run:

```powershell
cd client
npm run build
cd ../server
npm run build
```

Expected GREEN: Client-Vite-Build und Server-`tsc` sind erfolgreich. Der Server-Build darf den Client gemäß bestehendem `build:client` erneut bauen.

- [ ] **Step 3: Einen zweiten vollständigen Smoke-Zyklus ausführen**

Bei laufendem frisch gebautem Server:

```powershell
cd client
npm run test:multiplayer
npm run test:multiplayer
```

Expected GREEN: Beide Läufe enden erfolgreich. Es gibt keine mehrfach ausgelösten Phasenaktionen; jeder neue Room startet in `title`, wechselt genau einmal nach `playing`, nach Team-Wipe genau einmal nach `lost` und kehrt genau einmal nach `title` zurück.

- [ ] **Step 4: Phasen- und Siegverdrahtung statisch prüfen**

Run:

```powershell
rg -n 'isPlayingPhase|phase !== "playing"|phase = "won"|phase = "lost"|checkVictoryAfterDeath|isRoundWon|isTeamWiped' server/src/rooms
rg -n 'nuggets:phasechange' client/src
```

Expected:

- `update()` und der `"input"`-Handler verwenden beide den getesteten `isPlayingPhase`-Guard.
- Alle drei regulären Todespfade — Feder gegen Gegner, Stomp gegen Gegner, Feder gegen Boss — rufen `checkVictoryAfterDeath()` auf.
- `isRoundWon` prüft Boss `alive === false` plus ausschließlich tote reguläre Gegner.
- `lost` wird nur über `isTeamWiped` gesetzt.
- Genau ein Eventname `"nuggets:phasechange"` verbindet `GameScene` und `main.ts`.

- [ ] **Step 5: Scope und lokale Änderungen abschließend kontrollieren**

Run:

```powershell
git status --short
git diff --stat
git diff -- client/src/assets.ts client/public/assets/boss-defeat.png
```

Expected: Nur die im Abschnitt „Geplante Dateistruktur“ genannten Produktions-/Testdateien sowie bereits vorher vorhandene lokale Änderungen erscheinen. `client/src/assets.ts` und `client/public/assets/boss-defeat.png` haben durch diese Umsetzung keinen neuen Diff. Es wurde kein Commit erstellt.
