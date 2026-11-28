# kit/

`kit.js` is the UI kit every mod in this repo draws with: its tokens (`CONTROL`, `TEXT`, `RADIUS`, `ICON_SIZE`, `CARD_HEADER`), its components (`button`, `iconButton`, `input`, `chip`, `statusChip`, `cardHeader`, `popupRow`, `avatar`, `programIcon`, `viewTile`, `barPill`, `viewCard` and the rest) and the SVG icons in `icons/`.

## Rules

- Colors come from `theme()` by name, never hex. A component takes the theme as `t` and uses its names (`t.muted`); a translucent color is a theme color plus an alpha byte, as `statusChip` does with `t[status] + "1F"`. The only hex is in `lib/space-colors.js` (the avatars' palette), `mods/files/icons/` (the file type icons, drawn in their own colors with `image()`) and the layout nodes in `recipes/frame.ts` ([`recipes/AGENTS.md`](../recipes/AGENTS.md)).
- Icons are SVG files, never font glyphs. `tests/kit.test.ts` fails on `✓ ● ○ ↗ ▸ ▾ ↻ ← ✕ ■ □` or a lone `"!"` in the kit and the mods it lists, and on any hex in `kit.js`.
- A component goes into the kit as soon as a second mod would draw the same thing; a piece only one mod needs stays in that mod. A new component also goes in the gallery, `mods/kit/main.js`.

## Importing

- A mod imports the kit as `../../kit/kit.js`, by no other path: the generator refuses another path to `kit/kit.js`, rewrites the import to `./kit.js` and copies `kit.js` into the installed mod.
- Icon paths come from `KIT = { name: "kit" }`. The generator prefixes the name, so the icons are read from `mods/nuoh-kit/icons/`, where they are installed once. An extra's mods use these too: an extra has no kit or icons of its own.
- A layout whose mods use the kit must include the `kit` recipe: the generator refuses otherwise. A copy of one of Herdr's mods can't import the kit.
- `scripts/test-panel.ts` gives the test panel its own `kit.js` with `KIT` pointed at `nuoh-kit`, so the panel draws its icons only once the layout is applied.

## Icons

- Every name in `ICONS` has a file in `icons/` and every file a name. Each is a 24 by 24 `viewBox` drawn in `currentColor`, with no `<title>`.
- Most are Lucide icons and keep their `@license` comment; their license is `icons/LICENSE-lucide`. `github.svg`, `clickup.svg`, `cursor.svg` and `zed.svg` are brand marks from Simple Icons under CC0, which needs no license file. An icon taken from another source brings its license file into `icons/`.

## Gallery

`nuoh-kit` shows every component and icon. Open it beside the focused terminal:

```sh
herdr-app do pane.split --direction right --mod nuoh-kit
```
