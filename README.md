# nuoh

nuoh is a layout for [Herdr](https://herdr.dev)'s desktop app, herdr-app: Herdr's window, with its spaces, agents, tabs and panels, behind a rail of views on the left, every block a card on a dark gradient. It comes with the VJR theme, a dark palette of three hues (peach, mint and red) over a gray ladder, generated from one file for herdr-app and Ghostty. The layout is built on your machine from the Herdr you have installed, and builds itself again when Herdr updates.

## Install

Paste this into Claude Code, or any coding agent with a shell, on the machine that runs herdr-app:

```
Install the nuoh layout for herdr-app by following https://github.com/vjrjunior/nuoh/blob/main/INSTALL.md
```

[`INSTALL.md`](INSTALL.md) tells the agent what to check, what each mod runs and reads, and how to undo it. By hand, with [Bun](https://bun.sh) and a clone that stays where it is (the layout rebuilds from it):

```sh
bun run install-theme
bun run apply-layout
herdr-app do layout.switch '{"name":"nuoh"}'
```

`cmd-shift-l` switches layouts. `bun run uninstall-layout` removes everything `apply-layout` made and goes back to `main` if needed; it leaves the theme installed.

## What you get

- **The rail** ([recipe](mods/rail/RECIPE.md)) swaps the whole window between views: Search opens the command palette, Workspace is Herdr's window, a view an extra adds fills the window with its own mod, and Settings opens Herdr's Settings. The Workspace tile carries a dot in the most urgent agent's color, and a tab focused from elsewhere (a notification, `agent.next`) brings the Workspace back.
- **The top bar** ([recipe](mods/topbar/RECIPE.md)) holds the macOS window buttons over the rail, a button that folds the sidebar, the shown space with its branch, the tabs with `+` after them, the panel buttons in one group, and the space's machine, which opens Add machine.
- **Spaces** ([recipe](mods/spaces-tree/RECIPE.md)) shows each repository's main checkout with every worktree under it, open or closed, as a graph or as blocks. Gather repositories and spaces into folders with a name and a color, fold them, and pin a repository, a space or a folder to the top.
- **Agents** ([recipe](mods/agent-list/RECIPE.md)) gives each agent a row: its space, its program, a `Needs you`, `Working` or `Done` chip, how long it has been in that state, and its title. Pins and sub-agents work as in Herdr's list.
- **Panes** ([recipe](mods/pane-header/RECIPE.md)) are cards with a header: the program, the title, the agent's chip and the folder, with split, zoom and close on hover. The panels beside them are cards too: **Files** ([recipe](mods/files/RECIPE.md)), this repo's own tree of the focused repository with type icons, git colors, a filter and a right-click menu; **Changes**, Herdr's; and **Graph**, the focused repository's git history.
- **Markdown** ([recipe](mods/markdown/RECIPE.md)) shows one `.md` file formatted, in a pane beside the terminal. `cmd-shift-o`, or `Open Markdown…` in a terminal's right-click menu, lists the files the terminal shows and the repository's; a `.md` Cmd-clicked in a terminal or clicked in Files opens there too.
- **Move tab** ([recipe](mods/move-tab/RECIPE.md)) sends a tab to another checkout of its repo, from `Move to…` in the tab's menu, `cmd-shift-m` or a drag onto the Spaces tree. Its Claude Code conversation ends and resumes there.
- **Comeback** ([recipe](mods/comeback/RECIPE.md)) gives each terminal that lost its Claude Code in a restart the same conversation back, as soon as the window opens, with a toast that says what came back.
- **Workflows** ([recipe](mods/workflows/RECIPE.md)) run a graph of agent, command, condition and approval steps, each getting what the ones before it produced, side by side where they can, with loops that stop at a limit, in a new tab of a space. The Workflows view on the rail lists them, shows where a run is and approves its gates; an agent writes a new one from `bun run workflow format`, and `bun run workflow run <name>` starts one from a terminal ([`scripts/AGENTS.md`](scripts/AGENTS.md#workflows-workflowts)).

## Keys

`nuoh` adds these to Herdr's own keys, in the `layout:nuoh` section of `keys.json`:

| Key | Does |
|---|---|
| `ctrl-cmd-1` … `ctrl-cmd-9` | shows the rail's views, in its order |
| `cmd-shift-p` | opens nuoh's command palette, which lists these keys too |
| `cmd-shift-o` | lists the Markdown files of the focused terminal and its repository |
| `cmd-shift-m` | opens Move to… for the focused tab |
| `cmd-shift-j` | goes to the next agent waiting on you, blocked ones first |

The palette takes whichever key `global` binds to `app.palette`: run `bun run apply-layout` again after changing it. `apply-layout` rewrites the section on every run, so the other keys change in `recipes/`, not there. `ctrl-alt-shift-escape` always goes back to Herdr's own layout.

## Theme and palette

To use only the theme, copy `themes/vjr.json` to `~/.config/herdr-app/themes/` and pick `vjr` in **Settings › Look**, or run `herdr-app do app.theme '{"name":"vjr"}'`. In Ghostty, copy `targets/ghostty/VJR` to `~/.config/ghostty/themes/` and set `theme = VJR`.

`palette/vjr.toml` is the only source. `themes/vjr.json` and `targets/ghostty/VJR` are generated from it, and committed so that nobody has to run anything to use them. There is nothing to `bun install`.

| Command | What it does |
|---|---|
| `bun run build` | Validates the palette and regenerates both themes, inside this repo only. |
| `bun run install-theme` | Copies both themes into the apps, skipping one whose config folder doesn't exist, and keeps any file it didn't create in `~/.local/state/vjr-herdr/backups/`. |
| `bun run uninstall-theme` | Puts back what was there before. |
| `bun run watch` | Builds and installs on every save of the palette, then refreshes herdr-app. |
| `bun test` | Runs the tests. |

`selection` and `search` are blended from `peach.base`, so changing the accent moves them too. herdr-app reads a theme file only when it switches to it, so `watch` switches to `graphite` and back to `vjr`. Ghostty picks up a change when you reload its config. A palette that doesn't validate installs nothing.

## Local config

`~/.config/vjr-herdr/config.json` holds what is yours and stays out of this repo. Without it the layout is the one described here. `XDG_CONFIG_HOME` moves the folder, and `VJR_HERDR_CONFIG` names another file.

```json
{
  "editor": { "name": "Zed", "argv": ["zed"] },
  "extras": ["~/code/my-herdr-extras"]
}
```

- **`editor`** names the Markdown viewer's first button and the Files menu's `Open in <editor>`, and gives the command they run, with the file or folder as its last argument. Without it, both open the file in its own app.
- **`extras`** are folders of your own recipes and mods, which can add a view to the rail, a button to the tab bar or a panel beside the panes. [`recipes/AGENTS.md`](recipes/AGENTS.md) has the contract.

Run `bun run apply-layout` after changing the file.

## How it stays current

Nothing here is a frozen copy of Herdr: `recipes/` holds small edits, and `apply-layout` applies them to Herdr's own `main` layout and to copies of its mods, then installs every copy as `nuoh-<name>`. When Herdr updates and `nuoh` opens on the new version, the invisible `nuoh-sync` runs the same build, with the local config, from the folder the layout was applied from. If a recipe no longer fits, nothing changes: the previous copies keep running and a toast, `nuoh stayed on <version>`, says what to run. Each run is logged in `~/.local/state/vjr-herdr/layout.log`; after moving the clone, run `apply-layout` from its new place.

## License

[MIT](LICENSE). Code and icons adopted whole keep their own license file in their folder: `mods/git-graph/`, `kit/icons/` and `mods/files/icons/`.
