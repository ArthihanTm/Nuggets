# assets/

Zwei optionale Dateien, beide werden automatisch erkannt, sobald sie hier
liegen — kein Code-Update nötig:

- **`player.png`** — Sprite-Sheet für die Spielfigur (Frame-Größe
  standardmäßig 32×48 px, Layout/Frame-Zuordnung ganz oben in
  `client/src/scenes/GameScene.ts` einstellbar). Ohne diese Datei werden
  Spieler als einfache farbige Rechtecke gezeichnet.
- **`background.png`** — Levelhintergrund, beliebige Auflösung (wird
  automatisch passend eingepasst — Seitenverhältnis bleibt erhalten,
  du musst nichts zuschneiden) und driftet leicht sanft hin und her
  (Geschwindigkeit/Ausschnitt über `BACKGROUND_PAN_SPEED` /
  `BACKGROUND_OVERSCAN` oben in `GameScene.ts` einstellbar). Ohne diese
  Datei bleibt die aktuelle einfarbige Himmelfarbe.

Das Projekt läuft in beiden Fällen auch ohne diese Dateien einwandfrei —
sie sind rein optional fürs Aussehen.
