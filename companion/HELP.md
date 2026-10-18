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
| Abfrage-Intervall | Wie oft Szenen, Netzwerk und der laufende Effekt gelesen werden |
| Gruppe für Statusanzeige | GroupID, deren Effekt in den Variablen erscheint (Standard `0`) |
| Anzahl Geräte im Netzwerk | Soll-Anzahl für die Online-Anzeige. `0` = automatisch, also die höchste seit dem Start gesehene Anzahl. Feste Zahl empfohlen, falls beim Start schon ein Gerät fehlt. |

Das Modul meldet sich automatisch an, erneuert das Token vor Ablauf und wiederholt Befehle bei einem bekannten, sporadischen Fehler der App automatisch.

## Actions

- **Szene / Sequenz: An / Aus / Umschalten** – über die Item-ID aus der Szenenliste der App
- **Farbe & Dimmer setzen**, **Dimmer setzen**, **Blackout**
- **Effekt aus Katalog** – fertige Effekte per Auswahlliste. Optional lassen sich einzelne Werte überschreiben (Häkchen setzen, dann erscheinen die Felder):
  - Helligkeit, Tempo (Sekunden pro Farbschritt und Weichheit), Range, eigene Farben, Richtung umkehren
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

## Feedbacks

- **Katalog-Effekt ist aktiv** – die Taste des laufenden Effekts bekommt einen orangen Rahmen (wie die ausgewählte Kachel in der App)
- **Farbe ist aktiv** – dasselbe für die Farbtasten
- **Bild des aktiven Effekts** – übernimmt automatisch die Kachel des laufenden Effekts bzw. der laufenden Farbe. Effekte aus der App erscheinen in ihrer Farbe mit dem passenden Motiv, „Aus“ mit dem Mond-Symbol. Genutzt von der Taste *Anzeige: aktiver Effekt*.
- **Szene / Sequenz ist aktiv**
- **Geräte-Erreichbarkeit** – grün: alle Geräte online, orange: einzelne fehlen, rot: keins erreichbar oder keine Verbindung zur App. Genutzt von der Taste *Geräte online* (Text z. B. „Online 2/2“).
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
| `devices_online`, `devices_total` | Erreichbare Geräte und Soll-Anzahl |
| `devices_missing` | Namen der nicht erreichbaren Geräte (mit Seriennummer-Ende) |
| `scene_<ID>_name`, `scene_<ID>_active` | Name und Status jeder Szene aus der App |
| `connection`, `network_name`, `network_id`, `scene_count` | Verbindung und Netzwerk |

Die Presets unter *Laufender Effekt* zeigen Name, Tempo und Helligkeit bereits an.

## Hinweise

- **Tempo:** Effekte nehmen *Sekunden pro Farbschritt* und eine *Weichheit in %*. Der Tempo-Wert der App (TimeMultiplier) ist intern ein Zeitfaktor: höher ist langsamer, 0 lässt den Effekt stehen. Das Modul rechnet um und setzt nie 0.
- **Range:** verteilt ein Muster über die Pixel. Bei 0 leuchten alle Pixel gleich. Die App-Vorlagen und das Modul nutzen 10.
- **Überblendung** beim Setzen von Farbe und Dimmer: 0 (sofort) bis 255, keine Sekunden.
- **Beat und Pulse** brauchen eine Audioquelle in der App (Mikrofon oder Line-In unter Sound).
- **App-Editor:** Wird ein vom Modul gesetzter Effekt in der App unter „Benutzerdefinierte Color FX“ geöffnet, überschreibt die App ihn mit eigenen Werten (z. B. Tempo 0) und er steht still. Dann den Effekt erneut aus Companion starten.
- **API:** Enum-Werte werden im Request als Ganzzahl gesendet, die App liefert sie als Namen zurück.
