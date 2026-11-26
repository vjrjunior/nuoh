# Top bar

The `nuoh` layout's frame and top bar. The window sits on a dark gradient with every block 8px apart and 8px from the edges, the rail is a floating card, and a 46px band along the top holds the macOS window buttons, the shown space with its branch, the tabs, the panel buttons and the space's machine. The Herdr block on top of the sidebar, the sidebar's footer and the status bar are gone: the rail and this bar do what they did.

## What you see

- **The window** is a vertical gradient from `#181818` at the top to `#0D0D0D` at the bottom, with 8px of it around and between every block.
- **The band,** 46px tall along the window's top, 8px down from its edge:
  - Over the rail, 54px wide: empty. The macOS window buttons sit there, at `[18, 24]`, and dragging it moves the window.
  - **The title,** over the sidebar and as wide as it, 12px in from its left: a 28px fold button (`panel-left`, 14px, `muted`, no border, `hover` on hover), then 10px apart the space's avatar (28px, 8px corners, its first letter in bold 12px white on the space's color from the Spaces tree, `#22a99a` before it has one), its name (17px, semibold, `foreground`, cut with an ellipsis), and a chip with its branch (22px tall, 7px sides, 6px corners, on `raised` `#1C1C1C`: a 12px `git-branch` in `unknown` `#707070` and the branch in 12px `muted`, at most 140px wide). With the sidebar folded under 160px, only the fold button shows, centered.
  - **The tabs,** over the panes: each tab is a 32px pill with 9px corners, 12px sides and 13px text. The active one sits on `raised` `#1C1C1C` with a 1px `border` `#232323` line; the others have no fill and their name in `muted`. Then `+`, right after the last tab, and at the bar's right end a group with the buttons extras add (in their own look, without the `chrome` fill) and the panel buttons, each a 28px icon with 8px corners, on `selected` while its panel shows, its name in a tooltip. [`mods/pane-header/RECIPE.md`](../pane-header/RECIPE.md) describes the group.
  - **The machine pill,** at the right end of a 160px slot, 10px from the window's edge: 34px tall, 10px corners, on `surface` `#161616` with a 1px `border` line, a 14px `monitor` (or `server` for another machine), `This computer` or the machine's name in 12.5px `muted`, and a 12px `chevron-down` in `dim`. Its tooltip says `Add machine`; it turns `hover` with the text in `foreground` under the pointer.
- **The rail** is a 54px card under the band (see [`mods/rail/RECIPE.md`](../rail/RECIPE.md)).
- **The sidebar,** under the title, 8px from the rail and the panes, holds Spaces and Agents as two cards 8px apart, with the gradient between and around them: each on `surface` `#161616` with 14px corners, a 1px `#FFFFFF12` line and the rail's shadow. Spaces opens with a 40px header (a 14px `layers` and `Spaces` in 13px `muted`, the count of spaces in 12px `dim`, then 28px ghost buttons: the style, `folder-plus` and `plus`), and the tree inside is `vjr-desk`'s. [`mods/agent-list/RECIPE.md`](../agent-list/RECIPE.md) describes the Agents card. Between the sidebar and the panes, and between the two cards, a 1px line shows only while the pointer is over the boundary, in `accent`.
- **Panes** are cards with 14px corners and a 1px `#FFFFFF12` line; the focused one's line is `#FFC799B3`, the same width. Their header and fill, and the side panels' cards, are in [`mods/pane-header/RECIPE.md`](../pane-header/RECIPE.md).

## How it behaves

- The title follows the shown space: its avatar, name and branch change as the person switches spaces. The branch is the focused pane's when that pane is in the shown space, else the space's own; a space outside git shows no chip.
- The fold button folds an open sidebar to 44px, remembering its width in shared `sidebar.width`, and opens a folded one to that width (268px if none). It also writes `sidebar.collapsed`, as Herdr's sidebar button does. Its tooltip says `Collapse sidebar` or `Expand sidebar`.
- The machine pill opens Herdr's Add machine dialog. Its name follows the shown space's machine.
- Each panel button opens its panel, or closes it when it shows, as Herdr's do.
- Dragging the band, the title or the tab bar's empty space moves the window, and a double-click maximizes it. A press on the fold button, a tab, a panel button or the machine pill never drags it.
- No agent status shows here: the rail's Workspace tile and the Agents list carry it.

## Built from

