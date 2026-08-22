# Game-Screens und serverautoritatives Rundenmodell

## Ziel

Das Spiel erhält einen vollständigen, raumweit synchronisierten Ablauf:

`title -> playing -> won | lost -> title`

Der Server entscheidet allein über Phase, Start, Sieg, Niederlage und Reset. DOM-Overlays bilden Titel/Lobby und Endscreens ab; die bestehende Phaser-`GameScene` bleibt die einzige Spielszene und wird pausiert beziehungsweise fortgesetzt. Alle Clients eines Colyseus-Raums sehen dadurch denselben Rundenstatus.

## Nicht-Ziele

- keine zusätzlichen Phaser-Szenen
- kein Neuaufbau von `Phaser.Game` zwischen Runden
- keine neuen Grafik- oder Font-Assets
- keine Endstatistiken, Raumcodes, Reconnect-State-Recovery oder persistente Daten
- kein neues Test-Framework und keine umfassende Umstrukturierung des vorhandenen Kampf- oder Rendering-Codes

## Aktuelle Konvention

- `client/index.html` und `client/src/main.ts` stellen bereits das DOM-Join-Overlay bereit.
- `client/src/scenes/GameScene.ts` rendert und interpoliert den synchronisierten Room-State, sendet Eingaben und enthält die vorhandenen Defeat-Animationen.
- `server/src/rooms/GameRoom.ts` simuliert mit 60 Hz autoritativ Spieler, Gegner, Boss, Federn und Nuggets.
- `server/src/rooms/schema/GameState.ts` ist die gemeinsame synchronisierte Zustandsquelle. Positionen und Kampfzustände werden nicht per separater UI-Nachricht dupliziert.
- Die vorhandenen uncommitted Änderungen, insbesondere in `GameScene.ts`, `assets.ts` und `boss-defeat.png`, sind Arbeitsgrundlage und dürfen bei der Umsetzung nicht überschrieben werden. Änderungen an `client/scripts/test-multiplayer.mjs` werden vor einer Übernahme gegen dessen aktuellen lokalen Stand geprüft.

## Architektur

### Server

`GameRoom` besitzt die Zustandsmaschine und akzeptiert nur Nachrichten, die zur aktuellen Phase gehören. Sein Simulationstakt bleibt registriert, kehrt aber außerhalb von `playing` sofort zurück. Damit laufen weder Physik noch Cooldowns, Gegner-/Bossbewegung, Kollisionsprüfung, Schüsse, Projektile oder Nugget-Aufnahmen weiter.

Terminale Bedingungen werden unmittelbar an der Stelle geprüft, an der ein Tod eintritt. Sobald `won` oder `lost` gesetzt ist, beendet der aktuelle Simulationstick seine restliche Gameplay-Verarbeitung. So kann nach einem terminalen Ereignis im selben Tick kein weiterer Treffer den Ausgang ändern.

Der Raum bleibt während `playing`, `won` und `lost` für neue Spieler geschlossen. In `title` ist er bis zur gewählten Zielspielerzahl offen. Das bestehende `joinOrCreate("game")` darf bei einem geschlossenen Raum einen anderen Raum erzeugen; alle Aussagen über „die Gruppe“ gelten pro Room.

### Client

`main.ts` besitzt genau eine `Phaser.Game`-Instanz und verwaltet die DOM-Zustände „noch nicht verbunden“, „Lobby“, „Sieg“ und „Niederlage“. Nach erfolgreichem Join und Asset-Check wird Phaser einmal erzeugt. Während `title` sowie nach Einblendung eines Endscreens ist `GameScene` pausiert; beim Wechsel zu `playing` wird sie fortgesetzt.

`GameScene` beobachtet die synchronisierte Phase und meldet Änderungen mit genau einem `CustomEvent` namens `"nuggets:phasechange"` an `main.ts`; `detail.phase` enthält die neue Phase. Diese Brücke transportiert nur den Phasenwechsel, Lobbydaten liest `main.ts` direkt aus dem Room-State. Es werden weder pro Runde neue Szenen noch zusätzliche globale Listener erzeugt.

Bei `won`/`lost` stoppt `GameScene` sofort das Senden von Input, bleibt aber für die kurze Präsentationsphase aktiv, damit die bereits vorhandene Defeat-Animation sichtbar zu Ende laufen kann. Danach zeigt `main.ts` den Endscreen und pausiert die Szene. `lost` wartet bei verfügbarem Player-Defeat-Sprite 600 ms (6 Frames bei 10 FPS), `won` bei verfügbarem Boss-Defeat-Sprite 750 ms (6 Frames bei 8 FPS). Die Werte werden aus den bestehenden Frame-Konstanten berechnet und nicht als zweite Timingquelle dupliziert. Fehlt das jeweilige Sprite oder die Animation, wird der Endscreen ohne künstliche Wartezeit gezeigt.

