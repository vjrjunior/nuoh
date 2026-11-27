# Rail

The `nuoh` layout's rail: a column of icons on the window's left edge that swaps the whole window between views. Search opens the command palette, Workspace shows Herdr's window in nuoh's frame (Spaces, Agents, tabs, panels), a view an extra adds shows its own mod full size, and Settings opens Herdr's Settings. The Workspace tile carries the most urgent agent's status, and focusing a tab from anywhere else brings the Workspace back.

![Rail](preview.png)

## What you see

- **The rail,** a card 54px wide on `surface` `#161616`, with 16px corners, a 1px `#FFFFFF12` line and a `md` shadow, under the 46px band that holds the macOS window buttons ([`mods/topbar/RECIPE.md`](../topbar/RECIPE.md)).
  - A column of 40px tiles with 11px corners, centered, 6px apart, 7px from the card's top and bottom: **Search** (`search`), a 24 x 1px `border` line with 4px above and below, one tile per view in the rail's order (Workspace is `terminal`; a view an extra adds brings a kit icon's name, `layers` when it names none), an empty stretch, and **Settings** (`settings`).
  - Icons are 18px. The tile of the view on screen sits on `selected` `#232323` with a 1px `input` `#343434` line and its icon in `foreground`; the others have their icon in `muted` `#A0A0A0`, and on hover sit on `hover` `#282828` with the icon in `foreground`.
- **The Workspace badge,** a 13px dot with a 2px `surface` ring, 2px in from the tile's top-right corner: `blocked` `#FF8080` when an agent needs the person, else `done` `#99FFE4` when one finished, else `working` `#FFC799` when one works; no dot while every agent is idle, or there are none. It shows whichever view is on screen.
- **Tooltips:** a tile's name and, two spaces after, the key bound to it: `Workspace  ⌃⌘1`, `Search  ⌘⇧P`, `Settings  ⌘,`. Other systems spell the keys out (`Ctrl+Cmd+1`).
- **The views,** right of the rail, 8px from it: the Workspace is Herdr's window in nuoh's frame; a view an extra adds fills the whole area with its mod, from the window's top.

## How it behaves

- **Picking a view:** a click on its tile, or its key, runs `layout.select` on the `views` stack. The keys follow the rail's order: the first view gets `ctrl-cmd-1`, the next `ctrl-cmd-2`, up to 9, so the Workspace is `ctrl-cmd-1` unless an extra puts a view in front of it. Herdr keeps the choice across restarts, as it keeps any stack's.
- **Search** runs `mod.open` of `nuoh-palette`, nuoh's copy of Herdr's palette, which also lists the keys of `keys.json`'s `layout:nuoh` section. **Settings** runs `app.settings`, Herdr's own Settings.
- **Back to the Workspace:** the rail remembers the focused space, tab and pane. When they change while another view is on screen (a notification clicked, `agent.next`, the palette going to a tab, a view's mod opening a tab), it selects the Workspace. It doesn't when the pane that had the focus closed, when no pane has the focus, or when its own tile changed the view: a click takes the focus as it is then.
- A press on a tile never drags the window.

## Built from

- **`recipes/rail.ts`**:
  - `rail`, run after this repo's other recipes and before the extras: the root `row` keeps every field only the root reads (`titlebar`, `traffic_lights`, `background`, `floating`, `theme`, ...), moves its `type`, `children`, `divider` and any `gap`, `padding` and `resizable` into `workspace`, and gets `resizable: false` and two children: `rail`, a 54px `block` with `content: { mod: "rail", props: { views: [{ id: "workspace", label: "Workspace", icon: "terminal" }] } }`, and `views`, a `stack` with `active: "workspace"` and `workspace` as its first child.
  - `rail-keys`, run after the extras: gives each entry of the rail's `views`, in order, `key: "ctrl-cmd-<n>"` and binds that key to `{ "command": "layout.select", "args": { "stack": "views", "child": <id> } }` in `layout:nuoh`.
- **Adding a view** from an extra: push a child onto `findNode(layout, "views").children` and `{ id, label, icon }` onto `findNode(layout, "rail").content.props.views`. At the front of both lists it becomes the first view and takes `ctrl-cmd-1`; the stack's `active` stays `workspace`.
- **The card:** `nuoh-frame` (`recipes/frame.ts`) puts `rail` in `rail-column` under the band and gives it the card's fill, line, `radius: 16` and shadow. The mod paints no fill of its own.
- **`mods/rail/`**: `main.js` draws the tiles with the kit's `icon` and `statusDot`; `logic.js` reads the views from the props and holds the shown view, the badge, when to go back to the Workspace and the key labels; `lib/layout-tree.js` finds the `views` stack. It reads `props()`, `layout()`, `focused()`, `panes()`, `agents()`, `keys()` and `window()`, runs `layout.select`, `mod.open` and `app.settings`, and runs no programs and reads no files.

## Watch out

- `render` decides the return to the Workspace and may run `layout.select` from there, as Herdr's tab bar runs `layout.show` from its `render`. It never calls `setShared`.
- The badge is the most urgent status of all of `agents()`, not only the shown space's.
- The tiles stay 7px from the card's ends because a node's radius doesn't clip its mod ([`mods/pane-header/RECIPE.md`](../pane-header/RECIPE.md) lists the cards' limits).
- `ctrl-cmd-<n>` takes those keys from the terminal program while `nuoh` shows.
- A view the `views` stack doesn't have fails the build (`the rail shows <id>, which views does not have`), and so do more than 9 views.

## Done when

- `bun run apply-layout` installs `layouts/nuoh.json` with `rail-column` (holding `rail`) and `views` as the root's children, and `nuoh-rail` among the mods.
- The rail shows Search, every view in order and Settings, the shown view's tile on `selected`; Search opens the palette and Settings opens Herdr's Settings.
- With a view from an extra, its key shows it full size and the Workspace's key brings the Workspace back.
- With another view on screen, clicking a notification or pressing `agent.next`'s key shows the Workspace with that agent focused.
- An agent waiting for the person puts a `blocked` dot on the Workspace tile.
