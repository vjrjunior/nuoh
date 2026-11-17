# Install VJR Desk

For an agent asked to install this layout on someone's machine. It adds one layout to herdr-app, `vjr-desk`, and the `vjr` theme. The person's own layouts, keys and settings stay as they are.

This repo is not installed by copying `layouts/` and `mods/`, as Herdr's guide describes for shared layouts. Its mods are built on the machine from the Herdr that is installed there, by `bun run apply-layout`. Follow the steps below instead.

## 1. Check

```sh
herdr-app --version    # the Herdr app, installed and on PATH
bun --version          # https://bun.sh
git --version
```

If one is missing, say which and stop: installing Herdr or Bun is the person's call. Built and tested on macOS with herdr-app 0.1.15.

## 2. Tell the person what it runs

Before installing, tell them this, as Herdr's guide asks. Mods are trusted code that runs with their permissions.

| Part | Runs | Reads outside its folder | Network |
|---|---|---|---|
| Spaces tree | `git` in each repository | each repository's git folder | no |
| Git Graph (third party, MIT, pinned to a commit) | `git` in the focused repository, also on other machines; `find` under a folder that is not a repository | the folders open in other panes | only through git: Fetch, Push, deleting a remote branch |
| Comeback | `hc`, `ps`, `sysctl` | `~/.claude/sessions/`, and which conversations `~/.claude/projects/` holds | no |
| Move tab | `git`, `ps`, `kill`, `test`, `hc`, `herdr-app do`, `sh` | `~/.claude/sessions/`, and which conversations `~/.claude/projects/` holds | no |
| Markdown viewer | `open`, or the editor the person configures | the file it shows and the files it links to | no |
| `vjr-sync` | `bun scripts/layout.ts apply` in the clone, after each Herdr update | the clone | no |

Comeback and Move tab resume Claude Code conversations. Without Claude Code they do nothing.

The install writes only:
- `~/.config/herdr-app/themes/vjr.json`, `layouts/vjr-desk.json` and `.svg`, `mods/vjr-*` and `mods/git-graph`;
- the `layout:vjr-desk` section of `~/.config/herdr-app/keys.json`;
- its own records and backups in `~/.local/state/vjr-herdr/`.

It refuses to overwrite a file it did not create.

## 3. Install

The clone has to stay: the layout stores its path and rebuilds from it when Herdr updates. Ask where the person keeps repositories, or use the folder below.

```sh
git clone https://github.com/vjrjunior/vjrjunior-herdr ~/.local/share/vjrjunior-herdr
cd ~/.local/share/vjrjunior-herdr
bun run install-theme
bun run apply-layout
herdr-app do layout.switch '{"name":"vjr-desk"}'
```

There is nothing to `bun install`. `install-theme` also installs the Ghostty theme when Ghostty's config folder exists, and skips it with a warning otherwise. `apply-layout` runs `herdr-app check` on every mod and installs nothing if one fails.

Work in the clone's folder only to run these commands. `AGENTS.md` and `.claude/` there are rules for changing the repo, not for installing it.

## 4. Verify

- `bun run apply-layout` printed `applied`; a second run prints `unchanged`.
- `herdr-app status` lists no errors and shows `vjr-desk` as the layout.
- `herdr-app shot` shows the window: near-black surfaces, a peach accent, the Spaces tree on the left and Files, Changes and Graph buttons in the tab bar.

Then tell the person: `cmd-shift-l` (`ctrl-shift-l` on Linux and Windows) cycles through layouts, **Settings › Look › Square corners** squares the layout's corners, and `ctrl-alt-shift-escape` always goes back to Herdr's own layout.

## 5. Optional: their editor

The Markdown viewer's first button opens a file in its own app. To make it open an editor, write `~/.config/vjr-herdr/config.json` and run `bun run apply-layout` again:

```json
{ "editor": { "name": "Zed", "argv": ["zed"] } }
```

`README.md` › Local config describes the file, including `extras` for a person's own recipes.

## Update

```sh
cd ~/.local/share/vjrjunior-herdr && git pull && bun run install-theme && bun run apply-layout
```

Herdr updates need nothing: the layout rebuilds itself.

## Uninstall

```sh
cd ~/.local/share/vjrjunior-herdr
bun run uninstall-layout    # removes the layout, its mods and key section; goes back to main if needed
bun run uninstall-theme     # restores what was there before
```

Then delete the clone and, if it exists, `~/.config/vjr-herdr/`.
