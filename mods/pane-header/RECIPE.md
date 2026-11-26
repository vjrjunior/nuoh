# Pane header

The `nuoh` layout's pane header and the cards around its panes and panels. Each pane is a card on the window's gradient, opened by a 42px header with the program's tile, the pane's title, its agent's status and its folder; hovering the header shows buttons that split, zoom and close the pane. The side panels (Files, Changes, Graph and any an extra puts beside the panes) are cards that hold the panel's own box as a dark well, and the panel buttons sit in one group at the right of the tab bar, with `+` right after the last tab.

## What you see

- **Each pane** is a card on `surface` `#161616` with 14px corners and a 1px `#FFFFFF12` line; the focused pane's line is `#FFC799B3`, the same width. Panes 8px apart. The panes the tab hasn't selected are veiled: the terminal's `background` drawn over them at 0.4.
- **The header,** 42px along the card's top, on the card's fill, 10px in on the left and 6px on the right, its items 8px apart and centered:
  - **The tile,** 24×24 with 7px corners on `foreground` at `0D`, holds the program's 14px icon: a one-color icon in `muted` `#A0A0A0`, a picture in its own colors, or the kit's `terminal` in `muted` for a program without one.
  - **The title,** 13px medium, `foreground` `#FFFFFF` while the pane has focus and `muted` without it, cut with an ellipsis.
  - **The status chip,** the kit's `statusChip`: 18px tall, `Needs you` in `blocked`, `Working` in `working`, `Done` in `done`, each on its color at `1F` (`1A` for done). None while idle.
  - Then the free space, and **the folder** in 12px `dim` `#505050`, with the home folder as `~`. A header narrower than 320px leaves the folder out.
  - **The buttons,** only while the pointer is on the header: 28px ghost buttons with 14px `muted` icons that turn `hover` under the pointer, 2px apart: `columns-2` (Split right), `rows-2` (Split down), `maximize-2` (Zoom, or `minimize-2` and Unzoom on a zoomed pane) and `x` (Close pane). Their names are in tooltips.
