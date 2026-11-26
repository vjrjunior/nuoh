# Rail

The `nuoh` layout's rail: a column of icons on the window's left edge that swaps the whole window between views. Search opens the command palette, Workspace shows the window `vjr-desk` shows (Spaces, Agents, tabs, panels), any view an extra adds shows its own mod full size, and Settings opens Settings. The Workspace tile carries the most urgent agent's status, and focusing a tab from anywhere else brings the Workspace back.

## What you see

- **The rail,** a card 54px wide on `surface` `#161616`, with 16px corners, a 1px `#FFFFFF12` line and a `md` shadow, 8px from the window's left and bottom edges. Above it, 8px down from the window's top, a 46px band with the macOS window buttons and 8px more before the card. The window's frame (the gradient, the band, the top bar) is in [`mods/topbar/RECIPE.md`](../topbar/RECIPE.md).
  - A column of 40px tiles with 11px corners, centered, 6px apart, 7px from the card's top and bottom: **Search** (`search`), a 24 x 1px `border` line with 4px above and below, one tile per view (Workspace is `terminal`; a view an extra adds brings its own icon), an empty stretch, and **Settings** (`settings`).
  - Icons are 18px. The tile of the view on screen sits on `selected` `#232323` with a 1px `input` `#343434` line and its icon in `foreground`; the others have their icon in `muted` `#A0A0A0`, and on hover sit on `hover` `#282828` with the icon in `foreground`.
- **The Workspace badge,** a 13px dot with a 2px `surface` ring (9px of color) 2px in from the tile's top-right corner, in `blocked` `#FF8080` when an agent needs the person, else `done` `#99FFE4` when one finished, else `working` `#FFC799` when one works. With every agent idle, or none, there is no dot. It shows whichever view is on screen.
- **Tooltips:** hovering a tile shows its name and, two spaces after, its key: `Workspace  ⌃⌘1`, `Board  ⌃⌘2`, `Search  ⌘⇧P`, `Settings  ⌘,`. Other systems spell the key out (`Ctrl+Cmd+1`).
- **The views,** right of the rail, 8px from it: Workspace is `vjr-desk`'s window in nuoh's frame. A view an extra adds fills the whole area with its mod, from the window's top.

## How it behaves

- **Picking a view:** a click on a view tile, or `ctrl-cmd-<n>` (`⌃⌘1`, `⌃⌘2`... in the rail's order, up to 9), runs `layout.select` on the `views` stack. Herdr keeps the choice across restarts, as it keeps any stack's.
- **Search** opens nuoh's copy of the command palette, as its key does. **Settings** opens nuoh's copy of Settings, which has no Square corners toggle.
- **Back to the Workspace:** the rail remembers the focused space, tab and pane. When they change while another view is on screen (a notification clicked, `agent.next`, the palette going to a tab, a view's mod opening a tab), the rail selects the Workspace. It doesn't when:
  - the pane that had the focus closed, so the focus moved by itself;
  - nothing has the focus, or no pane does;
  - the rail's own tile changed the view: a click takes the focus as it is then.
- A press on a tile never drags the window.

## Built from

- **Layout tree** (`recipes/rail.ts`, the `rail` recipe, run after this repo's recipes and before the extras): the root `row` keeps every field only the root reads (`titlebar`, `traffic_lights`, `background`, `terminal_padding`, `floating`, `terminal_menu`, `theme`, `preview`) and gets `resizable: false` and two children:
  - `rail`, a `block`, `size: { px: 54 }`, `content: { mod: "rail", props: { views } }`, where `views` is `[{ id, label, icon, key }]`;
  - `views`, a `stack`, `active: "workspace"`, whose first child, `workspace`, is the old root's `type`, `children` and `divider` (and `gap`, `padding`, `resizable` when it has them).
- **Keys** (`railKeys`, the `rail-keys` recipe, run after the extras): each view gets `key: "ctrl-cmd-<n>"` in the rail's props and a binding `{ "command": "layout.select", "args": { "stack": "views", "child": <id> } }` in the `layout:nuoh` section of `keys.json`.
- **Adding a view** from an extra: push a child onto `findNode(layout, "views").children` and `{ id, label, icon }` onto `findNode(layout, "rail").content.props.views`, with `icon` a kit icon's name. A layout without a `views` node is `vjr-desk`: `findNode` throws there.
- **Mod** `mods/rail/`: `main.js` draws with the kit (`icon`, `statusDot`); `logic.js` is pure (`viewsOf`, `shownView`, `badgeOf`, `focusOf`, `followFocus`, `keyLabel`, `hint`, `keyFor`). It reads `props()`, `layout()`, `focused()`, `panes()`, `agents()`, `keys()` and `window()`, and runs `layout.select` and `mod.open`. It runs no programs and reads no files.
- **The card:** `nuoh-frame` (`recipes/frame.ts`, run last) puts `rail` in a `rail-column` with the band above it and gives it `background: "surface"`, `border: { width: 1, color: "#FFFFFF12" }`, `radius: 16` and `shadow: "md"`. The mod draws no fill of its own, so the card's shows.

## Watch out

- `render` decides the return to the Workspace and may run `layout.select` from there, as Herdr's tab bar runs `layout.show` from its `render`. It never calls `setShared`.
- The badge is the most urgent status of `agents()`, not only the shown space's.
- The node's `radius` doesn't clip the mod: the mod keeps its tiles 7px from the card's ends so they never reach its corners.
- `ctrl-cmd-<n>` takes those keys from the terminal program in nuoh only.
- An extra's view whose id the `views` stack doesn't have fails the build (`the rail shows <id>, which views does not have`), and so do more than 9 views.

## Done when

- `bun run apply-layout` installs `layouts/nuoh.json` with `rail` and `views` as the root's children, and `nuoh-rail` among the mods.
- The rail shows Search, Workspace, each view an extra adds, and Settings, the shown view's tile on `selected`.
- `⌃⌘2` shows the second view full size, `⌃⌘1` the Workspace.
- With another view on screen, clicking a notification or pressing `agent.next`'s key shows the Workspace with that agent focused.
- An agent waiting for the person puts a `blocked` dot on the Workspace tile.
