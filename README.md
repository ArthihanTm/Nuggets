# Nuggets — Projekt-Grundgerüst

Ein 2D-Jump'n'Run im Browser für bis zu 4 Spieler gleichzeitig. Lauffähiges
Grundgerüst, gedacht als Startpunkt zum Weiterbauen in Cursor.

## Tech-Stack

| Bereich | Technologie | Warum |
|---|---|---|
| Game-Rendering (Client) | [Phaser 4](https://phaser.io/) | 2D-Engine mit Sprite-/Tilemap-Support, Standard für Browser-Jump'n'Runs |
| Multiplayer-Networking | [Colyseus](https://colyseus.io/) (`@colyseus/core` + `@colyseus/ws-transport`) | Room-basiertes Realtime-Framework, genau für 2–4-Spieler-Räume gemacht |
| Sprache | TypeScript (Client & Server) | geteilte Typsicherheit, weniger Netzwerk-Bugs |
| Build-Tool (Client) | [Vite](https://vitejs.dev/) | schneller Dev-Server, einfacher Production-Build |
| Server-Runtime | Node.js | |

**Architektur:** Der Server ist die einzige Quelle der Wahrheit ("authoritative
server"). Er berechnet Schwerkraft, Bewegung, Sprung und Plattform-Kollision
für alle Spieler (60×/Sekunde) und sendet den State an alle Clients. Die
Clients senden nur "welche Tasten sind gedrückt" und rendern, was der Server
ihnen sagt — mit einfacher Interpolation für flüssige Bewegung. Das ist die
robustere, leichter korrekt zu bauende Variante gegenüber voller
Client-Side-Prediction (die man später ergänzen kann, siehe "Nächste
Schritte" unten).

## Projektstruktur

```
Nuggets/
├── server/                  Colyseus-Server (Node.js)
│   └── src/
│       ├── index.ts         Einstiegspunkt, startet den Colyseus-Server
│       ├── level.ts         Level-Layout (Plattformen, Spawn-Punkte)
│       ├── polyfill.ts      Symbol.metadata-Polyfill (siehe unten, wichtig!)
│       └── rooms/
│           ├── GameRoom.ts        Server-Physik + Spiel-Logik (max. 4 Spieler)
│           └── schema/GameState.ts Netzwerk-State (was an Clients gesynct wird)
│
└── client/                  Phaser-Client (Browser)
    └── src/
        ├── main.ts           Verbindungs-Bildschirm, startet Phaser
        ├── network.ts        Colyseus-Client-Verbindung
        ├── level.ts          Level-Layout (identisch zu server/src/level.ts, zum Rendern)
        └── scenes/GameScene.ts  Zeichnet Plattformen & Spieler, sendet Input
```

`server/src/level.ts` und `client/src/level.ts` sind bewusst zwei getrennte
Kopien (kein gemeinsames npm-Package), um das Grundgerüst einfach zu halten.
Wenn du das Level änderst, in beiden Dateien nachziehen — oder später in ein
gemeinsames `shared/`-Package auslagern.

## Setup in Cursor — Schritt für Schritt

**Voraussetzung:** Node.js 20+ installiert (`node -v` im Terminal prüfen).

1. **Repo in Cursor öffnen** — diesen Ordner (`Nuggets`) als Projekt öffnen.

2. **Server-Abhängigkeiten installieren**
   ```
   cd server
   npm install
   ```

3. **Server starten** (bleibt in diesem Terminal laufen)
   ```
   npm run dev
   ```
   Du solltest sehen: `Colyseus server listening on ws://localhost:2567`

4. **Neues Terminal öffnen**, Client-Abhängigkeiten installieren
   ```
   cd client
   npm install
   ```

5. **Client starten** (in diesem zweiten Terminal)
   ```
   npm run dev
   ```
   Vite zeigt eine URL, normalerweise `http://localhost:5173`.

6. **Im Browser öffnen** — `http://localhost:5173`, Namen eingeben,
   "Beitreten" klicken.

7. **Für mehrere Spieler testen**: einfach das gleiche
   `http://localhost:5173` in bis zu 3 weiteren Browser-Tabs/-Fenstern öffnen
   (oder auf anderen Geräten im selben Netzwerk unter deiner lokalen IP,
   z. B. `http://192.168.x.x:5173` — Vite zeigt die Netzwerk-URL beim Start
   an). Jeder Tab ist ein eigener Spieler, bis zu 4 gleichzeitig pro Raum.

Steuerung: Pfeiltasten oder WASD zum Laufen, Pfeil-hoch/W/Leertaste zum
Springen.

### Produktions-Build

```
cd server && npm run build && npm start
cd client && npm run build   # erzeugt client/dist — als statische Dateien deploybar
```

## Ein wichtiger Stolperstein (bereits gelöst, aber gut zu wissen)

`@colyseus/schema` (Version 3) nutzt für seine `@type()`-Decorators
`Symbol.metadata`, das Node.js nicht automatisch global bereitstellt. Deshalb:

- `server/src/polyfill.ts` polyfillt `Symbol.metadata`, wird als **erste**
  Zeile in `index.ts` importiert.
- `server/tsconfig.json` braucht `"experimentalDecorators": true` **und**
  `"useDefineForClassFields": false` — ohne Letzteres werden die
  Klassen-Felder (z. B. `players = new MapSchema()`) so kompiliert, dass sie
  die vom Decorator installierten Getter/Setter umgehen, und der Server
  crasht beim ersten State-Sync mit einem kryptischen
  `Cannot read properties of undefined (reading 'Symbol(Symbol.metadata)')`.
- Der Server läuft über `tsc --watch` + `node --watch dist/index.js`
  (per `concurrently`), **nicht** über `tsx`: `tsx` (esbuild) transformiert
  die Decorators anders als der echte TypeScript-Compiler und bringt genau
  dieses Setup zum Absturz. Falls du das Server-Setup umbaust, an dieser
  Stelle vorsichtig sein.

Falls du das je wieder siehst: erste Anlaufstelle ist genau diese
Decorator/tsconfig-Kombination.

## Nächste Schritte (Ideen zum Weiterbauen)

- **Sprites statt Rechtecke**: aktuell sind Spieler und Plattformen einfache
  farbige Formen (kein Asset-Aufwand nötig, um zu starten). Für echte
  Pixel-Art-Optik: Sprite-Sheets besorgen/zeichnen und in `GameScene.ts` gegen
  `this.add.sprite(...)` mit Animationen tauschen.
- **Client-Side Prediction**: aktuell rendert der Client mit einer simplen
  Interpolation zur Server-Position (spürbare, aber geringe Verzögerung).
  Für ein butterweiches Spielgefühl bei höherer Latenz: lokale Vorhersage +
  Server-Reconciliation ergänzen.
- **Level-Editor**: [Tiled](https://www.mapeditor.org/) nutzen statt
  Plattformen im Code zu definieren — Export als JSON, in Phaser per
  Tilemap-Loader einlesen.
- **Coins/Gegner/Ziel**: `Player.coins` ist im Schema bereits vorbereitet,
  aber noch ungenutzt — guter Ansatzpunkt für Collectibles.
- **Deployment**: Server (Node/Docker) und Client (statische Dateien) lassen
  sich z. B. auf Deploio hosten — WebSocket-Unterstützung vorher kurz
  verifizieren (siehe Chat-Verlauf).