## State- und Message-Modell

### Synchronisierter State

`GameState` wird ergänzt um:

- `phase: "title" | "playing" | "won" | "lost"`, initial `title`
- `targetPlayers: number`, initial `2`, serverseitig auf `2..4` begrenzt
- `lobbyOwnerId: string`, Session-ID des ersten verbundenen Spielers

`Player` wird ergänzt um `ready: boolean`, initial `false`.

Der Lobby-Owner ist der erste Spieler des Raums. Verlässt er den Raum in `title`, überträgt der Server die Rolle auf den ersten verbleibenden Spieler in serverseitiger Beitrittsreihenfolge. Bei leerem Raum wird `lobbyOwnerId` geleert. Ein Owner-Wechsel während einer laufenden oder beendeten Runde ist für UI und Ausgang ohne Wirkung; die Rolle wird beim nächsten `title` vor Annahme von Lobbyaktionen normalisiert.

### Client-Nachrichten

- `"lobby:setTarget"` mit `{ targetPlayers: 2 | 3 | 4 }`: nur in `title`, nur vom `lobbyOwnerId`; der Wert darf nicht kleiner als die aktuelle Spielerzahl sein.
- `"lobby:setReady"` mit `{ ready: boolean }`: nur in `title`, nur für den sendenden Spieler.
- `"round:returnToTitle"` ohne Nutzdaten: nur in `won` oder `lost`, von jedem verbundenen Spieler.
- `"input"` mit dem bestehenden Gameplay-Payload: nur in `playing`.

Ungültige, unautorisierte oder phasenfremde Nachrichten werden ohne State-Änderung verworfen. Payloads werden serverseitig normalisiert beziehungsweise validiert.

Erreicht die Spielerzahl `targetPlayers`, schließt der Server den Room für weitere Joins. Sinkt sie in `title` darunter, öffnet er ihn wieder. Ein kleineres Ziel als die aktuelle Spielerzahl ist unzulässig, sodass `players.size > targetPlayers` nicht entsteht.

## Übergänge und Bedingungen

### `title -> playing`

Der Server prüft nach Join, Leave, gültiger Zielzahländerung und jeder Ready-Änderung:

1. `players.size === targetPlayers`
2. jeder vorhandene Spieler hat `ready === true`

Nur wenn beides gilt, führt der Server zuerst den vollständigen Rundenreset aus und setzt anschließend `phase = "playing"`. Der Start erfolgt automatisch; es gibt keinen separaten Start-Button. Bei null oder nur einem Spieler ist ein Start durch die Mindestzielzahl 2 ausgeschlossen.

### `playing -> lost`

Niederlage gilt genau dann, wenn mindestens ein Spieler im Room existiert und alle vorhandenen Spieler `alive === false` sind. Die Prüfung erfolgt unmittelbar nach jedem lebensreduzierenden Treffer, der einen Spieler auf null Leben setzt; Nugget-Wiederbelebung und weitere Gameplay-Verarbeitung können nach dem terminalen Wechsel nicht mehr im selben Tick stattfinden.

### `playing -> won`

Sieg gilt genau dann, wenn `boss.alive === false` und alle Einträge in `enemies` `alive === false` haben. Die Prüfung erfolgt nach jedem Boss- und jedem regulären Gegnertod, unabhängig davon, ob dieser durch Feder oder Stomp verursacht wurde. Tote Gegner bleiben im synchronisierten Map-State; ihr `alive`-Flag ist die maßgebliche Bedingung.

### `won | lost -> title`

Die erste gültige `"round:returnToTitle"`-Nachricht setzt die Phase raumweit auf `title`, setzt `ready` für alle Spieler auf `false` und passt Room-Lock sowie Lobby-Owner an. Weitere Rückkehrnachrichten sind in `title` wirkungslos. Der Gameplay-State bleibt eingefroren hinter dem Lobby-Overlay und wird erst beim nächsten erfolgreichen All-ready-Start zurückgesetzt.

## Vollständiger Rundenreset

Der Reset bewahrt Room-Mitgliedschaft, Spielernamen, Lobby-Owner und gewählte Zielspielerzahl. Er setzt dagegen jeden rundenbezogenen Zustand auf seinen Startwert:

