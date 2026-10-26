# companion-module-kkt-visioncontrol

Official repository: [bitfocus/companion-module-kkt-visioncontrol](https://github.com/bitfocus/companion-module-kkt-visioncontrol)

A [Bitfocus Companion](https://bitfocus.io/companion) module for the **Vision Control app** by KKT Künzler Technologies. It controls the app through its local REST API: color, brightness, effects, scenes and the sound trigger.

## Features

- Set color and dimmer for groups or single fixtures (with fade), blackout
- Effect catalog with 38 ready-made effects (matrix and device pixels, fitness studio concept), individual values can be overridden
- Build effects freely: pattern, geometry, colors, speed, range, trigger (Tap, Beat, Pulse)
- Adjust the running effect: faster, slower, brighter, darker, range
- **Rotary encoders (Stream Deck +):** turn = brightness, press = blackout on/off, bar on the display
- Display of the active effect with its tile, network devices and app reachability
- Scenes / sequences on, off, toggle; names taken from the app automatically; fallback that starts scenes even though the app's scene API is broken
- Local button variables for target and scene
- Consistent icon pack for all buttons

Setup details are in [`companion/HELP.md`](companion/HELP.md).

## Development

The module uses `@companion-module/base` 1.12 and runs on Companion 3.0 to 5.1 (tested with 5.1.0). Module ID: `kkt-visioncontrol` (previously `visioncontrol`; Companion offers to switch existing connections over).

Install dependencies (Yarn 4 via Corepack, as required by Bitfocus):

```bash
npx corepack yarn install
```

To test locally, load the folder as a developer module in Companion:
Launcher → set **Developer modules path** to the parent directory (the folder
that contains this module folder), then start Companion. Companion ships its
own Node runtime; `node_modules` only has to exist in the module folder.

### Icon pack

All preset graphics come from a dedicated icon pack with one visual language:
control symbols (Blackout, Full On, Dimmer, Scene, Sequence, Speed, Range,
Status …), effect tiles and color tiles. Every preset button carries a symbol
from the pack.

![All preset buttons with the icon pack](docs/iconpack-preview.png)

Rules for every glyph:

- 24 × 24 grid, motif within 2..22
- Stroke 2 units, round caps and joins
- Fills only flat in the same ink, no gradients inside the glyph
- One ink: white on dark, near-black on light backgrounds
- Control symbols are full 72 × 72 button images with a 28 px glyph at the top (Companion 5 scales images to the whole button)

Tiles (72 × 72): gradient of the effect colors, glyph of the effect pattern in
the center, text band at the bottom (45 % black), radius 12. Active state:
orange 3.5 px frame (`#FF7A00`). Color sequences without a pattern show the
cycle symbol, single-color tiles the drop.

The glyphs live in `scripts/iconpack/glyphs.cjs`, the layout in
`scripts/build-icons.cjs`. Regenerate (Windows, macOS, Linux, no installed app
required):

```bash
npx corepack yarn icons
```

This writes `icons/*.png` and bundles them into `src/icons.generated.json`.
`node scripts/build-icons.cjs --svg <folder>` writes the SVG sources, e.g. for
graphics tools or documentation.

Build a distributable package (optional, needs the build tools):

```bash
npx corepack yarn package
```

## License

MIT, see [LICENSE](LICENSE).
