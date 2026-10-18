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
- **Sound Control: Trigger**

## Feedbacks

- **Szene / Sequenz ist aktiv** – färbt den Button, solange die Szene läuft
- **Mit Vision Control verbunden**

## Variablen

`$(visioncontrol:connection)`, `$(visioncontrol:network_name)`, `$(visioncontrol:network_id)`, `$(visioncontrol:scene_count)`

## Hinweis zur API

Enum-Werte (Effekttyp, Geometrie, Trigger) werden im Request als **Ganzzahl** gesendet; die App gibt sie in Antworten als Namen zurück.
