# vjrjunior-herdr

VJR Desk for [Herdr](https://herdr.dev): the VJR theme, a dark palette of three hues (peach, mint and red) over a gray ladder, generated from one file for herdr-app and Ghostty, and a herdr-app layout built on it, with round or square corners.

## Install with an agent

Paste this into Claude Code, or any coding agent with a shell, on the machine that runs herdr-app:

```
Install the VJR Desk layout for herdr-app by following https://github.com/vjrjunior/vjrjunior-herdr/blob/main/INSTALL.md
```

[`INSTALL.md`](INSTALL.md) tells the agent what to check, what to run, what each mod reads and runs, and how to undo it. The rest of this file describes each part.

## Use the theme

Copy one file and pick the theme:

```sh
cp themes/vjr.json ~/.config/herdr-app/themes/
```

Then open **Settings → Look → Dark** and choose `vjr`, or run:

```sh
herdr-app do app.theme '{"name":"vjr"}'
```

Herdr's own command palette will not show it: its `Theme:` list holds only the four built-in themes. The layout below adds it. The choice applies to the layout on screen, and each layout keeps its own.

For Ghostty, copy `targets/ghostty/VJR` to `~/.config/ghostty/themes/` and set `theme = VJR`.

## Work on the palette

You need [Bun](https://bun.sh). There are no dependencies, so there is nothing to `bun install`.

`palette/vjr.toml` is the only source. `themes/vjr.json` and `targets/ghostty/VJR` are generated, and committed so that people can use them without running anything.

| Command | What it does |
|---|---|
| `bun run build` | Validates the palette and regenerates both themes. Writes only inside this repo. |
| `bun run install-theme` | Copies both themes into the apps. |
| `bun run uninstall-theme` | Puts back what was there before. |
| `bun run watch` | Builds and installs on every palette save, then refreshes herdr-app. |
| `bun test` | Runs the tests. |

The scripts are not called `install` and `uninstall` because a package script named `install` also runs on every `bun install`.

`selection` and `search` are computed from `peach.base`, so changing the accent moves them too.

### What install does

- Copies each theme atomically: a complete temp file next to `themes/`, then a rename, so an app never reads a partial theme.
- Keeps any file it did not create in `~/.local/state/vjr-herdr/backups/`, recorded in `~/.local/state/vjr-herdr/install.json`, before replacing it. It refuses to overwrite a backup.
- Skips an app whose config folder does not exist, with a warning.
- Does nothing when the content is already installed, and never changes which theme is selected.

`uninstall-theme` restores each backup and removes what install created. A target you changed after installing stays as it is, with a warning. It leaves the herdr-app selection alone, so if `vjr` was selected, pick another theme in Settings.

### What watch does

herdr-app does not watch `themes/`: it reads a theme file only when you switch to it. So after installing a change, `watch` switches to `graphite` and back to `vjr`, which also selects `vjr` in the layout on screen. If the app is closed or `herdr-app` is not on your PATH, it warns and keeps watching.

A palette that does not validate installs nothing, and the last good theme stays in place. Ghostty picks up changes when you reload its config.

### Paths

| Variable | Default | Used for |
|---|---|---|
| `HERDR_APP_HOME` | `~/.config/herdr-app` | herdr-app's folder, and which running window `herdr-app` talks to |
| `XDG_CONFIG_HOME` | `~/.config` | Ghostty's folder, and `vjr-herdr/config.json`, the [local config](#local-config) |
| `VJR_HERDR_CONFIG` | `~/.config/vjr-herdr/config.json` | another file for the local config |
| `XDG_STATE_HOME` | `~/.local/state` | backups, the install records and the layout log |

## Use the layout

One layout for herdr-app, `vjr-desk`, built from the version you have installed: Herdr's window with the VJR theme, `vjr` in the command palette, a **Graph** button that opens Git Graph in the side panel, and Spaces as a tree of each repository's worktrees, open or closed, drawn as a graph or as blocks, with the active space in its own color and your own colored folders on top. It has two looks: round corners, which are Herdr's own and the default, and square corners.

```sh
bun run install-theme
bun run apply-layout
herdr-app do layout.switch '{"name":"vjr-desk"}'
```

Switch between layouts with `cmd-shift-l`, or with `Layout:` in the command palette. `bun run uninstall-layout` removes everything `apply-layout` created and goes back to `main` if needed. It leaves the theme installed.

### Square corners

**Settings › Look › Square corners** is a toggle right under the layout picker, shown only while `vjr-desk` is on screen. Turned on, it squares every corner the layout can reach, including menus, popups, the command palette, Settings, Git Graph and the Spaces tree. It is the same layout with the same mods, built again: a toast says `Squaring the corners` or `Rounding the corners`, and the layout rebuilds in a few seconds. If the rebuild fails, the toggle goes back and a warning toast says why.

From a shell:

```sh
bun run apply-layout --square on
bun run apply-layout --square off
```

The choice is kept in `~/.local/state/vjr-herdr/layout.json` (`"square": true` or `false`), so a plain `bun run apply-layout` and the rebuild after a Herdr update keep it.

In both looks, Settings is the layout's copy of Herdr's, which has the toggle: the sidebar's gear, the palette's Settings entry and the Settings key (`cmd-,`, or whichever key `global` binds to it) open it. Other places where one of Herdr's mods opens Settings by itself, a machine's login note for example, open Herdr's own, which has no toggle.

With square corners, these stay rounded, because the app draws them or opens them by itself: renaming, close confirmations, notifications, peek, Welcome, What's new, the feedback window, Add machine's terminal dialog, the spinner and the window's outer corners.

### How it stays current

[`RECIPE.md`](RECIPE.md) describes the layout. It follows Herdr's format: `themes/`, `mods/` and `layouts/` mirror the app's folder. The difference is that the mods are not stored here, so this repo is not ready for a plain `cp`. Community layouts ship a copy of Herdr's mods from one version, and those stop receiving Herdr's fixes. Here `recipes/` holds small edits, and `bun run apply-layout` applies them to the files of the Herdr you have installed.

When Herdr updates, the invisible `vjr-sync` mod notices the new version and runs the same command, so the copies rebuild themselves within seconds. It only runs while `vjr-desk` is on screen.

If a recipe no longer fits the new version, nothing changes in the layout: the previous copies keep running and a warning says what to run. The shipped `main` layout is never touched, so `cmd-shift-l` always has somewhere to go.

- The folders in `~/.config/herdr-app/mods/vjr-*` are generated. To change one, edit `recipes/` and run `bun run apply-layout`.
- Run it again after changing the shortcut for the palette, Settings, help or search in the `global` section of `keys.json`.
- The layout stores this repo's path. If you move it, run `bun run apply-layout` from the new place.
- `~/.local/state/vjr-herdr/layout.log` records every run.

### Local config

`~/.config/vjr-herdr/config.json` holds what is yours and stays out of this repo. Without it the layout is the one described here. `XDG_CONFIG_HOME` moves the folder, and `VJR_HERDR_CONFIG` names another file.

```json
{
  "editor": { "name": "Zed", "argv": ["zed"] },
  "extras": [{ "path": "~/code/my-herdr-extras", "options": {} }]
}
```

- **`editor`** names the Markdown viewer's first button and gives the command it runs, with the file as its last argument.
- **`extras`** are folders with more recipes, each a path or `{ path, options }`. An extra has `recipes/index.ts`, which exports `recipes` (a list of `{ name, mods, apply }`, the shape in `recipes/recipe.ts`), its mods in `mods/<name>/` and, if it brings icons, `kit/icons/*.svg`.
  - Its recipes run in both looks after this repo's, and before `square` when the corners are square, so its mods are installed as `vjr-<name>` and come out square with Square corners on.
  - A recipe's `mods` entry with `from: "repo"` is read from the extra's own `mods/`, and `apply` gets the extra's `options`.
  - A mod of an extra imports the kit as `../../kit/kit.js`, like this repo's, and its icons are installed next to the kit's.
  - `square: { popupRoots, frameless }` on a recipe gives its popups the square border and drops Herdr's frame, with Square corners on.
  - An extra that does not load stops `apply-layout` before it installs anything, and the message names the folder.

Run `bun run apply-layout` after changing the file. `vjr-sync` reads it again on every Herdr update.

### A second line under a worktree

The Spaces tree draws a second line under any worktree that has an entry in the shared key `spaces-tree.lines`, so another mod can say where that worktree stands:

```js
setShared("spaces-tree.lines", { "/path/to/worktree": { text: "PR open", tone: "working", why: "2 checks running" } });
```

`text` is drawn in the `tone` color (`working`, `blocked`, `done` or `accent`; anything else is gray), then `· <why>` in `muted`. The key holds every worktree's line at once, so a mod that publishes it writes the whole map. Nothing in this repo writes it.

### Git Graph

`mods/git-graph/` is [herdr-git-graph](https://github.com/rabeeh-ta/herdr-git-graph) by Rabeeh T A (MIT), v0.3.3 at commit `0da8862`, with one change: its daily check for a new release on GitHub is turned off (`CHECK = false` in `update.js`). `apply-layout` installs it, and leaves an identical copy you already have alone.

It runs `git` in the focused repository and reads the folders open in other panes ahead of time, also on other machines. In a folder that is not a repository, it runs `find` to list the repositories up to 5 folders below it (3 unless you change it behind the gear), never from your home folder or above. It can commit your uncommitted changes when you ask it to, and opens a remote's page in the browser. It reaches the network only through git, on Fetch (in one repository or in every one it listed), Push and when deleting a remote branch.

It is third-party code that runs with your permissions, so it never updates by itself. To move to a new version, read the new code, replace `mods/git-graph/`, set `CHECK` to `false` again and run `bun run apply-layout`; a test fails while the check is on.

### Comeback

When the Mac restarts, Herdr brings every terminal back as a bare shell. `mods/comeback/` notes which Claude Code conversation runs in each terminal and, when the window opens after a restart, types `claude --resume` back into each terminal that lost its Claude, with the options it started with, then shows a toast with what came back. Options that load code (`--settings`, `--mcp-config`, `--plugin-dir`) stay behind: Comeback reads its notes from a label that any program with `hc` can write, and what a label says runs unattended after a reboot. It needs no hooks and edits no files outside Herdr's: it reads `hc`, `ps`, `sysctl`, `test` and `~/.claude/sessions/`, and keeps its notes as a `comeback` label on each terminal.

Each loss gets one automatic try. `herdr-app do vjr-comeback.resume` tries again. [`mods/comeback/RECIPE.md`](mods/comeback/RECIPE.md) describes it in full.

### Markdown viewer

`mods/markdown/` shows one Markdown file in a pane. Another mod opens it with `pane.split` and `props: { file }`, and so can you:

```sh
herdr-app do pane.split --direction right --mod vjr-markdown --props '{"file":"/path/to/NOTES.md"}'
```

The pane reads the file again when it changes and hides front matter. A link to another `.md` opens in the same pane, with `Back` (an outline button with an arrow) to return; web links open in the browser and other files in their own app. The header's right side has two buttons: Open, an outline button with a gray icon, opens the file in its own app, and Reload, an icon button with a tooltip, reads it again. With an `editor` in the [local config](#local-config), the first button carries that editor's name and runs its command. It reads only the file it shows and the files it links to, runs `open` or the configured editor, and never reaches the network.

### Move tab

Right-click a tab and pick `Move to…`, press `cmd-shift-m` for the focused tab, or drag the tab onto the Spaces tree to send it to another checkout of its repo: the main checkout, or a worktree, open as a space or not. The tab's Claude Code conversation is ended and resumed there with `claude --resume`, with the same options (a relative path in them still names the same folder or file) and a note that its folder changed. A shell with nothing running gets a new shell in the matching folder (`src/app` in the main checkout is `src/app` in the worktree), and a mod pane such as the Markdown viewer opens again with its props. Splits keep their shape, not their sizes. The tab shows up in the target space, selected, and the old space stays open: when the tab was its only one, the space gets a new tab with a shell at its checkout's root. A worktree with no space gets one first, named after its branch as `ABC-5365 · bulk orders cron` for `feat/ABC-4825--abc-5365-bulk-orders-cron` (the main checkout's keeps Herdr's own name).

A Claude session can also schedule its own move, which is how `/herdr-feature` sends a session into the worktree it just made:

```sh
sh ~/.config/herdr-app/mods/vjr-move-tab/schedule.sh --to <worktree> [--prompt <next turn>]
sh ~/.config/herdr-app/mods/vjr-move-tab/schedule.sh --cancel
```

It labels the session's terminal with `vjr.move-to` and returns at once. When the turn ends and Claude stays idle for two seconds, the worker moves only Claude's pane: other panes of the tab, a dev server say, stay where they are, and a Claude alone in its tab moves the whole tab as above. The prompt, when given, is the resumed Claude's first turn. The view follows only when that tab was on screen; otherwise it stays where you were. The script refuses at once, exit code 1 and one line saying why, outside a herdr-app terminal, when `vjr-desk` is not the layout on screen (nothing else would move it), when Claude isn't in front or reports no status, and when the destination isn't another worktree of the repo. A scheduled move is dropped with a toast when its conversation changed (`/clear`), when it waited 4 hours, or when its label can't be read.

To drag it, press the tab in the tab bar and release it on a row of the Spaces tree: the main checkout, a worktree, open as a space or not, or another space of the same checkout. While a tab is pressed, the pointer is a closed hand over the tab bar, and over the Spaces tree once the drag moves; over a terminal on the way it stays Herdr's. Once the pointer has moved a few pixels with the button held, the tab fades to show it is being dragged, every row that would take it gets a dashed `accent` border, and the row under the pointer a solid one; the tab's own space and rows outside its repo never do. Dragged along the tab bar instead, the tab it would land on gets the `accent` border, and releasing there reorders the tabs as Herdr always did. Releasing there asks for the same move as the popup, and releasing anywhere else moves nothing. The narrow rail, below 160px, takes no drops.

The mod is installed as `vjr-move-tab`, with a copy of Herdr's menu that holds the item (`vjr-menu`) and the layout's copy of Herdr's tab bar (`vjr-tabs`), which starts the drag. `cmd-shift-m` opens the popup for the focused tab in both looks, and the menu shows the key next to `Move to…`. `apply-layout` writes it to the layout's section of `keys.json` (`mod.open:vjr-move-tab`) on every run, so change it in `recipes/move-tab.ts`, not there. The copy of the mod that runs the move is an invisible floating block, so a move outlives the popup that asked for it.

It reads Herdr's live data (spaces, panes, terminals, agents), `~/.claude/sessions/<pid>.json` for each Claude's current conversation, whether `~/.claude/projects/` holds that conversation yet, and Herdr's document through `doc.get`, which it never writes. It runs `git`, `ps`, `kill`, `test`, `hc` (including `hc label` to clear a scheduled move and `hc read` for Claude's prompt) and `herdr-app do` (including `terminal.select` and `terminal.clear_selection` at Claude's cursor), plus `sh` only to pipe into `hc connect`. `schedule.sh` runs `hc`, `jq`, `git` and `herdr-app status`. It never reaches the network.

It refuses, with a toast that says why, when Claude is working or waiting for you, when Claude's prompt holds text you typed and haven't sent (the toast quotes its start; a grey suggestion from Claude doesn't count), when anything other than Claude, an idle shell or a mod runs in a pane (the toast names the program), when Claude has sub-agents or is another agent's sub-agent kept as a pane, or when the tab is on another machine or not in a git repo. Claude's own background processes end with it.

The transcript stays under the first folder's project in `~/.claude/projects/`, so `claude --resume <id>` works anywhere, but the worktree's own `/resume` picker may not list the conversation. A Claude that never had a turn has no conversation to resume yet, so a new `claude` with the same options starts in its place, and the toast says so. A tab let go anywhere but the tab bar or the Spaces tree, over a terminal say, stays in the drag until the next press, for at most 30 s: until then, the tab stays faded, the rows that would take it stay dashed, and they light up under the pointer. Any press anywhere ends a drag older than 300 ms, so a later click on a row only opens that row, and a later drag never drops the old tab. A release drops only on a row that lit up under the pointer first, so a press the tree can't see, such as one on its scrollbar, can't drop it either. [`mods/move-tab/RECIPE.md`](mods/move-tab/RECIPE.md) describes it in full.

### Spaces folders

Gather repositories, with their worktrees, and loose spaces into folders with a name and one of the six avatar colors. Folders sit at the top of the Spaces tree, in the order you made them; what isn't in a folder follows in Herdr's order.

Each folder is a card: its name sits on a gray band with a folder icon in its color and how many repositories and spaces it holds, and what it holds is listed inside the card, set in from both sides, in graph and in blocks alike.

- **Filing:** drag a repository's row (or a loose space's) onto a folder, or right-click a space and pick `Move to folder…`: the popup lists the folders, checks the one it's in, makes a `New folder…` with it, and takes it out with `Remove from folder`. A worktree's menu files its whole repository. Dragging a row onto a row in another folder, or outside any, reorders it as before and moves it into that row's folder, or out.
- **Making one:** the folder button left of `+` in the Spaces header opens `New folder` for an empty folder; `New folder…` in `Move to folder…` makes one with the row in it.
- **Folding:** click a folder's band. A folded folder is only its band and shows `N need you`, counting the agents in it that are blocked or done (or how many it holds when none are), and a dot in its most urgent status. When the space in front changes to one inside a folded folder, by a click, a key, `agent.next`, a toast or a script, the folder opens; folding it again while that space is in front keeps it folded.
- **Editing:** right-click a folder for its colors (applied at once), `Rename…` and `Delete folder`. Deleting gives its repositories and spaces back to the list; no space closes.

Both looks show the same folders, kept with their fold in `spaces.folders` in Herdr's shared state, and so do restarts. A space that becomes active from outside the tree unfolds its folder and is scrolled into view. Below 160px the rail shows each folder as its tile, followed by the numbers of its spaces while it's open. The space menu item is in the layout's copy of Herdr's menu (`vjr-menu`), and only shows when the Spaces tree opens that menu.

## Kit

`kit/kit.js` is the UI kit of this repo's mods (the Spaces tree, the Markdown viewer and Move tab): tokens (sizes, text, radii), components (`button`, `iconButton`, `link`, `chip`, `pill`, `card`, `heading`, `line`, `popupRow`, `mark`, `statusDot`, `stepNode`, `icon`, `toneColor`) and the SVG icons in `kit/icons/`. A mod imports it as `../../kit/kit.js`, and `apply-layout` copies `kit.js` into each installed mod that imports it. The icons are installed once, in the `kit` mod's `icons/` folder, where the kit reads them. A layout whose mods use the kit must include the `kit` recipe; the generator refuses otherwise.

`lib/` holds what more than one mod needs and no window shows: `checkouts.js` (a repo's worktrees and the checkout a folder is in) and `claude.js` (a Claude Code session, the options worth keeping, the command that resumes it). Herdr refuses an import from outside a mod's folder, so a mod imports a module as `../../lib/<name>.js` and `apply-layout` copies it, and what it imports, next to the mod's own files. A mod can't have a file with the name of a module it takes from `lib/`.

`mods/kit/` is a gallery that shows every component and icon. Open it beside the focused terminal:

```sh
herdr-app do pane.split --direction right --mod vjr-kit
```

Credits:
- [Lucide](https://lucide.dev) icons by Lucide Contributors (ISC; portions from Feather by Cole Bemis, MIT), from `lucide-static@0.469.0`. The license is in `kit/icons/LICENSE-lucide`.
- [Simple Icons](https://simpleicons.org) by Simple Icons contributors (CC0), from `simple-icons@13.21.0`: GitHub. Brand marks are their owners' trademarks.

## Test panel

Checks that need a person in the window, a drag or a toast, run from a small window inside Herdr instead of the chat. It shows one step at a time, with what to do, what to expect, a note field, `Passed` and `Failed`, and the last few things that happened. Write the steps as JSON and install them:

```sh
bun run test-panel path/to/run.json   # installs vjr-test-panel and opens it in each of the run's layouts
bun run test-panel --results          # every verdict, note and shot, then the events by step
bun run test-panel --close            # closes the panel in every layout
```

```json
{
  "title": "Move tab",
  "layouts": ["vjr-desk"],
  "watch": ["move-tab.drag", "move-tab.request"],
  "shotOn": ["move-tab.request"],
  "report": "t17",
  "steps": [
    {
      "title": "Drag a tab onto a worktree",
      "run": [{ "command": "space.select", "args": { "id": "sp..." } }],
      "do": ["Drag the tab \"split test\" onto feat/move-tab and let go."],
      "expect": "The row lights up, then the tab moves."
    }
  ]
}
```

- **Steps** run their `run` commands when they open, so a step can switch the layout, the space or the zoom for the person. A window is open in each layout in `layouts`, normally just `vjr-desk`, so it comes back after a switch, at the same step.
- **Both looks:** a run that checks round and square corners has one step per look. The look is not an app command, so a step's `run` cannot flip it: the step's `do` tells the person to flip Square corners in Settings, or the run's author runs `bun scripts/layout.ts apply --square on` before starting.
- **Events** are logged on their own: spaces and tabs opened, closed, moved and reordered, a tab's pane count, the layout, and each shared key in `watch`.
- **Shots:** each answer takes a `herdr-app shot`, and so does each change to a key in `shotOn`. They go to `~/.local/state/vjr-herdr/test-panel/<id>/` unless the run names `shots`.
- **When the last step is answered,** the panel types a one-line summary into the terminal in `report` with `hc send`, so the Claude that wrote the run gets the result without anyone going back to it.

The panel lives in `tools/test-panel/`, not in a layout, and uses the kit's icons from `vjr-kit`. It runs `herdr-app shot` and `hc send`, and reads only its own files.

## License

[MIT](LICENSE)
