# Vision Control

Controls the **Vision Control app** (KKT Künzler Technologies) through its local REST API.

## Requirements

1. The Vision Control app runs on a computer in the same network.
2. The **REST API is enabled** in the app. Note the **IP address**, **port** (default 5123) and **network password**.
3. The app is connected to a Vision network. Connecting to the network itself is done in the app.

## Configuration

| Field | Description |
|-------|-------------|
| App IP address | e.g. `192.168.1.189`, or `127.0.0.1` if Companion runs on the same computer |
| Port | Default `5123` |
| Network password | Password of the Vision network |
| Poll interval scenes / devices | How often network devices and scenes are read (default 1000 ms; one poll takes about 35 ms). Scenes from the app's local files are also picked up immediately when the app saves them. |
| Poll brightness / running effect | How often only the running state is read, so brightness and effect displays follow changes made in the app quickly (default 500 ms, 0 = off) |
| Group for status display | GroupID whose effect appears in the variables (default `0`) |

The module logs in automatically, renews the token before it expires and automatically retries commands after a known, sporadic app error.

## Actions

- **Scene / Sequence: On / Off / Toggle** – by item ID from the app's scene list
- **Set color & dimmer**, **Set dimmer**, **Blackout**
- **Effect from catalog** – ready-made effects from a dropdown. Individual values can optionally be overridden (tick the checkbox, the fields appear):
  - Brightness, speed (seconds per color step and softness), range, own colors, reverse direction
- **Brightness step by step (rotary encoder)** – changes the brightness by a step in percentage points (negative = darker). Fast turning is combined, no step is lost.
- **Blackout on/off (remember brightness)** – switches to 0 and on the next press back to the previous brightness
- **Adjust running effect** – Faster, Slower, Brighter, Darker, Increase or Decrease range. Works on the effect that is currently running, even if it was started in the app.
- **Effect: Pattern & Geometry** – fully configurable: pattern, geometry, up to three colors, speed, range, variation, bounce, reverse, trigger (free, Tap, Beat, Pulse) and brightness
- **Effect: Color change** – three colors with speed and softness
- **Sound Control: Trigger**

### Effect catalog

- *Effects* – RGB slow/medium/fast, Party, Sunset, Ocean, Police
- *Matrix pixels* – the pattern runs across all pixels of all devices
- *Device pixels* – every device plays the pattern across its own pixels
- *Device patterns* – whole devices are the cells of the pattern
- *Fitness: Areas* – Reception, Cardio, Strength, Athletics, Stretch, Wellness
- *Fitness: Classes* – Warm-up, Spinning (Beat), HIIT, Power Beat (bass pulse), Dance (Beat), Break, Cool-down, Yoga, Finish

## Stream Deck + (rotary encoders)

Companion maps the Stream Deck + onto the page like this (page offset 0):

| Row | Control |
|-----|---------|
| 1 and 2 | the 8 keys |
| 3 | the touch display, one button per quarter (tap = press, vertical swipe = rotate) |
| 4 | the 4 rotary encoders (rotate and press), without a display of their own |

The matching presets are under *Rotary encoder (Stream Deck +)*:

- **Brightness** – for row 4: turn right = brighter, left = darker (5 % per detent), press = blackout on/off
- **Brightness fine** – the same with 1 % per detent
- **Brightness: display above the encoder** – for row 3, directly above the encoder: shows the dimmer symbol, an orange bar and the value in %; tap = blackout on/off, vertical swipe = brighter/darker

Setup:

1. In Companion, open the page the Stream Deck + is on (*Surfaces* shows which page it displays).
2. *Presets* → *Vision Control* → *Rotary encoder (Stream Deck +)*.
3. Drag **Brightness** onto the slot in **row 4**, below the encoder you want.
4. Drag **Brightness: display above the encoder** onto the slot **directly above it in row 3**.

Step size and group can be changed in the button's actions. For your own buttons, switch on "Enable rotary actions" in the button editor and add the action *Brightness step by step* under "Rotate left" / "Rotate right".

## Feedbacks

