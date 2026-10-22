# Vision Control

Steuert die **Vision Control App** (KKT Künzler Technologies) über ihre lokale REST-API.

## Voraussetzungen

1. Die Vision Control App läuft auf einem Rechner im selben Netzwerk.
2. In der App ist die **REST-API aktiviert**. Notiere dir **IP-Adresse**, **Port** (Standard 5123) und **Netzwerk-Passwort**.
3. Die App ist mit einem Vision-Netzwerk verbunden. Das Verbinden selbst geschieht in der App.

## Konfiguration

| Feld | Beschreibung |
|------|--------------|
| IP-Adresse der App | z. B. `192.168.1.189`, oder `127.0.0.1`, wenn Companion auf demselben Rechner läuft |
| Port | Standard `5123` |
| Netzwerk-Passwort | Passwort des Vision-Netzwerks |
| Abfrage-Intervall Szenen / Geräte | Wie oft Netzwerk-Geräte und Szenen gelesen werden (Standard 1000 ms, eine Abfrage dauert ca. 35 ms). Szenen aus den lokalen App-Dateien kommen zusätzlich sofort, sobald die App sie speichert. |
| Abfrage Helligkeit / laufender Effekt | Wie oft nur der laufende Zustand gelesen wird, damit Helligkeit und Effekt-Anzeigen Änderungen aus der App schnell übernehmen (Standard 500 ms, 0 = aus) |
| Gruppe für Statusanzeige | GroupID, deren Effekt in den Variablen erscheint (Standard `0`) |

Das Modul meldet sich automatisch an, erneuert das Token vor Ablauf und wiederholt Befehle bei einem bekannten, sporadischen Fehler der App automatisch.

## Actions

- **Szene / Sequenz: An / Aus / Umschalten** – über die Item-ID aus der Szenenliste der App
- **Farbe & Dimmer setzen**, **Dimmer setzen**, **Blackout**
- **Effekt aus Katalog** – fertige Effekte per Auswahlliste. Optional lassen sich einzelne Werte überschreiben (Häkchen setzen, dann erscheinen die Felder):
  - Helligkeit, Tempo (Sekunden pro Farbschritt und Weichheit), Range, eigene Farben, Richtung umkehren
- **Helligkeit schrittweise (Drehregler)** – ändert die Helligkeit um einen Schritt in Prozentpunkten (negativ = dunkler). Schnelles Drehen wird zusammengefasst, es geht kein Schritt verloren.
- **Blackout an/aus (Helligkeit merken)** – schaltet auf 0 und beim nächsten Druck zurück auf die Helligkeit davor
- **Laufenden Effekt anpassen** – Schneller, Langsamer, Heller, Dunkler, Range erhöhen oder verringern. Wirkt auf den Effekt, der gerade läuft, auch wenn er in der App gestartet wurde.
- **Effekt: Muster & Geometrie** – alles frei einstellbar: Muster, Geometrie, bis zu drei Farben, Tempo, Range, Variation, Bounce, Rückwärts, Auslöser (frei, Tap, Beat, Pulse) und Helligkeit
- **Effekt: Farbwechsel** – drei Farben mit Tempo und Weichheit
- **Sound Control: Trigger**

### Effekt-Katalog

- *Effekte* – RGB langsam/mittel/schnell, Party, Abendrot, Ozean, Polizei
- *Matrix-Pixel* – das Muster läuft über alle Pixel aller Geräte
- *Geräte-Pixel* – jedes Gerät spielt das Muster über seine eigenen Pixel
- *Geräte-Muster* – ganze Geräte sind die Zellen des Musters
- *Fitness: Bereiche* – Empfang, Cardio, Kraft, Athletik, Stretch, Wellness
- *Fitness: Kurse* – Warm-up, Spinning (Beat), HIIT, Power Beat (Bass-Pulse), Dance (Beat), Pause, Cool-down, Yoga, Finish

## Stream Deck + (Drehregler)

Companion bildet das Stream Deck + so auf die Seite ab (Seitenversatz 0):

