# Nuggets — Projektkontext

Ein 1–4-Spieler Multiplayer-Pixel-Platformer im Game-Jam-Scope. **Aktueller Stand:** ein lauffähiges Phaser-/Colyseus-Grundgerüst mit serverseitiger Spielerphysik, Multiplayer-Sync, Raben-/Ameisen-Patrouillen und Boss-Visuals im selben Level. Kampfsystem (Federn, Stomp-Kills, individuelle Leben, Nuggets), Boss-Arena und Siegbedingung sind im Design finalisiert (siehe unten), aber noch nicht implementiert.

## Wichtigste Regel

Funktionierendes Multiplayer-Gameplay ist wichtiger als Umfang, Grafik oder zusätzliche Features. Bei jeder Entscheidung: die einfachste Lösung wählen, nicht die eleganteste oder "richtigste". Wenn eine Idee mehr als ein paar Zeilen Zustandsverwaltung braucht, ist sie wahrscheinlich zu komplex für dieses Projekt — lieber nachfragen als selbstständig eine grössere Lösung bauen.

## Tech-Stack (fix, nicht neu diskutieren)

- **Client:** Phaser 4 + TypeScript + Vite
- **Multiplayer:** Colyseus (`colyseus.js` im Client, `@colyseus/core`, `@colyseus/ws-transport` und `@colyseus/schema` im Server)
- **Server:** Node.js + TypeScript + Express + Colyseus, ein Prozess
- **Datenhaltung:** In-Memory Colyseus-Room-State. Keine Datenbank, kein Redis, kein Login/Auth, kein Matchmaking.
- **Deploy-Ziel:** deplo.io (Node.js Cloud-Native-Buildpack). Der Server lauscht auf `process.env.PORT`, lokal standardmässig auf Port 2567.
- **Wichtig:** `server/src/polyfill.ts` muss vor den Schema-Imports geladen werden. Der Server wird mit `tsc` gebaut; `experimentalDecorators: true` und `useDefineForClassFields: false` bleiben gesetzt.

## Ordnerstruktur

```
Nuggets/
  client/
    src/
      main.ts             // Join-Overlay und Phaser-Start
      network.ts          // Colyseus-Client, joinOrCreate("game")
      assets.ts           // Asset-Pfade
      level.ts            // Level-Layout fürs Rendering
      scenes/GameScene.ts // Rendering, Input und Interpolation
    public/assets/        // Sprite-PNGs
    scripts/test-multiplayer.mjs
    index.html
    vite.config.ts
  server/
    src/
      index.ts                 // Express- und Colyseus-Server
      polyfill.ts              // Symbol.metadata-Polyfill
      level.ts                 // Level-Kollision und Spawns
      rooms/
        GameRoom.ts            // Physik und Spielzustand
        schema/GameState.ts    // Synchronisierte Schemas
```

Kein npm-Workspace und kein Monorepo-Tooling. `client/src/level.ts` und `server/src/level.ts` sind bewusst getrennte Kopien; Level-Änderungen müssen in beiden Dateien synchron gehalten werden.

## Multiplayer-Architektur (Kernprinzip, nicht ändern)

- Der **Server ist authoritative** für Spielerphysik, Plattform-Kollisionen sowie Gegner- und Boss-Patrouillen.
- Clients senden nur Input (`left`, `right`, `jump`), nie fertige Positionen.
- Clients rendern den synchronisierten State und interpolieren zur flüssigen Darstellung. Keine Client-Prediction/Reconciliation.
- State-Sync läuft über `@colyseus/schema`; zusätzliche Aktionen werden als Colyseus-Room-Messages gesendet.
- Der Server simuliert mit 60 Hz über `setSimulationInterval`.

### Aktuelle Room-Message und Schemas

```ts
// Client → Server, Room-Message "input"
{ left: boolean; right: boolean; jump: boolean }

// Automatisch synchronisierter Server-State
class Player { name; x; y; vx; vy; grounded; facing; color; coins }
class Enemy { id; kind; x; y; baseY; vx; facing; alive }
class Boss { x; y; facing; waiting }
class GameState { players; enemies; boss }
```

Geplant, noch nicht im Schema: `Player` braucht `lives`/`alive` (individuelle Leben statt `coins` als einzigem Zähler), `Enemy` einen Federn-Trefferzähler, `Boss` ein `hp`-Feld. `coins` wird zu den Nuggets, wie im Kampfsystem unten beschrieben.