- **Brightness as a bar** – draws the current brightness as a bar, e.g. on the Stream Deck + display
- **Catalog effect is active** – the button of the running effect gets an orange frame (like the selected tile in the app)
- **Color is active** – the same for the color buttons
- **Image of the active effect** – automatically shows the tile of the running effect or color. Effects from the app appear in their color with the matching motif, "Off" with the moon symbol. Used by the *Display: active effect* button.
- **Scene / Sequence is active**
- **App reachable (green / red)** – green: the app responds and returns the device list, red: no connection. Used by the *Network devices* button (text e.g. "Network 2 devices").
- **Connected to Vision Control**

## Variables

| Variable | Content |
|----------|---------|
| `active_effect` | Name of the running effect, e.g. "Spinning" or "Color Red"; for effects from the app the pattern name, e.g. "Rings" |
| `active_effect_id` | Catalog ID, `custom`, `color:…` or `off` |
| `active_category` | Category of the effect |
| `active_seconds` | Seconds per color step |
| `active_dimmer` | Brightness in % |
| `active_range` | Range of the effect |
| `network_devices` | Number of devices in the network (including switched-off ones) |
| `network_device_names` | Names of the network devices with the end of their serial number |
| `app_reachable` | `yes` / `no` – whether the app responds |
| `scene_<ID>_name`, `scene_<ID>_active` | Name and state of every scene from the app |
| `scene_<ID>_label` | Scene name for buttons, wrapped to fit (size 14) |
| `connection`, `network_name`, `network_id`, `scene_count` | Connection and network |

The presets under *Running effect* already show name, speed and brightness.

## Local variables

All fields for the target ID (GroupID / RDMID) and the scene selection accept variables, including the button's **local variables**, e.g. `$(local:group)` or `$(this:…)`. This way a button can be built once and pointed at a different group or scene through a local variable. This applies to actions and to the feedbacks "Catalog effect is active", "Color is active", "Image of the active effect" and "Scene / Sequence is active".

## Notes

- **Speed:** Effects take *seconds per color step* and a *softness in %*. The app's speed value (TimeMultiplier) is internally a time factor: higher is slower, 0 freezes the effect. The module converts and never sets 0.
- **Range:** spreads a pattern across the pixels. At 0 all pixels light the same. The app templates and the module use 10.
- **Fade** when setting color and dimmer: 0 (instant) to 255, not seconds.
- **Beat and Pulse** need an audio source in the app (microphone or line-in under Sound).
- **App editor:** If an effect set by the module is opened in the app under "Custom Color FX", the app overwrites it with its own values (e.g. speed 0) and it stands still. Start the effect again from Companion.
- **API:** Enum values are sent as integers in requests; the app returns them as names.
- **Scenes (app versions 2.17.3 and 2.18.4):** The API's scene commands do not work in these versions (tested on 2026-10-21). `GET /Scenes` returns HTTP 500, `POST /Scenes/{id}/On|Off` is not processed, `POST /SoundControl/Trigger` returns HTTP 400. The module reads the scene names from the app's local scene files instead, if Companion runs on the same PC (can be switched off in the configuration). For this the module requests file access in Companion 5 (`permissions.filesystem` in the manifest); without it Companion blocks reading outside the module folder. Only the two scene files are read.
  **Fallback for starting scenes:** If the app does not process the scene command, the module reads the stored scene from the app's local files and sends its values via `POST /Control`: master dimmer plus color or color effect (steps, pattern, geometry, range, speed, trigger) per group. This matches what the app itself writes to the programmer when it starts a scene (compared with "White Line" and "Test 35"). Values that are not mapped yet are skipped. The dimmer is set like the app does: the scene's stored dimmer value, otherwise 100 %. "Scene off" sets the dimmer of the scene's groups to 0. The active state is detected from the app's running state: a scene lights up as long as exactly its color or color effect is running – also when it was started in the app. Another preset or a change in the app ends it; brightness and speed may change. As soon as Vision Control fixes the API, the module automatically uses the scene API again.
- **Device online state:** The REST API does not report whether a device is switched on. `GET /Network/Info` also lists switched-off devices (confirmed by test). An "Online x/y" display is only possible once Vision Control adds the state to the API.
- **Appearance in Companion 5:** The presets switch "Show topbar" off. Otherwise Companion 5 enlarges the text by about a quarter and breaks words in the middle. Symbols are full 72 px images because Companion 5 scales images to the whole button. Buttons that were placed earlier keep their old style – drag the presets onto the buttons again.