- **Under the header,** the terminal on the theme's `background` `#101010`, the same width as the card.
- **The panels,** Files, Changes and Graph in their column, and any block an extra puts beside the panes: each a card like the panes, with 6px between the card's line and the panel. The panel's own box (10px corners, a 1px `border` line, the terminal's `background`) sits inside it as a well.
- **The tab bar:** `+` right after the last tab. At the right end, a group on `surface` with 11px corners, 3px in from a 1px `foreground` `12` line, its buttons 2px apart: the buttons extras add, then Files, Changes and Graph, each a 28px icon with its name in a tooltip.

## How it behaves

- A click anywhere on the header focuses its pane; the buttons don't, and a press on them never reaches the header.
- Split right and Split down open a terminal beside or under the pane, in its folder; Zoom fills the tab with the pane and Unzoom puts it back; Close pane closes it and ends its terminal.
- The zoom button shows only when the tab has another pane, or on a zoomed pane to undo the zoom; a pane alone in its tab has none.
- The title is the pane's name when someone named it (`pane.rename`); else the terminal's title without the glyph an agent puts before it (`✳`, a spinner, `[ ! ]`), unless that title is the terminal's own address; else the program's name; else `shell`.
- The chip follows the agent: `Working` while it works, `Needs you` when it is blocked, `Done` when it finished while the person wasn't looking, nothing once they look or while idle.
- The veil follows the selection: clicking another pane lifts it there and puts it on the one left.
- The panel buttons open and close their panel as `vjr-desk`'s do, and the group follows the panels a space shows. With more tabs than fit, the tabs scroll between the bar's start and `+`, which stays in view with the group.

## Built from

- **Layout** (`recipes/cards.ts`, the `nuoh-cards` recipe, run last in `nuoh`):
  - The `main` block's pane frame gets `background: "surface"`, `shadow: "md"`, `veil: 0.4` and `header: { content: { mod: "pane-header" }, height: 42, position: "top", reveal: "always" }`; `nuoh-frame` gave it `radius: 14`, the line and the focus line, and Herdr's `gap: 8` and `lone: true` stay.
  - Every child of `work-body` but `main` gets `background: "surface"`, `border: { width: 1, color: "#FFFFFF12" }`, `radius: 14`, `shadow: "md"` and `padding: 6`: Herdr's `panel` column and the block an extra adds there, without naming it.
- **Patches** in nuoh's copy of `tabs`: the `tab-scroll` row trades `flex_1()` for `flex_initial()` and `overflow_x_scrollbar()` for `overflow_x_scroll()`, so it is as wide as its tabs and `+` follows them; after `+` come a `div().flex_1()` and the `panel-group` row, which takes every call up to Herdr's `.when(w?.buttons,`, where it closes.
- **Graph:** `nuoh-cards` copies `git-graph` (installed as `nuoh-git-graph`) and replaces its `.rounded(paneFrame(layout())?.radius ?? 0)` with `.rounded(10)`, the well Files and Changes draw; `vjr-desk` keeps the shared `git-graph`, whose box follows its pane frame.
- **Mod** `mods/pane-header/`: `main.js` draws with the kit (`icon`, `iconButton`, `statusChip`) and Herdr's `svg()` or `image()` for the program's icon; `logic.js` is pure (`paneTitle`, `folderLabel`, `showsZoom`, `isNarrow`). The title's cleanup, `cleanTitle`, is in `lib/agent-title.js`, shared with the Agents list. It reads `props().pane`, `panes()`, `home()` and `settings().zoom`, measures itself with `on_size_change`, and runs `pane.focus`, `pane.split`, `pane.zoom` and `pane.close`. It runs no programs and reads no files.
- **Icons:** `columns-2`, `rows-2`, `maximize-2` and `minimize-2` from Lucide, in the kit.

## Watch out

- Herdr 0.1.18's pane frame has no inset: the terminal starts right under the header and runs to the card's line. The sketch's well, 6px in with 10px corners and faded without focus, can't be drawn until the frame gets an inset field.
- The frame's `radius` doesn't clip the terminal: its square bottom corners show `#101010` just outside the card's arc, on a gradient that is `#0D0D0D` there, too close to see. A `background: "background"` frame with a header that paints its own top wouldn't change those corners, so the frame paints `surface` and the header nothing.
- `overflow_x_scrollbar()` measures as wide as the room it gets, whatever its content, so a `flex_initial()` or `flex_none()` tab row with it still pushes `+` to the group, or out of the bar. `overflow_x_scroll()` measures its content; the bar's wheel handler and `track_scroll` work the same.
- The tab bar's anchors are Herdr's own text, which neither the extras nor `nuoh-frame` rewrite. Whatever an extra puts between `+` and the window buttons lands in the group.
- `on_size_change` reports window pixels: the 320px check divides by `settings().zoom`.
- The frame carries `shadow: "md"` like the other cards, but Herdr 0.1.18 draws no shadow under a pane frame (see [`mods/topbar/RECIPE.md`](../topbar/RECIPE.md)).
- The drag grip appears at the middle of the card's top edge; the buttons sit at the right end, away from it.

## Done when

- `bun run apply-layout` installs `nuoh-pane-header` and `nuoh-git-graph`, `nuoh` shows them, and `herdr-app status` shows no errors.
- A pane shows the tile, its title, the chip while its agent works, and its folder; an unfocused pane's title is `muted`, and a split tab veils the pane without focus.
- Hovering a header shows the four buttons (three on a pane alone in its tab); each splits, zooms or closes that pane, and a click on the header focuses it.
- Files, Changes, Graph and a panel an extra adds beside the panes open as cards with a well inside.
- `+` sits right after the last tab, and the panel buttons in one group at the right.
- `vjr-desk` shows Herdr's pane header, its panels and its tab bar as before, with round and with square corners.