| Reihe | Bedienelement |
|-------|---------------|
| 1 und 2 | die 8 Tasten |
| 3 | das Touch-Display, je Viertel eine Taste (Tippen = Drücken, senkrecht Wischen = Drehen) |
| 4 | die 4 Drehregler (Drehen und Drücken), ohne eigene Anzeige |

Unter *Drehregler (Stream Deck +)* liegen die passenden Presets:

- **Helligkeit** – für Reihe 4: rechts drehen = heller, links = dunkler (5 % je Raste), drücken = Blackout an/aus
- **Helligkeit fein** – dasselbe mit 1 % je Raste
- **Helligkeit: Display über dem Regler** – für Reihe 3, direkt über dem Regler: zeigt Dimmer-Symbol, orangen Balken und Wert in %; tippen = Blackout an/aus, senkrecht wischen = heller/dunkler

Einrichten:

1. In Companion die Seite öffnen, auf der das Stream Deck + liegt (unter *Surfaces* steht, welche Seite es zeigt).
2. *Presets* → *Vision Control* → *Drehregler (Stream Deck +)*.
3. **Helligkeit** auf den Platz in **Reihe 4** ziehen, unter dem gewünschten Regler.
4. **Helligkeit: Display über dem Regler** auf den Platz **direkt darüber in Reihe 3** ziehen.

Schrittweite und Gruppe lassen sich in den Aktionen der Taste ändern. Für eigene Tasten im Button-Editor „Drehaktionen aktivieren“ (Enable rotary actions) einschalten und die Aktion *Helligkeit schrittweise* unter „Links drehen“ / „Rechts drehen“ eintragen.

## Feedbacks

- **Helligkeit als Balken** – zeichnet die aktuelle Helligkeit als Balken, z. B. auf dem Display des Stream Deck +

- **Katalog-Effekt ist aktiv** – die Taste des laufenden Effekts bekommt einen orangen Rahmen (wie die ausgewählte Kachel in der App)
- **Farbe ist aktiv** – dasselbe für die Farbtasten
- **Bild des aktiven Effekts** – übernimmt automatisch die Kachel des laufenden Effekts bzw. der laufenden Farbe. Effekte aus der App erscheinen in ihrer Farbe mit dem passenden Motiv, „Aus“ mit dem Mond-Symbol. Genutzt von der Taste *Anzeige: aktiver Effekt*.
- **Szene / Sequenz ist aktiv**
- **App erreichbar** – grün: die App antwortet und liefert die Geräteliste, rot: keine Verbindung. Genutzt von der Taste *Netzwerk-Geräte* (Text z. B. „Netzwerk 2 Geräte“).
- **Mit Vision Control verbunden**

## Variablen

| Variable | Inhalt |
|----------|--------|
| `active_effect` | Name des laufenden Effekts, z. B. „Spinning“ oder „Farbe Rot“; bei Effekten aus der App der Mustername, z. B. „Ringe“ |
| `active_effect_id` | Katalog-ID, `custom`, `color:…` oder `off` |
| `active_category` | Kategorie des Effekts |
| `active_seconds` | Sekunden pro Farbschritt |
| `active_dimmer` | Helligkeit in % |
| `active_range` | Range des Effekts |
| `network_devices` | Anzahl der Geräte im Netzwerk (auch ausgeschaltete) |
| `network_device_names` | Namen der Netzwerk-Geräte mit Seriennummer-Ende |
| `app_reachable` | `ja` / `nein` – antwortet die App |
| `scene_<ID>_name`, `scene_<ID>_active` | Name und Status jeder Szene aus der App |
| `scene_<ID>_label` | Szenenname für Tasten, passend umbrochen (Größe 14) |
| `connection`, `network_name`, `network_id`, `scene_count` | Verbindung und Netzwerk |

Die Presets unter *Laufender Effekt* zeigen Name, Tempo und Helligkeit bereits an.

## Lokale Variablen

