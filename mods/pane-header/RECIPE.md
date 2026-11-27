# Pane header

The `nuoh` layout's panes and the cards around them. Each pane is a card on the window's gradient, opened by a 42px header with the program's tile, the pane's title, its agent's status and its folder; hovering the header shows buttons that split, zoom and close the pane. The side panels (Files, Changes, Graph and any block an extra puts beside the panes) are cards that hold the panel's own box as a dark well, and the panel buttons sit in one group at the right of the tab bar, with `+` right after the last tab.

![Pane header](preview.png)

## What you see

- **Each pane** is a card on `surface` `#161616` with 14px corners and a 1px `#FFFFFF12` line, `#FFC799B3` on the focused pane. Panes are 8px apart, and the ones the tab hasn't selected are veiled: the terminal's `background` drawn over them at 0.4. Under the header, the terminal runs on `background` `#101010`, as wide as the card.
- **The header,** 42px on the card's fill, 10px in on the left and 6px on the right, its items 8px apart: a 24px tile with 7px corners on `foreground` at `0D` holding the program's 14px icon (a one-color icon in `muted` `#A0A0A0`, a picture in its own colors, the kit's `terminal` in `muted` without one); the title in 13px medium, `foreground` while the pane has focus and `muted` without, cut with an ellipsis; the kit's `statusChip` (`Needs you`, `Working`, `Done`, none while idle); then the free space and the folder in 12px `dim` `#505050` with the home folder as `~`, left out under 320px.
- **The buttons,** only while the pointer is on the header: 28px ghost buttons with 14px `muted` icons, 2px apart, named in tooltips: `columns-2` Split right, `rows-2` Split down, `maximize-2` Zoom (`minimize-2` Unzoom on a zoomed pane) and `x` Close pane.
- **The panels,** and any block an extra adds to `work-body`: cards like the panes with 6px between the card's line and the panel, whose own box (10px corners, a 1px `border` line, the terminal's `background`) sits inside as a well.
- **The tab bar:** `+` right after the last tab; at the right end, a group on `surface` with 11px corners, 3px in from a 1px `foreground` `12` line, buttons 2px apart: the ones extras add, then Files, Changes and Graph.

## How it behaves

- A click on the header focuses its pane; the buttons stop the press. They run `pane.split` (right or down), `pane.zoom` and `pane.close` on that pane. The zoom button shows only when the tab has another pane, or on a zoomed pane.
- The title is the pane's name when someone named it; else the terminal's title without the glyph an agent puts first (`✳`, a spinner, `[ ! ]`), unless that title is the terminal's own address, a path or holds an `@` (`user@host:path`); else the program's name (`zsh` for a shell); else `shell`.
- The chip and the veil follow the agent and the tab's selected pane. With more tabs than fit, the tabs scroll between the bar's start and `+`, which stays in view with the group.

## Built from

- **`recipes/cards.ts`** (`nuoh-cards`, the last recipe): the `main` pane frame gets `background: "surface"`, `shadow: "md"`, `veil: 0.4` and `header: { content: { mod: "pane-header" }, height: 42, position: "top", reveal: "always" }` on top of `nuoh-frame`'s radius and lines ([`mods/topbar/RECIPE.md`](../topbar/RECIPE.md)) and Herdr's `gap: 8` and `lone: true`. Every child of `work-body` but `main` gets the card (`surface`, the 1px line, `radius: 14`, `shadow: "md"`) and `padding: 6`. In nuoh's copy of `tabs`, the `tab-scroll` row trades `flex_1()` for `flex_initial()` and `overflow_x_scrollbar()` for `overflow_x_scroll()`, and after `+` come a `div().flex_1()` and the `panel-group` row, closed before Herdr's `.when(w?.buttons,`. In `nuoh-git-graph`, `.rounded(paneFrame(layout())?.radius ?? 0)` becomes `.rounded(10)`, the well Files and Changes draw.
- **`mods/pane-header/`**: `main.js` draws the header with the kit's `programIcon`, `statusChip` and `iconButton`; `logic.js` holds the title, the folder label, the zoom rule and the 320px check; `lib/agent-title.js` cleans the terminal's title, as for the Agents list. It reads `props().pane`, `panes()`, `home()` and `settings().zoom`, and runs no programs and reads no files.

## Watch out

- **What a card can't do in Herdr 0.1.18,** for every card in `nuoh` (rail, Spaces, Agents, panes, panels):
  - A node's `radius` rounds its own fill and line, not the mod or the children inside. A mod in a card paints no fill and keeps its rows inset, so a hover or a selection never pokes out of the corners.
  - The pane frame has no inset: the terminal starts right under the header and runs to the card's line, so a terminal can't get the panels' well until the frame gets an inset field.
  - The frame's `radius` doesn't clip the terminal: its square bottom corners show `#101010` just outside the arc, on a gradient that is `#0D0D0D` there, too close to see. A header painting its own top over a `background` frame wouldn't change those corners, so the frame paints `surface` and the header nothing.
  - The pane frame ignores `shadow`.
- `overflow_x_scrollbar()` measures as wide as the room it gets, so a `flex_initial()` row with it still pushes `+` to the group; `overflow_x_scroll()` measures its content.
- The group anchors on Herdr's own text in `tabs`, which no extra rewrites, so whatever an extra puts between `+` and the window buttons lands in it.
- `on_size_change` reports window pixels: the 320px check divides by `settings().zoom`. The drag grip sits at the middle of the card's top edge, away from the buttons.

## Done when

- `bun run apply-layout` installs `nuoh-pane-header` and `nuoh-git-graph`, and `herdr-app status` shows no errors.
- A pane shows the tile, its title, the chip while its agent works and its folder; an unfocused pane's title is `muted`, and a split tab veils the panes it hasn't selected.
- Hovering a header shows four buttons (three on a pane alone in its tab); each splits, zooms or closes that pane, and a click on the header focuses it.
- Files, Changes, Graph and a panel an extra adds open as cards with a well inside; `+` sits right after the last tab and the panel buttons in one group at the right.