- Spieler in stabiler Beitrittsreihenfolge auf eindeutige Spawnpunkte und passende Farben/`spawnIndex`
- Spielerposition, `vx`, `vy`, `grounded`, Blickrichtung, drei Leben, `alive = true`, Unverwundbarkeit und Feder-Cooldown
- gepufferte Inputs sowie Flankenzustände für Sprung und Schuss auf `false`
- alle regulären Gegner auf Spawnposition, Startgeschwindigkeit, Blickrichtung, `alive = true` und volle Feder-Trefferpunkte
- Boss auf ersten Waypoint, volle HP, `alive = true`, Anfangsaktion und sämtliche internen Reise-, Angriffs-, Frame- und Timingwerte
- `feathers` vollständig leer und deren ID-Zähler zurückgesetzt
- Nuggets an allen definierten Spawns aktiv
- Simulationszeit und sonstige rundenbezogene Counter auf Anfangswerte

`ready` bleibt beim Start nicht als Lobbyzustand aktiv: Der Server setzt es für alle Spieler auf `false`, bevor oder während er `phase = "playing"` veröffentlicht. Für den nächsten Lobbyaufenthalt ist damit kein alter Ready-Wert sichtbar.

Der Reset ist eine zentrale `resetRound()`-Operation und wird nicht auf mehrere Übergangshandler verteilt. Gegner- und Nugget-Maps werden geleert und aus den Spawn-Definitionen neu befüllt, damit die bestehenden Colyseus-`onRemove`-/`onAdd`-Beobachter deterministisch neue Visuals erhalten. Spielerobjekte bleiben bestehen und werden feldweise zurückgesetzt; das Boss-Schema bleibt bestehen und wird ebenfalls feldweise zurückgesetzt. Client-seitige einmalige Defeat-Marker, Boss-Defeat-Sprite und temporäre Visuals werden beim `playing`-Übergang zurückgesetzt.

## UI

### Titel und Lobby

Ein kombiniertes Pixel-Panel liegt über dem vorhandenen Spielhintergrund:

- Logo beziehungsweise Texttitel „Nuggets“
- vor dem Join: Nameingabe mit bestehender Begrenzung auf 16 Zeichen und „Beitreten“
- nach dem Join: verbundene Spieler als Liste mit Name und eindeutigem Ready-Status
- Zielspielerzahl 2–4 als kantige Auswahl; nur für den Lobby-Owner aktiv
- Ready-/Nicht-ready-Button für den lokalen Spieler
- kompakte Steuerungshinweise für Bewegung, Sprung und Feder
- verständlicher Status, solange Spieler fehlen oder noch nicht alle bereit sind

Der Name ist nach dem Join für diese Room-Mitgliedschaft nicht mehr editierbar. Buttons werden während ausstehender Verbindung oder unzulässiger Aktionen deaktiviert. Die UI leitet Startbereitschaft ausschließlich aus dem synchronisierten State ab und startet die Runde nicht lokal vorweg.

### Endscreens

- `lost`: dunkler transparenter Tint über dem eingefrorenen Spiel, Pixel-Panel mit Niederlagenüberschrift und Button „Zurück zur Lobby“
- `won`: warmer goldener transparenter Tint, Pixel-Panel mit Siegesüberschrift und demselben Gruppen-Reset-Button

Beide verwenden die bestehende Pixel-Art-Palette, harte Kanten, kleine bis keine Rundungen und keine neuen Assets. Der Button sendet nur `"round:returnToTitle"`; der lokale Client wechselt erst nach der synchronisierten Serverphase. Endstatistiken sind nicht enthalten.

## Listener- und Callback-Cleanup

- Jeder Colyseus-`listen`-, `onAdd`-, `onRemove`-, `onMessage`- oder `onLeave`-Callback wird beim Binden erfasst, soweit die API einen Unsubscribe-Callback liefert.
- `GameScene` registriert einmalig einen Phaser-`SHUTDOWN`-Handler. Dieser entfernt alle erfassten Room-Subscriptions, globale Browser-Events, Tastatur-/Pointer-Hooks und noch ausstehende Endscreen-Timer.
- `main.ts` bindet DOM-Handler einmal beim Modulstart und ersetzt sie nicht bei Phasenwechseln. Room-State-Subscriptions werden beim Room-Wechsel oder Verbindungsverlust abgemeldet.
- Pausieren und Fortsetzen der Szene erzeugt keine neuen Listener. `create()` darf nach einem echten Scene-Restart keine alten Callbacks zurücklassen.
- Ein verzögerter Endscreen trägt eine Runden-/Phasenkennung oder prüft vor Anzeige erneut die aktuelle Phase. Eine schnelle Rückkehr zu `title` kann dadurch keinen verspäteten `won`-/`lost`-Overlay mehr einblenden.

