# scripts/

The `package.json` commands run these files with Bun; there are no dependencies. Some internal names stay on purpose: the `vjr` theme, `~/.config/vjr-herdr/config.json`, `~/.local/state/vjr-herdr/` and `VJR_HERDR_CONFIG`. `paths.ts` resolves them (`HERDR_APP_HOME`, `XDG_CONFIG_HOME`, `XDG_STATE_HOME` move the folders).

## The layout: `layout.ts`

`bun run apply-layout` is `layout.ts apply [--herdr-version X]`. It builds the layout for the Herdr installed (the version from `herdr-app --version`, or the flag, which `nuoh-sync` passes) and prints `applied`, `unchanged` or `busy`. It needs the `vjr` theme in Herdr's `themes/` first. `generate-layout.ts` makes the copies, the layout and the keys ([`recipes/AGENTS.md`](../recipes/AGENTS.md)), `config.ts` reads the local config and loads the extras, `layout-keys.ts` merges the `layout:nuoh` section into `keys.json`.

1. Every copy is written to `build-<pid>`. A mod folder or layout file that exists but is not in the record stops it.
2. The build is compared with what is installed, leaving out `gpui-kit.d.ts` and `jsconfig.json`, which the app writes. Nothing differs: `unchanged`.
3. `herdr-app check` runs on each changed mod, 8 at a time, 60 s for all; one failure installs nothing.
4. The old copies move to `previous-<pid>` and the new ones in. A new error in `herdr-app status` after `NUOH_RELOAD_MS` (1500 by default) puts the old copies and the record back. `herdr-app status` is only a safety check: when it fails or its output can't be read, apply goes on.
5. `keys.json` and the layout files are written, the `.json` last.
6. What the record lists and this build no longer makes goes too: its key sections leave `keys.json` in step 5, and its mods and layout files go last: with a window open, apply waits `NUOH_RELOAD_MS` for Herdr to reload, switches to `nuoh` if the window shows a layout being removed and waits again; then it deletes them.

`bun run uninstall-layout` switches the window to `main` when it shows a recorded layout, then removes the recorded mods, files and key sections, and the record. It leaves the theme.

The layout's `sync` block carries `built`, `repo` and `bun` (`process.execPath`), and `nuoh-sync` runs apply from that folder when Herdr's version changes. So apply again after moving the repo, and from the main checkout once a worktree's branch lands or is dropped. Apply again after changing the palette's key in the `global` section of `keys.json` too: the layout's section is derived from it then.

### State, in `~/.local/state/vjr-herdr/`

- `layout.json`, the record: `{ version, mods, files, sections }`.
- `layout.log`: one line per run with the time, `cli` or the Herdr version asked for, the result and how long it took, or `failed:` and why.
- `layout.lock` holds the running apply's pid. A second apply prints `busy`; a lock whose process is gone is taken over.
- `build-<pid>` and `previous-<pid>` live only during a run. The next run deletes any left over, first moving back a previous copy whose mod folder is missing.
- `workflows/<run>/`, one folder per workflow run (below).

## Workflows: `workflow.ts`

