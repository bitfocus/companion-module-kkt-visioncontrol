# Vision Control

Steuert die **Vision Control App** (KKT Künzler Technologies) über ihre lokale REST-API.

## Voraussetzungen

1. Die Vision Control App läuft auf einem Rechner im selben Netzwerk.
2. In der App ist die **REST-API aktiviert**. Notiere dir die angezeigte **IP-Adresse**, den **Port** (Standard 5123) und das **Netzwerk-Passwort**.
3. Die App ist mit einem Vision-Netzwerk verbunden (das Verbinden selbst geschieht in der App, nicht über dieses Modul).

## Konfiguration

| Feld | Beschreibung |
|------|--------------|
| IP-Adresse der App | z. B. `192.168.1.189` oder `127.0.0.1`, wenn Companion auf demselben Rechner läuft |
| Port | Standard `5123` |
| Netzwerk-Passwort | Passwort des Vision-Netzwerks (für die Anmeldung per `POST /Access/Authenticate`) |
| Abfrage-Intervall | Wie oft Szenen-Status und Netzwerk-Info gepollt werden |

Das Modul meldet sich automatisch an, erneuert das Token vor Ablauf und wiederholt die Anmeldung bei einem 401.

## Actions

- **Szene / Sequenz: An / Aus / Umschalten** – über die Item-ID (siehe Scenes-Liste der App)
- **Farbe & Dimmer setzen** – Gruppe oder Fixture, Farbe per Colorpicker, Dimmer in %, mit Überblendung
- **Dimmer setzen** – nur Helligkeit
- **Blackout** – Dimmer auf 0
- **Effekt: Farbwechsel (RGB-Fx)** – laufender Farbwechsel aus drei Farben, mit Haltezeit, Überblendung und Tempo
- **Effekt: Muster & Geometrie** – Muster (Kreis, Wand, Pfeil, Schlange, Regen, Rauschen, Schach, Pixel u. a.) mit wählbarer Geometrie:
  - *Gerät*: ganze Fixtures sind die Zellen des Musters
  - *Einzeln*: jedes Gerät spielt das Muster über seine eigenen Pixel (Geräte-Pixel)
  - *Pixel / Matrix*: das Muster läuft über alle Pixel aller Geräte (Matrix-Pixel)

  - Auslöser: frei laufend, Tap, **Beat** (Musiktakt, optional an BPM angepasst) oder **Pulse** (Lautstärke in einem Frequenzband, z. B. Bass)
- **Effekt aus Katalog** – fertige Effekte per Auswahlliste, darunter das Fitnessstudio-Konzept:
  - *Fitness: Bereiche* – Empfang, Cardio, Kraft, Functional, Stretching, Wellness
  - *Fitness: Kurse* – Warm-up, Spinning (Beat), HIIT, Power Beat (Bass-Pulse), Dance (Beat), Pause, Cool-down, Yoga, Finish

Die Überblendung beim Setzen von Farbe und Dimmer ist ein Wert von 0 (sofort) bis 255 (längste Überblendung), keine Sekunden.

**Effekt-Tempo:** Die Effekt-Befehle nehmen *Sekunden pro Farbschritt* und eine *Weichheit in %* (Anteil Überblendung). Das Modul rechnet das in die Werte der App um. Hintergrund: Der Tempo-Wert der App (TimeMultiplier) ist ein Zeitfaktor, ein höherer Wert ist langsamer, und 0 lässt den Effekt stehen.

**Range:** Verteilt ein Muster über die Pixel. Bei 0 leuchten alle Pixel gleich, dann sieht jedes Muster wie ein einfacher Farbwechsel aus. Die App-Vorlagen nutzen 10, das ist auch der Standard im Modul.

**Hinweis zum App-Editor:** Wird ein vom Modul gesetzter Effekt in der App unter "Benutzerdefinierte Color FX" geöffnet, kann die App ihn mit eigenen Werten überschreiben (z. B. Tempo 0). Dann steht er still. Effekt in dem Fall erneut aus Companion starten.

**Beat- und Pulse-Effekte** brauchen eine Audioquelle in der Vision Control App (Mikrofon oder Line-In unter Sound). Ohne Audio laufen sie nicht weiter.

**Pixel- und Matrix-Effekte** brauchen eine Range größer 0 (Standard 10), sonst leuchten alle Pixel gleich.
- **Sound Control: Trigger**

## Feedbacks

- **Szene / Sequenz ist aktiv** – färbt den Button, solange die Szene läuft
- **Mit Vision Control verbunden**

## Variablen

`$(visioncontrol:connection)`, `$(visioncontrol:network_name)`, `$(visioncontrol:network_id)`, `$(visioncontrol:scene_count)`

## Hinweis zur API

Enum-Werte (Effekttyp, Geometrie, Trigger) werden im Request als **Ganzzahl** gesendet; die App gibt sie in Antworten als Namen zurück.
