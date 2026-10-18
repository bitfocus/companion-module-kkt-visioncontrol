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

Companion-Module werden mit Node 26 und Yarn 4 gebaut.

```bash
corepack enable
yarn install
yarn package        # baut das Modul-Paket (.tgz) über @companion-module/tools
```

Zum lokalen Testen den Ordner als Developer-Modul in Companion einbinden
(Einstellungen → Developer modules path auf das übergeordnete Verzeichnis setzen).

## Lizenz

MIT, siehe [LICENSE](LICENSE).
