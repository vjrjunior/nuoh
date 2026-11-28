# Install nuoh

For an agent asked to install this layout on someone's machine. It adds one layout to herdr-app, `nuoh`, and the `vjr` theme. The person's own layouts, keys and settings stay as they are.

This repo is not installed by copying `layouts/` and `mods/`, as Herdr's guide describes for shared layouts: its mods are built on the machine, from the Herdr installed there, by `bun run apply-layout`. Follow these steps instead.

## 1. Check

```sh
herdr-app --version    # the Herdr app, installed and on PATH
bun --version          # https://bun.sh
git --version
```

If one is missing, say which and stop: installing Herdr or Bun is the person's call. Built and tested on macOS with herdr-app 0.1.18.

## 2. Tell the person what it runs

Before installing, tell them this, as Herdr's guide asks. Mods are trusted code that runs with their permissions. None reaches the network, except Git Graph through git.

| Part | Runs | Reads outside its folder |
|---|---|---|
| Spaces | `git` in each repository a space is in | each repository's git folder, which it watches |
| Files | `sh`, `git`, `find` (in a folder outside git), `open`, or the configured editor | the files of the focused pane's repository, which it watches |
| Markdown viewer | `open` for links, or the configured editor | the file it shows, its folder (watched), and the files it links to |
| Markdown picker | `hc read` on the terminal, `sh`, `git`, `ls` | which of the paths on the terminal's screen exist |
| Move tab | `hc get`, `hc read`, `hc label`, `hc connect` (only to read Herdr's document with `doc.get`), `herdr-app do`, `git`, `ps`, `kill -TERM`, `test`, `sh` | `~/.claude/sessions/<pid>.json`, and which conversations `~/.claude/projects/` holds |
| Move tab's `schedule.sh` | `hc get`, `hc label`, `jq`, `git`, `herdr-app status` | `~/.claude/sessions/<pid>.json` |
| Comeback | `hc get`, `hc read`, `hc label`, `hc send`, `ps`, `env`, `sysctl`, `test` | `~/.claude/sessions/`, which conversations `~/.claude/projects/` holds, and `/proc/sys/kernel/random/boot_id` on Linux |
| Git Graph (adopted whole, its license in its folder) | `git` in the focused repository and in the folders open in other panes, also on other machines; `find` for the repositories up to 5 folders below a folder that isn't one, never from the home folder or above | those folders |
| Copies of Herdr's `menu`, `tabs` and `palette` | what Herdr's own run: the menu runs `git rev-parse` | nothing more |
| `nuoh-sync` | `bun scripts/layout.ts apply` in the clone after a Herdr update, for at most 120 s | the clone and the local config |
| Workflows view | `bun scripts/workflow.ts` in the clone (`paths`, and `run`, `approve`, `reject`, `stop`, `resume`, `retry` when the person asks) | `~/.config/vjr-herdr/workflows/` and the runs in `~/.local/state/vjr-herdr/workflows/`, which it watches |
| A workflow's runner, started by Run | `hc run`, `hc send`, `hc wait`, `hc read`, `hc get`, `herdr-app do tab.rename`, and the agents and commands the person's workflow file names | the workflow file and its run's folder |

The rail, the top bar, the Agents list, the pane header and the kit's gallery run nothing and read no files: they use Herdr's live data and commands.

Git Graph reaches the network only through git, when the person asks for Fetch, Pull or Push or deletes a remote branch. Its check for a new release is turned off (`CHECK = false` in `mods/git-graph/update.js`). Comeback types `claude --resume` into each terminal that lost its Claude in a restart, and Move tab ends a Claude with SIGTERM and resumes it in the other checkout; without Claude Code both do nothing. A workflow runs only when the person starts it, and its agents get the argv its file gives, with no permission flags added; nuoh ships no workflow.

The install writes only:
- `~/.config/herdr-app/themes/vjr.json`, and `~/.config/ghostty/themes/VJR` when Ghostty's config folder exists;
- `~/.config/herdr-app/layouts/nuoh.json` and `nuoh.svg`, and 16 mods named `mods/nuoh-*`;
- the `layout:nuoh` section of `~/.config/herdr-app/keys.json`;
- its own records, backups and log in `~/.local/state/vjr-herdr/`.

`apply-layout` refuses to overwrite a layout or mod it did not create, and `install-theme` backs up a theme file it did not create before replacing it.

## 3. Install

The clone has to stay: the layout stores its path and rebuilds from it when Herdr updates. Ask where the person keeps repositories, or use the folder below.

```sh
git clone https://github.com/vjrjunior/nuoh ~/.local/share/nuoh
cd ~/.local/share/nuoh
bun run install-theme
bun run apply-layout
herdr-app do layout.switch '{"name":"nuoh"}'
```

There is nothing to `bun install`. `apply-layout` needs the theme installed first, runs `herdr-app check` on every mod and installs nothing if one fails. Work in the clone's folder only to run these commands: `AGENTS.md` and `.claude/` there are rules for changing the repo, not for installing it.

## 4. Verify

- `bun run apply-layout` printed `applied`; a second run prints `unchanged`.
- `herdr-app status` lists no errors and shows `nuoh` as the layout.
- `herdr-app shot` shows the window: a dark gradient, the rail on the left, Spaces and Agents as cards, and the Files, Changes and Graph buttons at the right of the tab bar.

Then tell the person: `cmd-shift-l` (`ctrl-shift-l` on Linux and Windows) cycles through layouts; the rail's tiles, or `ctrl-cmd-1`, `ctrl-cmd-2`..., swap the window between views; and `ctrl-alt-shift-escape` always goes back to Herdr's own layout.

## 5. Optional: their editor

The Markdown viewer's first button and the Files menu open a file in its own app. To make them open an editor, write `{ "editor": { "name": "Zed", "argv": ["zed"] } }` to `~/.config/vjr-herdr/config.json` and run `bun run apply-layout` again. `README.md` › Local config describes the file.

## Update

```sh
cd ~/.local/share/nuoh && git pull && bun run install-theme && bun run apply-layout
```

Herdr updates need nothing: the layout rebuilds itself. `apply-layout` also removes the layouts, mods and key sections an earlier version installed and this one no longer builds, switching to `nuoh` first when one of those layouts is on screen.

## Uninstall

```sh
cd ~/.local/share/nuoh
bun run uninstall-layout    # removes the layout, its mods and its key section; goes back to main if needed
bun run uninstall-theme     # restores what was there before
```

Then delete the clone and, if it exists, `~/.config/vjr-herdr/`.