Alle Felder für Ziel-ID (GroupID / RDMID) und die Szenenauswahl akzeptieren Variablen, auch **lokale Variablen** der Taste, z. B. `$(local:gruppe)` oder `$(this:…)`. So lässt sich eine Taste einmal bauen und per lokaler Variable auf eine andere Gruppe oder Szene umstellen. Das gilt für Befehle und für die Rückmeldungen „Katalog-Effekt ist aktiv“, „Farbe ist aktiv“, „Bild des aktiven Effekts“ und „Szene / Sequenz ist aktiv“.

## Hinweise

- **Tempo:** Effekte nehmen *Sekunden pro Farbschritt* und eine *Weichheit in %*. Der Tempo-Wert der App (TimeMultiplier) ist intern ein Zeitfaktor: höher ist langsamer, 0 lässt den Effekt stehen. Das Modul rechnet um und setzt nie 0.
- **Range:** verteilt ein Muster über die Pixel. Bei 0 leuchten alle Pixel gleich. Die App-Vorlagen und das Modul nutzen 10.
- **Überblendung** beim Setzen von Farbe und Dimmer: 0 (sofort) bis 255, keine Sekunden.
- **Beat und Pulse** brauchen eine Audioquelle in der App (Mikrofon oder Line-In unter Sound).
- **App-Editor:** Wird ein vom Modul gesetzter Effekt in der App unter „Benutzerdefinierte Color FX“ geöffnet, überschreibt die App ihn mit eigenen Werten (z. B. Tempo 0) und er steht still. Dann den Effekt erneut aus Companion starten.
- **API:** Enum-Werte werden im Request als Ganzzahl gesendet, die App liefert sie als Namen zurück.
- **Szenen (App-Versionen 2.17.3 und 2.18.4):** Die Szenen-Befehle der API funktionieren in diesen Versionen nicht (getestet am 21.10.2026). `GET /Scenes` antwortet mit HTTP 500, `POST /Scenes/{id}/On|Off` wird nicht verarbeitet, `POST /SoundControl/Trigger` meldet HTTP 400. Das Modul zeigt in diesen Fällen eine klare Fehlermeldung im Log. Die Szenennamen liest es ersatzweise aus den lokalen Szenendateien der App, wenn Companion auf demselben PC läuft (abschaltbar in der Konfiguration). Dafür fordert das Modul in Companion 5 Dateizugriff an (`permissions.filesystem` im Manifest); ohne diese Freigabe sperrt Companion das Lesen außerhalb des Modulordners. Gelesen werden nur die beiden Szenendateien. **Ersatzweg zum Starten:** Verarbeitet die App den Szenen-Befehl nicht, liest das Modul die gespeicherte Szene aus den lokalen App-Dateien und sendet ihre Werte über `POST /Control`. Übertragen werden Master-Dimmer sowie Farbe bzw. Farbeffekt (Schritte, Muster, Geometrie, Range, Tempo, Auslöser) je Gruppe. Das entspricht dem, was die App beim Start einer Szene selbst in den Programmer schreibt (verglichen mit „White Line“ und „Test 35“). Noch nicht zugeordnete Werte werden übersprungen. Enthält eine Szene keinen Dimmerwert, bleibt die aktuelle Helligkeit; steht sie auf 0, bleibt es dunkel. „Szene aus“ setzt den Dimmer der Gruppen der Szene auf 0. Der Aktiv-Status gilt für die zuletzt über das Modul gestartete Szene. Sobald Vision Control die API korrigiert, nutzt das Modul automatisch wieder die Szenen-API.
- **Online-Status der Geräte:** Die REST-API meldet nicht, ob ein Gerät eingeschaltet ist. `GET /Network/Info` listet auch ausgeschaltete Geräte (per Test bestätigt). Eine Anzeige „Online x/y“ ist erst möglich, wenn Vision Control den Status in der API ergänzt.
- **Darstellung in Companion 5:** Die Presets setzen „Topbar anzeigen“ aus. Sonst vergrößert Companion 5 den Text um etwa ein Viertel und bricht Wörter mitten im Wort um. Symbole liegen als ganze 72er-Fläche vor, weil Companion 5 Bilder auf die ganze Taste skaliert. Bereits platzierte Tasten behalten ihren alten Stil – dafür die Presets neu auf die Tasten ziehen.