## Spielregeln

### Implementiert

- Bis zu vier Spieler pro Colyseus-Room.
- Join-Screen; Steuerung über WASD oder Pfeiltasten.
- Serverseitige Bewegung, Schwerkraft, Sprung und Plattform-Kollision.
- Respawn am ersten Spawn-Punkt, wenn ein Spieler unter die Welt fällt.
- Raben patrouillieren serverseitig; der Client rendert ihre Sprites.
- Der Boss bewegt sich zwischen Plattform-Waypoints im selben Level und wechselt zwischen Front- und Seitendarstellung.

### Geplant, noch nicht implementiert

- **Ziel = Tor zur Boss-Arena:** Sobald die erste Ente das Ziel erreicht, wechseln alle gemeinsam in die Boss-Szene.
- **Individuelle Leben statt gemeinsamem Pool:** Jede Ente hat 3 eigene Leben (ersetzt die frühere Idee eines gemeinsamen Lebens-Pools). Kontakt mit einem Gegner (ohne Stomp, siehe Kampfsystem) kostet 1 Leben plus kurze Unverwundbarkeit danach. Bei 0 Leben ist die Ente „tot" (raus), bis sie per Nugget wiederbelebt wird.
- **Kampfsystem (Federn, Stomp, Nuggets):** siehe eigener Abschnitt unten — finalisiertes Design, Umsetzung steht noch aus.
- **Boss-Kampf:** Boss ist immun gegen Stomp (Sprungangriff macht ihm nichts, Ente nimmt stattdessen normalen Kontaktschaden). Nur Federn verletzen ihn. Boss-HP als eigene Balancing-Konstante, deutlich höher als normale Gegner, Wert bewusst nicht fix vorgegeben. Sieg bei 0 HP.

### Kampfsystem (Federn, Stomp, Nuggets) — finalisiertes Design