## Tests und Verifikation

Es wird kein Test-Framework eingeführt. Start-, Sieg- und Niederlagenbedingung werden als kleine zustandsfreie Funktionen in `server/src/rooms/roundRules.ts` implementiert und mit Node-Bordmitteln geprüft. Der bestehende Multiplayer-Smoke-Test wird nach Prüfung seiner unabhängigen lokalen Änderungen gezielt um Nachrichtenvalidierung, Phasenwechsel, Input-Guard und Reset über zwei verbundene Clients erweitert.

Mindestens abzudecken:

- `title` startet nicht unter Zielzahl, nicht über einen ungültigen Zielwert und nicht mit einem unbereiten Spieler.
- Nur der Lobby-Owner kann das Ziel auf 2–4 setzen; ein Ziel unter aktueller Spielerzahl wird verworfen.
- Exakte Zielzahl plus alle ready führt genau einmal zu `playing`.
- Null Spieler ist keine Niederlage; mindestens ein Spieler und alle `alive = false` führt zu `lost`.
- Boss-Tod allein reicht bei einem lebenden regulären Gegner nicht; Sieg entsteht erst bei totem Boss und ausschließlich toten regulären Gegnern.
- Input in `title`, `won` und `lost` verändert weder Position noch Schuss-/Cooldownzustand.
- `"round:returnToTitle"` wirkt für die ganze Gruppe und setzt alle Ready-Werte zurück.
- Der nächste All-ready-Start stellt sämtliche unter „Vollständiger Rundenreset“ genannten öffentlichen und internen Zustände wieder her.
- Wiederholte Zyklen `title -> playing -> won/lost -> title` erzeugen keine mehrfach ausgelösten Phasen-Callbacks oder DOM-Aktionen.
- `npm run build` in `client/` und `npm run build` in `server/` sind erfolgreich; der Multiplayer-Smoke-Test läuft gegen den gebauten beziehungsweise lokalen Server.

## Betroffene Dateien

- `server/src/rooms/schema/GameState.ts`: Phase, Zielspielerzahl, Lobby-Owner und Ready-State
- `server/src/rooms/GameRoom.ts`: Nachrichtenvalidierung, Zustandsmaschine, Room-Lock, Endbedingungen, Simulations-Guard und zentraler Reset
- `server/src/rooms/roundRules.ts`: reine Start-, Sieg- und Niederlagenprädikate
- `client/index.html`: kombinierte Lobby- und Endscreen-Struktur sowie Pixel-Styles
- `client/src/main.ts`: einmalige Phaser-Instanz, DOM-Zustände, Room-State-Bindings und Pause/Resume-Steuerung
- `client/src/scenes/GameScene.ts`: Phasenbeobachtung, Input-Guard, Defeat-Verzögerung, Rundenvisual-Reset und Cleanup
- `client/scripts/test-multiplayer.mjs`: gezielte Phasen-/Reset-Smoke-Tests nach Abgleich der bestehenden lokalen Änderungen

`client/src/assets.ts`, vorhandene PNGs und insbesondere `client/public/assets/boss-defeat.png` benötigen für dieses Design keine Änderung.

## Risiken und Gegenmaßnahmen

- **Terminale Ereignisse im selben Tick:** Phasenwechsel beendet den Tick sofort; die erste serverseitig festgestellte terminale Bedingung ist endgültig.
- **Stale Round-State:** Ein zentraler, vollständig aufgezählter Reset verhindert, dass Counter, Eingabeflanken, Projektile oder Defeat-Marker in die nächste Runde gelangen.
- **Abweichende Client-Timings:** Der Server friert sofort ein; die Client-Verzögerung ist rein visuell und kann den Ausgang nicht beeinflussen.
- **Mehrfachlistener nach mehreren Runden:** Phaser bleibt bestehen, Bindings haben klar definierte Lebenszeiten und werden bei echtem Shutdown abgemeldet.
- **Lobby-Rennen:** Nur der Server setzt Phase und Ready-/Zielwerte; Clients reagieren ausschließlich auf synchronisierten State.
- **Lokale WIP-Konflikte:** Die Umsetzung bearbeitet aktuelle Dateiinhalte inkrementell und übernimmt weder ältere Dateikopien noch ungeprüfte Smoke-Test-Änderungen.