`bun run workflow <command>` runs the workflows in `~/.config/vjr-herdr/workflows/<name>.json`. A workflow is a graph: steps (`nodes`) joined by connections (`edges`). Its kinds are `start` (where a run begins, one per workflow), `agent`, `continue` (an earlier agent step's agent, in the same conversation), `run` (a command), `approve` (a person decides) and `condition` (yes or no; its connections out carry `branch`). `workflow format` prints the format for a person or an agent, `workflow check` validates the files, and `workflow paths` makes both folders and prints them, with the script's path, for the Workflows view ([`mods/workflows/RECIPE.md`](../mods/workflows/RECIPE.md)), which can't read the environment. The pure part is `lib/workflow.js`: the checks, templates and conditions, the graph (order, loops found by a depth-first walk from `start`), which steps are ready, the loops' passes, and which results stay fresh.

- `run <name>` checks the file and its inputs, makes `workflows/<name>-<n>/` with `run.json` (a frozen copy of the workflow, the inputs, the space and its folder, the status, one record per step attempt, each step's `epoch` and each loop's count), and starts the runner, `workflow.ts exec <run> --runs <folder>`, with `hc run --bg --no-parent` and the labels `herdr.space`, a new `herdr.tab` and `nuoh.workflow=<run>`: a new tab in the space, without taking the focus. Without `--space` it takes the space of the terminal it runs in. `--from <step>` reuses the newest run's results before that step when neither the step nor its connections in changed since (and so on down); `--only <step>` runs that step alone on those results and refuses when one is missing.
- The runner starts every step whose connections in are through, up to 4 at a time. A step whose connections in all lead nowhere (a condition took the other branch) is skipped. A connection that goes back is a loop with `max`: taking it counts a pass and raises the `epoch` of every step after its target, so they run again; needing one more pass fails the run. A step that continues an agent waits while that agent works for another step.
- The runner reports OSC 7501 as `app=workflow` (working, blocked while a gate waits, done, error), so Herdr's sounds, toasts and Agents list follow a run. It names its tab `⚙ <name> #<n>`, retrying until Herdr has adopted the tab. It starts each agent with `hc run --bg --outlive-parent --no-notify` in the same tab, waits for it to report idle, sends the task with the answers of the agent and command steps that connect into it, waits for its turn to end and for its children (`hc wait --children all`), and reads the answer from the file the message names (`<step>-<attempt>.md`, or `.json` with typed fields), asking once more when it is missing or invalid. A command's output goes to `<step>-<attempt>.log`. `run.json` is written whole after each change, through a temporary file.
- `approve`, `reject` and `stop` write `decision.json`, which the runner takes within a second (`--node` names the gate when several wait); `a`, `r` (with the step when several wait) or `s` typed in the runner's pane do the same. `retry <run> [--from <step>]` runs again from the failed step, or the given one, as `--from` does; `resume <run>` starts a runner again for a run whose runner is gone, waiting again on agents that still run and on gates. `runs` reports such a run as `interrupted`.
- Everything the runner does to the outside goes through an `Io` (`workflow-io.ts` is the real one), so `tests/workflow-runner.test.ts` drives whole runs with fake terminals and a fake clock.
- `hc run` doesn't pass the caller's environment to the terminal it starts, which is why the runner gets its runs folder in its argv. `hc` and `herdr-app` also place their sockets by `XDG_STATE_HOME` and `XDG_CONFIG_HOME`, so a live try with those moved talks to no Herdr: try against the real folders and remove what it made.

## The theme: `build.ts`, `install.ts`, `watch.ts`

- `palette/vjr.toml` is the only source. `bun run build` checks that every role is `#RRGGBB` and writes `themes/vjr.json` and `targets/ghostty/VJR`, both committed. It writes only inside the repo.
- `bun run install-theme` copies both into `themes/vjr.json` in Herdr's folder and `ghostty/themes/VJR` under `XDG_CONFIG_HOME`, each as a temp file in the app's folder, then a rename. A file it didn't put there is backed up first to `backups/<app>/<file>` in the state folder and recorded in `install.json`; it refuses when another backup is already there. It skips an app whose folder doesn't exist, does nothing when the theme is current, and never selects the theme.
- `bun run uninstall-theme` restores each backup or removes what install made, leaves a file changed since with a warning, and leaves Herdr's selection alone.
- `bun run watch` rebuilds and installs on every palette save, then switches Herdr to `graphite` and back to `vjr`: Herdr reads a theme file only when it switches to it. Without `herdr-app` on `PATH` it warns and keeps watching.
- The commands aren't named `install` and `uninstall` because a package script named `install` also runs on every `bun install`.

## File icons: `file-icons.ts`

`bun run file-icons` writes `mods/files/icons/` (the SVGs and `LICENSE-material-icon-theme`) and `mods/files/file-icons.js` from `material-icon-theme` at `VERSION`. It fetches the package with `npm pack --ignore-scripts` and unpacks it with `tar` in a temporary folder, or takes an unpacked package's folder as its argument; it refuses any other version and runs none of the package's code. To move to a new release, change `VERSION` and run it; never edit those files by hand.

## The test panel: `test-panel.ts`

Installs and drives the test panel; its commands and the run format are in [`tests/AGENTS.md`](../tests/AGENTS.md).