- **Federn:** Enten schiessen Federn in Blickrichtung, ausgelöst per Taste, Cooldown 0,5 s pro Ente (unabhängig pro Spieler). Sprite bereits vorhanden: `client/public/assets/feather.png`.
- **Stomp (Sprungangriff):** Tötet Rabe und Ameise sofort, unabhängig von deren Federn-Trefferpunkten. Erkennung: Ente bewegt sich beim Kontakt nach unten UND ihre untere Kante liegt über der Gegner-Mitte. Kein Schaden für die Ente in diesem Fall.
- **Federn-Trefferpunkte:** Rabe und Ameise brauchen beide 3 Federn-Treffer, bis sie sterben (einheitlicher Wert für beide, kein Unterschied mehr zwischen Gegnertypen).
- **Nuggets — 1 Nugget = 1 sofortige Wirkung, kein Zähler/Schwelle mehr** (ersetzt die frühere „100 Nuggets = 1 Extra-Leben"-Idee). Priorität beim Einsammeln:
  1. Ist ein Teammitglied (andere Ente) gerade tot (0 Leben) → Nugget belebt es sofort wieder (zurück mit 1 Leben, an seinem Spawnpunkt).
  2. Sonst, falls die einsammelnde Ente < 3 Leben hat → +1 Leben.
  3. Sonst (kein totes Teammitglied und Sammler schon bei 3 Leben) → Nugget bleibt liegen, kein Effekt, kein Verbrauch.
  Sprite bereits vorhanden: `client/public/assets/nugget.png`. Server bleibt authoritative für Aufnahme und Effekt-Auswahl; eindeutige Nugget-IDs verhindern weiterhin doppeltes Einsammeln.
  HUD zeigt einen Wiederbeleben-Hinweis nur an, wenn tatsächlich ein Teammitglied tot ist — sonst gar nicht.

## Gegner

| Gegner | Verhalten | Getötet durch |
|---|---|---|
| Rabe | Patrouille auf Plattform/kurze Flugschleife | Stomp (instant) oder 3 Federn-Treffer |
| Ameise | Patrouille am Boden, schnell, niedrige Hitbox | Stomp (instant) oder 3 Federn-Treffer |

Fuchs ist aus dem Scope gestrichen (kein Asset vorhanden, `GameRoom.ts` kennt serverseitig nur die Enemy-Kinds `"raven"` und `"ant"`) — bitte nicht mehr einplanen, falls er irgendwo noch auftaucht.

Rabe- und Ameisen-Patrouille sind serverseitig implementiert (inkl. Sprites, auch `*-defeat.png` fürs Sterben). Stomp-Kills, Federn-Schaden gegen Gegner und Kontaktschaden an der Ente sind noch offen. Gemeinsamer Zustand und Validierung bleiben serverseitig.

## Assets

- Sprites liegen als PNG in `client/public/assets/`.
- Aktuell vorhanden: `player.png`, `player-defeat.png`, `raven.png`, `raven-defeat.png`, `ant.png`, `ant-defeat.png`, `background.png`, `platforms.png`, `boss-side.png`, `boss-front.png`, `feather.png`, `nugget.png`; `boss.png` ist ein alternatives Asset.
- `feather.png` und `nugget.png` liegen bereits im Ordner, sind aber noch nicht ins Kampfsystem eingebunden (siehe „Geplant" oben). Die `*-defeat.png`-Varianten sind für Tod/Stomp-Momente gedacht, ebenfalls noch nicht verdrahtet.
- Spieler, Rabe, Ameise und Boss verwenden mehrteilige Spritesheets. Frame-Grössen und Chroma-Key-Verarbeitung liegen in `client/src/scenes/GameScene.ts`.
- Fehlt ein Asset oder kann es nicht geladen werden, werden farbige Rechtecke als Fallback gerendert.
- Referenzpalette für neue/zusätzliche Assets: Ente `#F2C14E`/`#E8792B`, Rabe `#4A4E69`, Ameise `#5C3A28`, Gras `#8FBF7F`, Himmel `#9ECBE0`.

## Ausdrücklich NICHT bauen

Diese Punkte lösen Probleme, die dieses Projekt bei 1–4 Spielern und einer einzigen Session nicht hat. Nicht von dir aus ergänzen, auch wenn es "sauberer" wäre:

- Client-Prediction & Reconciliation, Lag-Kompensation, State-Recovery bei Reconnect
- WebRTC/P2P oder Socket.io (Colyseus reicht)
- Datenbank, Redis, Sessions, Accounts/Login, Matchmaking, Room-Codes
- Mehrere Level, Mini-Bosse, Skilltrees, Inventar, Shops
- Echtes Game Over / Reset-Screen bei 0 Leben
- npm-Workspaces/Monorepo-Setup, Tilemap-Editor
- Wechsel zurück zu Kaplay oder einem eigenen raw-WebSocket-Protokoll

## Build-Reihenfolge und Stand

- [x] Colyseus-Server, Phaser-Client, Join-Flow und Multiplayer-Smoke-Test
- [x] Server-Physik, Sprung, Level-Kollision und Kamera
- [x] Multiplayer-Sync: Input senden, Positionen synchronisieren und Spieler rendern
- [x] Raben- und Ameisen-Patrouille inkl. Sprites (Fuchs gestrichen)
- [ ] Individuelle Leben pro Ente (3), Kontaktschaden + Unverwundbarkeit, Stomp-Kills gegen Rabe/Ameise
- [ ] Federn: Schuss-Action, Cooldown 0,5s, 3 Trefferpunkte gegen Rabe/Ameise, Schaden am Boss
- [ ] Nuggets: Aufnahme-Logik (wiederbeleben > Leben auffüllen > liegen lassen), HUD-Anzeige
- [ ] Boss: Arena-Warp, Stomp-Immunität, Federn-HP und Sieg
- [ ] Deploy: statische Client-Dateien ausliefern, Procfile ergänzen und deplo.io mit mehreren Geräten testen

## Deploy (deplo.io) — Ziel, noch nicht umgesetzt

- Lokal laufen Server (`ws://localhost:2567`) und Vite (`http://localhost:5173`) getrennt. Die Server-URL kann im Client über `?server=ws://host:port` überschrieben werden.
- In Produktion soll ein Prozess den Colyseus-Endpunkt und `client/dist/` auf demselben `process.env.PORT` ausliefern.
- Aktuell liefert `server/src/index.ts` noch keine statischen Client-Dateien aus und im Repo-Root fehlt ein `Procfile`.
- Der erwartete Startbefehl nach dem Server-Build ist `node server/dist/index.js`; der finale Procfile-Pfad muss gegen das Build-Ergebnis geprüft werden.
- WebSocket-Support auf deplo.io bleibt das grösste Deploy-Risiko und muss früh getestet werden.