- **Layout tree** (`recipes/frame.ts`, the `nuoh-frame` recipe, run in `nuoh` after the rail, the extras and the rail's keys, then `recipes/cards.ts`, the `nuoh-cards` recipe, last):
  - The root `row` gets `background: { gradient: ["#181818", "#0D0D0D"], angle: 180 }`, `padding: 8`, `gap: 8`, `traffic_lights: [18, 24]`, and no divider.
  - `rail-column`, a `column` of `size: { px: 54 }`, `resizable: false`, `gap: 8`: `lights` (a 46px `block`, `window_drag`, `topbar` with `role: "lights"`) and the `rail` card.
  - `workspace` gets `gap: 8` and `divider: { width: 1, color: "#00000000", hover: "accent" }`.
  - `sidebar` loses its `chrome` background to `sidebar-lists`, gets `gap: 8`, and opens with `space-title` (a 46px `block`, `window_drag`, `topbar` with `role: "title"`).
  - `work` gets `gap: 8`; `tabs` moves into `work-top`, a 46px `row` with `window_drag` and `resizable: false`, beside `machine` (a 160px `block`, `window_drag`, `topbar` with `role: "machine"`). `work-body` loses its padding.
  - `brand`, `sidebar-footer` and `status` go, and with them nuoh's copies of `workspace-chrome` and `workspace-status`.
  - The `main` block's pane frame gets `radius: 14`, `border: { width: 1, color: "#FFFFFF12" }` and `focus: { width: 1, color: "#FFC799B3" }`; `nuoh-cards` adds its fill, veil and header.
  - `nuoh-cards` takes the `chrome` background off `sidebar-lists` and gives it `gap: 8` and the same hidden `divider` as `workspace`. `spaces` and `agents` each get `background: "surface"`, `border: { width: 1, color: "#FFFFFF12" }`, `radius: 14` and `shadow: "md"`, keeping Herdr's equal weights and `min: 90`; `spaces` gets `props: { card: true }`, and `agents` shows `agent-list` in place of Herdr's `agents`.
- **The Spaces tree's `card` prop** paints no fill of its own, so the card's shows, puts the kit's `cardHeader` on top with the three buttons, and keeps 8px under its list. Folded under 160px it keeps only the `plus` button, as without the prop. `vjr-desk` doesn't pass it.
- **Patches** in nuoh's copy of `tabs`: the bar loses its `chrome` fill, its bottom line and the room it kept for the window buttons; tabs grow to 32px with 9px corners, and only the active one is filled and lined; panel buttons drop their label for a tooltip; every `.bg(on ? t.selected : t.chrome)` becomes a fill only while on, the extras' buttons included.
- **Mod** `mods/topbar/`: `main.js` draws with the kit (`avatar`, `icon`, `iconButton`); `logic.js` is pure (`roleOf`, `isNarrow`, `foldSidebar`, `shownSpace`, `branchOf`, `machineOf`). The space's color comes from `lib/space-colors.js`, shared with the Spaces tree. It reads `props()`, `layout()`, `spaces()`, `focused()`, `panes()` and `shared("space.colors")`, writes `sidebar.width` and `sidebar.collapsed`, and runs `layout.resize` and `mod.open`. It runs no programs and reads no files.
- **Icons:** `panel-left`, `monitor` and `server` from Lucide, in the kit.

## Watch out

- `traffic_lights` is in window pixels and doesn't follow the zoom, while the band does: at a zoom above 1 the buttons sit a few pixels above the band's middle.
- A node's `radius` rounds its own fill and line, not the mod inside or its children: the rail, the Spaces tree in its card and the Agents list draw no fill, and their rows stay inset so a hover or a selection never reaches the card's corners.
- The pane frame ignores `shadow`.
- The tab bar's anchors are Herdr's own text; the extras run before the frame and patch the same copy, so the frame anchors on text no extra rewrites, and rewrites the panel fill wherever it appears.
- The folded sidebar is 44px, too narrow for the avatar next to the fold button.

## Done when

- `bun run apply-layout` installs `nuoh-topbar` and a `nuoh` without `brand`, `sidebar-footer` and `status`, and `herdr-app status` shows no errors.
- The window shows the gradient, the rail card, the band with the window buttons over the rail, the title, the tabs and the machine pill, and the Spaces and Agents cards with no square fill behind them.
- Dragging the line between the two cards resizes them, and it lights up in `accent` under the pointer.
- Switching spaces changes the avatar, the name and the branch chip.
- The fold button folds the sidebar to 44px and opens it to its width again.
- The machine pill opens Add machine; the panel buttons open and close Files, Changes and Graph.
- Dragging the band moves the window; pressing its buttons doesn't.
- `vjr-desk` looks the same in both looks.
