# companion-module-kkt-visioncontrol

Offizielles Repository: [bitfocus/companion-module-kkt-visioncontrol](https://github.com/bitfocus/companion-module-kkt-visioncontrol)

Ein [Bitfocus Companion](https://bitfocus.io/companion) Modul für die **Vision Control App** von KKT Künzler Technologies. Es steuert die App über ihre lokale REST-API: Farbe, Helligkeit, Effekte, Szenen und den Sound-Trigger.

## Funktionen

- Farbe und Dimmer für Gruppen oder einzelne Fixtures setzen (mit Überblendung), Blackout
- Effekt-Katalog mit 38 fertigen Effekten (Matrix- und Geräte-Pixel, Fitnessstudio-Konzept), Werte einzeln überschreibbar
- Effekte frei bauen: Muster, Geometrie, Farben, Tempo, Range, Auslöser (Tap, Beat, Pulse)
- Laufenden Effekt anpassen: schneller, langsamer, heller, dunkler, Range
- **Drehregler (Stream Deck +):** drehen = Helligkeit, drücken = Blackout an/aus, Balken auf dem Display
- Anzeige des aktiven Effekts mit seiner Kachel, Netzwerk-Geräte und App-Erreichbarkeit
- Szenen / Sequenzen an, aus, umschalten; Namen automatisch aus der App
- Lokale Variablen der Taste für Ziel und Szene
- Einheitliches Icon Pack für alle Tasten

Details zur Einrichtung stehen in [`companion/HELP.md`](companion/HELP.md).

## Entwicklung

Das Modul nutzt `@companion-module/base` 1.12 und läuft mit Companion 3.0 bis 5.1 (getestet mit 5.1.0). Modul-ID: `kkt-visioncontrol` (früher `visioncontrol`; Companion bietet bestehende Verbindungen zum Umstellen an).

Abhängigkeiten installieren (Yarn 4 über Corepack, wie von Bitfocus vorgegeben):

```bash
npx corepack yarn install
```

Zum lokalen Testen den Ordner als Developer-Modul in Companion einbinden:
Launcher → Feld **Developer modules path** auf das übergeordnete Verzeichnis
setzen (den Ordner, der diesen Modulordner enthält), dann
Companion starten. Companion bringt seine eigene Node-Laufzeit mit; es genügt,
dass `node_modules` im Modulordner vorhanden ist.

### Icon Pack

Alle Grafiken der Presets kommen aus einem eigenen Icon Pack mit einer
gemeinsamen visuellen Sprache: Steuer-Symbole (Blackout, Full On, Dimmer,
Szene, Sequenz, Tempo, Range, Status …), Effekt-Kacheln und Farb-Kacheln.
Jede Preset-Taste trägt ein Symbol aus dem Pack.

![Alle Preset-Tasten mit dem Icon Pack](docs/iconpack-preview.png)

Regeln, die für jede Glyphe gelten:

- Raster 24 × 24, Motiv im Feld 2..22
- Linie 2 Einheiten, runde Enden und Ecken
- Flächen nur einfarbig in derselben Tinte, keine Verläufe in der Glyphe
- eine Tinte: weiß auf dunklen, fast schwarz auf hellen Flächen
- Glyphe immer 32 × 32 px, auf der Taste wie auf der Kachel (gleiche Strichstärke)

Kacheln (72 × 72): Verlauf der Effektfarben, Glyphe des Effektmusters mittig,
Schriftstreifen unten (45 % schwarz), Radius 12. Aktiv-Zustand: orangener
Rahmen 3,5 px (`#FF7A00`). Farbfolgen ohne Muster zeigen das Kreislauf-Symbol,
einfarbige Farb-Kacheln den Tropfen.

Die Glyphen stehen in `scripts/iconpack/glyphs.cjs`, das Layout in
`scripts/build-icons.cjs`. Neu erzeugen (Windows, macOS, Linux, ohne
installierte App):

```bash
npx corepack yarn icons
```

Das schreibt `icons/*.png` und bündelt sie in `src/icons.generated.json`.
Mit `node scripts/build-icons.cjs --svg <ordner>` entstehen die SVG-Quellen,
etwa für Grafik-Programme oder die Dokumentation.

Ein verteilbares Paket bauen (optional, benötigt die Build-Tools):

```bash
npx corepack yarn package
```

## Lizenz

MIT, siehe [LICENSE](LICENSE).
