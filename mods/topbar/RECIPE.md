# Top bar

The `nuoh` layout's frame and top bar. The window sits on a dark gradient with every block 8px apart and 8px from the edges, and a 46px band along the top holds the macOS window buttons over the rail, the shown space with its branch over the sidebar, the tabs and panel buttons over the panes, and the space's machine at the right. Herdr's brand block, sidebar footer and status bar are gone: the rail and this bar do what they did.

![Top bar](preview.png)

## What you see

- **The window** is a vertical gradient from `#181818` at the top to `#0D0D0D` at the bottom, with 8px of it around and between every block.
- **The band,** 46px tall, 8px down from the window's top:
  - **over the rail,** 54px: empty, with the macOS window buttons at `[18, 24]`;
  - **the title,** over the sidebar and as wide as it, 12px in from its left: a 28px borderless fold button (14px `panel-left` in `muted`), then 10px apart the space's avatar (28px, 8px corners, its first letter in bold 12px white on the space's color, `#22a99a` before it has one), its name in 17px semibold `foreground` cut with an ellipsis, and a branch chip (22px tall, 7px sides, 6px corners, on `raised` `#1C1C1C`: a 12px `git-branch` in `unknown` `#707070` and the branch in 12px `muted` `#A0A0A0`, at most 140px wide, the whole branch in its tooltip). With the sidebar folded under 160px, only the fold button shows, centered;
  - **the tabs,** over the panes: 32px pills with 9px corners, 12px sides and 13px text; the active one on `raised` with a 1px `border` `#232323` line, the others with no fill and their name in `muted`. Then `+` and the panel group, described in [`mods/pane-header/RECIPE.md`](../pane-header/RECIPE.md), whose buttons are 28px icons with 8px corners, on `selected` while their panel shows;
  - **the machine pill,** at the right end of a 160px slot, 10px from the window's edge: 34px tall, 10px corners, on `surface` `#161616` with a 1px `border` line, a 14px `monitor` (`server` for another machine), `This computer` or the machine's name in 12.5px `muted`, and a 12px `chevron-down` in `dim`.
- **Under the band,** the rail card ([`mods/rail/RECIPE.md`](../rail/RECIPE.md)); the sidebar with Spaces and Agents as two cards 8px apart ([`mods/spaces-tree/RECIPE.md`](../spaces-tree/RECIPE.md), [`mods/agent-list/RECIPE.md`](../agent-list/RECIPE.md)), on `surface` with 14px corners, a 1px `#FFFFFF12` line and the gradient between and around them; and the panes as cards ([`mods/pane-header/RECIPE.md`](../pane-header/RECIPE.md)). Between the sidebar and the panes, and between the two cards, a 1px line shows only while the pointer is over the boundary, in `accent`.

## How it behaves

- The title follows the shown space. The branch is the focused pane's when that pane is in the shown space, else the space's own; a space outside git shows no chip.
- The fold button folds an open sidebar to 44px, keeping its width in shared `sidebar.width`, and opens a folded one to that width (268px if none). It also writes `sidebar.collapsed`, as Herdr's sidebar button does. Its tooltip says `Collapse sidebar` or `Expand sidebar`.
- The machine pill opens Herdr's Add machine dialog (`mod.open` of `machine-add`); its tooltip says `Add machine`, and it turns `hover` with its text in `foreground` under the pointer.
- Dragging the band, the title, the tab bar's empty space or the machine slot moves the window, and a double-click maximizes it. The fold button, the tabs, the panel buttons and the machine pill stop the press.
- No agent status shows here: the rail's Workspace tile and the Agents card carry it.

## Built from

- **`recipes/frame.ts`** (`nuoh-frame`, after the rail, the extras and the rail's keys):
  - the root `row` gets `background: { gradient: ["#181818", "#0D0D0D"], angle: 180 }`, `padding: 8`, `gap: 8`, `traffic_lights: [18, 24]` and no divider;
  - `rail` goes into `rail-column`, a 54px `column` with `resizable: false` and `gap: 8`: `lights` (a 46px `block`, `window_drag`, `topbar` with `role: "lights"`) over the `rail` card (`surface`, the 1px line, `radius: 16`, `shadow: "md"`);
  - `workspace` gets `gap: 8` and `divider: { width: 1, color: "#00000000", hover: "accent" }`;
  - `sidebar` hands its `chrome` background to `sidebar-lists`, gets `gap: 8`, and opens with `space-title` (a 46px `block`, `window_drag`, `topbar` with `role: "title"`);
  - `work` gets `gap: 8`; `tabs` moves into `work-top`, a 46px `row` with `window_drag` and `resizable: false`, beside `machine` (a 160px `block`, `window_drag`, `topbar` with `role: "machine"`); `work-body` loses its padding;
  - `brand`, `sidebar-footer` and `status` go;
  - the `main` pane frame gets `radius: 14`, `border: { width: 1, color: "#FFFFFF12" }` and `focus: { width: 1, color: "#FFC799B3" }`;
  - in nuoh's copy of `tabs`, the bar loses its `chrome` fill, its bottom line and the room it kept for the window buttons; tabs grow to 32px with 9px corners and only the active one is filled and lined; panel buttons drop their label for a tooltip; and every `.bg(on ? t.selected : t.chrome)` becomes a fill only while on, the extras' buttons included.
- **`recipes/cards.ts`** (`nuoh-cards`, last) takes the `chrome` fill off `sidebar-lists`, gives it `gap: 8` and the same hidden divider, and makes `spaces` and `agents` cards (`surface`, the 1px line, `radius: 14`, `shadow: "md"`) with Herdr's equal weights and `min: 90`.
- **`mods/topbar/`**: `main.js` draws the three roles with the kit's `avatar`, `icon` and `iconButton`, the space's color from `lib/space-colors.js`; `logic.js` picks the role, the shown space, its branch and machine, and the fold's next width; `lib/layout-tree.js` reads the sidebar's width and whether it is folded. It reads `props()`, `layout()`, `spaces()`, `focused()`, `panes()` and `shared("space.colors")`, runs `layout.resize` and `mod.open`, and runs no programs and reads no files.

## Watch out

- `traffic_lights` is in window pixels and doesn't follow the zoom, while the band does: above zoom 1 the buttons sit a few pixels above the band's middle.
- The sidebar folds to 44px on every system, and Herdr's 76px on macOS isn't needed: the window buttons sit over the rail. 44px is too narrow for the avatar next to the fold button.
- The extras run before the frame and patch the same copy of `tabs`, so the frame anchors on Herdr's own text, which no extra rewrites, and rewrites the panel fill wherever it appears.
- The cards' limits are in [`mods/pane-header/RECIPE.md`](../pane-header/RECIPE.md).

## Done when

- `bun run apply-layout` installs `nuoh-topbar` and a `nuoh` without `brand`, `sidebar-footer` and `status`, and `herdr-app status` shows no errors.
- The window shows the gradient, the rail card, the band with the window buttons over the rail, the title, the tabs and the machine pill, and the Spaces and Agents cards with the gradient around them and no sidebar fill behind.
- Dragging the line between the two cards resizes them, and it lights up in `accent` under the pointer.
- Switching spaces changes the avatar, the name and the branch chip.
- The fold button folds the sidebar to 44px and opens it to its width again.
- The machine pill opens Add machine; the panel buttons open and close Files, Changes and Graph.
- Dragging the band moves the window; pressing its buttons doesn't.
