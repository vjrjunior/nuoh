# kit/

`kit.js` is the UI kit every mod in this repo draws with: its tokens (`CONTROL`, `TEXT`, `RADIUS`, `ICON_SIZE`, `CARD_HEADER`, `MENU_ITEM`), its components (`button`, `iconButton`, `segment`, `tag`, `chip`, `statusChip`, `pill`, `input`, `menuItem`, `paneTile`, `cardHeader`, `avatar`, `programIcon`, `viewTile`, `viewCard`, the step parts `stepNode`, `timelineStep`, `stepCard`, `detailLine`, `checkRow`, `nextStep`, `releaseCard`, and `laneRow`, `profile`, `emptyState`, `lastClick` and the rest) and the SVG icons in `icons/`. The extras' mods draw with it too: an extra has no kit of its own.

## Rules

- Colors come from `theme()` by name, never hex. A component takes the theme as `t` and uses its names (`t.muted`); a translucent color is a theme color plus an alpha byte, as `statusChip` does with `t[status] + "1F"`. The only hex is in `lib/space-colors.js` (the avatars' palette), `mods/files/icons/` (the file type icons, drawn in their own colors with `image()`) and the layout nodes in `recipes/frame.ts` ([`recipes/AGENTS.md`](../recipes/AGENTS.md)).
- Icons are SVG files, never font glyphs. `tests/kit.test.ts` fails on `✓ ● ○ ↗ ▸ ▾ ↻ ← ✕ ■ □` or a lone `"!"` in the kit and the mods it lists, and on any hex in `kit.js`.
- The kit is the code of the design system, the Design system page of the sketch in the main checkout's `docs/sketches/herdr-ui.fig`. Every component a mod draws that the design system has lives here, named after it (Button is `button`, Menu item `menuItem`, the Pane's tile `paneTile`), with the design system's sizes, corners and colors, even when only one mod uses it. Where the two differ, the kit moves to the design system. A mod lays the kit's components out and draws none of its own. A new component also goes in the gallery, `mods/kit/main.js`.
- `button` takes a `variant` (`primary`, `secondary`, `tinted`, `ghost`, `danger`) and a `size` (`sm` 22px, `md` 28px, `lg` 34px); `iconButton` is a `ghost` (`md` 28px, `sm` 22px, `xs` 18px) or `bordered` (34px on `surface`); `chip` takes a `tone` (`blocked`, `working`, `done`, `accent`, or a neutral gray) and a `size` (`sm` 18px, `md` 24px with a dot).

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
