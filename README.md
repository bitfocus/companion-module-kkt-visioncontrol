# companion-module-visioncontrol

Ein [Bitfocus Companion](https://bitfocus.io/companion) Modul für die **Vision Control App** von KKT Künzler Technologies. Es steuert die App über ihre lokale REST-API: Szenen und Sequenzen, Farbe und Dimmer, einen Farbwechsel-Effekt sowie den Sound-Trigger.

## Funktionen

- Szenen / Sequenzen an, aus, umschalten
- Farbe und Dimmer für Gruppen oder einzelne Fixtures setzen (mit Überblendung)
- Blackout
- Effekt: laufender RGB-Farbwechsel
- Sound-Control-Trigger
- Feedbacks: aktive Szene, Verbindungsstatus
- Variablen: Netzwerkname, Netzwerk-ID, Anzahl Szenen, Verbindungsstatus

Details zur Einrichtung stehen in [`companion/HELP.md`](companion/HELP.md).

## Entwicklung

Das Modul nutzt `@companion-module/base` 1.12 und ist mit Companion 3.0 bis 4.3 kompatibel.

Abhängigkeiten installieren (Node 18, 20, 22 oder neuer):

```bash
npm install
```

Zum lokalen Testen den Ordner als Developer-Modul in Companion einbinden:
Launcher → Feld **Developer modules path** auf das übergeordnete Verzeichnis
setzen (den Ordner, der `companion-module-visioncontrol` enthält), dann
Companion starten. Companion bringt seine eigene Node-Laufzeit mit; es genügt,
dass `node_modules` im Modulordner vorhanden ist.

### Symbole aus der Vision Control App

Die Presets zeigen die Grafiken der Vision Control App: Effekt-Kacheln im
App-Stil (Farbverlauf der Effektfarben plus Motiv wie Ziegelwand, Rad, Ringe,
Sterne) und Symbole für die Steuertasten. Sie liegen in `icons/` und gebündelt
in `src/icons.generated.json`, damit sie auch im gebauten Paket enthalten sind.

Nach einem Update der App lassen sie sich neu erzeugen:

```bash
npm run icons
```

Das führt `scripts/import-icons.ps1` (Symbole) und `scripts/build-icons.cjs`
(Kacheln aus den in der App eingebetteten SVG-Motiven) aus.

Das Polizei-Motiv stammt laut seinen SVG-Metadaten aus dem EmojiOne-Set
(CC BY 4.0).

Nach einem Update der App das Skript erneut ausführen. Ohne Symbole laufen die
Presets trotzdem, dann nur mit Text.

Ein verteilbares Paket bauen (optional, benötigt die Build-Tools):

```bash
npm run package
```

## Lizenz

MIT, siehe [LICENSE](LICENSE).
