# Workflows

A view on the rail for the workflows in `~/.config/vjr-herdr/workflows/`: chains of agent, command and approval steps that `bun run workflow` runs ([`scripts/AGENTS.md`](../../scripts/AGENTS.md#workflows-workflowts)). It lists them, shows one's steps as a timeline with where its chosen run is, lists its runs, and starts, approves, stops, resumes and retries them. A new workflow, or a change to one, is written by an agent in a new tab, from the format the command prints.

![Workflows](preview.png)

## What you see

The view fills the views area from the window's top: a 46px band over the body, 8px apart.

- **The band:** the kit's `viewTile` with the `route` icon, "Workflows" in 17px semibold, the count of valid workflows ("1 workflow", "3 workflows") in 12.5px `unknown`, and at the right a `New workflow` pill with the `plus` icon. Dragging the band moves the window.
- **The body,** three `viewCard`s side by side, 8px apart, each with a 40px `cardHeader`:
  - **Workflows,** 260px: one `menuItem` per file, sorted by name. Its mark is the last run's status dot (`working` `#FFC799` while it runs, `blocked` `#FF8080` when it needs you or failed, `done` `#99FFE4` when done, `unknown` when stopped or cut off), or the `route` icon before any run. The title, and under it "6 steps · Needs you". A file that doesn't validate shows the `exclamation` icon, its name in `blocked` and its first problem.
  - **The steps,** the rest of the width. The header has the workflow's title, `Edit` (ghost, `bot`) and `Run` (primary, `play`); an invalid file has `Fix with an agent` and its problems in `blocked`. With a run chosen, a line under the header shows its status chip, `#n`, "5m ago · 2m", `Show` while its runner lives, and `Stop`, `Resume` or `Retry`, with the run's error under it. Then the workflow's `about` in `muted`, a `working` line per warning (an agent run with `--dangerously-skip-permissions`), and one `timelineStep` per step: its id, and at the right "Done", "Running", "Needs you", "Failed", "Skipped" or "Cut off", with "· 2×" when a loop ran it again. Its node is a mint check when done, a peach ring on the step the run is at, a red mark when it failed or was cut off, and an empty ring otherwise. Under each, a `stepCard`: the kind's icon (`bot` for an agent, `terminal` for a command, `flag` for a gate) with the program and its arguments, "continues <step>", "$ <command>" or the gate's question; `when …` and "back to <step>, up to N×" in 11px `unknown`; the task's first three lines until the step has a result, then the result's first six lines, its typed fields as `detailLine`s under ANSWER, or its error in `blocked`. A step whose agent lives has `Show`. The step a run waits at has `Approve` (primary) and `Reject` (danger). With a run chosen, templates show the run's values.
  - **Runs,** 300px: the chosen workflow's last 20 runs, newest first, as `taskRow`s: a ring in the status's color, "#4 · Needs you", the space's name and "5m ago · 2m". The chosen run's row is lit. Empty: "No runs yet".
- **No workflows:** one card with `emptyState`: the `route` icon, "No workflows yet", "Write one with an agent, or put a file in <folder>.", and a primary `New workflow`.
- **The run popup,** a 440px dialog: "Run <title>", "Opens a new tab in the space you pick, without leaving this one.", an `input` per input under its label ("Task (required)"), "SPACE" over a list of this machine's spaces (up to 6 rows, then it scrolls) with a check on the chosen one, the reason in `blocked` when the run can't start, and `Cancel` and `Run` at the bottom right.

## How it behaves

- **Choosing:** a click on a workflow shows its steps and its newest run; a click on a run shows the steps as that run left them. When a new run of the shown workflow appears, it becomes the chosen one.
- **Run** opens the popup with the workflow's inputs, their defaults filled in, and the focused space chosen (the first space of this machine when the focused one is on another). `Run` stays dim until the required inputs are filled; it runs `workflow run <name> --input k=v … --space <id> --json` and closes the popup, or shows the command's reason.
- **Approve, Reject, Stop, Resume, Retry** run `workflow approve|reject|stop|resume|retry <run>`; the button spins until the command answers, and a failure posts an error toast with the command's message. The runner takes a decision within a second.
- **Show** on the run line focuses the runner's pane; on a step, its agent's pane (`pane.focus {terminal}`). A focus from here brings the Workspace back, as the rail does for any focus.
- **New workflow, Edit, Fix with an agent** open a tab in the focused space, in the workflows folder, with the first installed agent from `knownAgents()` and a first message: run `workflow format`, ask what the workflow should do (or say what it does now and ask what should change), write the file, and run `workflow check` until it says ok. Without an installed agent, a warning toast says so.
- **Statuses:** a run reads its `run.json` status, except that one not over whose runner isn't among the live terminals reads Interrupted, and a run still `starting` after 30 s too. A run at a gate is also an agent for Herdr: its sound, toast and the rail's dot come from the runner, not this view.
- **Updates:** the view reads the files again when `watchFolder` reports a change in the workflows folder or the runs folder, waiting 5 s before watching again when a watch fails; "5m ago" lines redraw every 30 s while the window is visible.

## Built from

- **`recipes/workflows.ts`,** `workflows-view`, in `VIEWS` in `recipes/order.ts`: after `rail`, before the extras. It puts `workflows`, a `column` with `gap: 8` and `resizable: false`, after `workspace` in the `views` stack: `workflows-bar`, a 46px `window_drag` block, and `workflows-body`, both `{ mod: "workflows", props: { role, repo, bun } }` with `role` `bar` and `body`. It puts `{ id: "workflows", label: "Workflows", icon: "route" }` after the Workspace in the rail's views, so it takes `ctrl-cmd-2`, or the next key after the views an extra puts in front. `repo` and `bun` come from the recipe context: the clone's folder and `process.execPath`.
- **`mods/workflows/`:** `main.js` draws the three roles (`bar`, `body`, `run`, the popup it opens on itself with `openOverlay({ mod: "workflows", kind: "dialog" })`); `logic.js` holds the statuses, the step rows, the popup's height, the run's arguments and the agents' first messages; `lib/workflow.js` validates the files and fills templates. Kit: `viewTile`, `pill`, `viewCard`, `cardHeader`, `menuItem`, `button`, `chip`, `timelineStep`, `stepCard`, `detailLine`, `heading`, `taskRow`, `emptyState`, `input`, `icon`, `toneColor`.
- **`herdr`:** `exec` (the workflow command, 30 s), `readTextFile`, `watchFolder`, `fs/promises` `readdir`, `terminals`, `spaces`, `focused`, `knownAgents`, `run` (`tab.new`, `pane.focus`), `openOverlay`, `closeOverlay`, `notify`, `theme`, `window`, `checking`, `props`.
- **It runs** `<bun> <repo>/scripts/workflow.ts` with `paths` (once, at start), `run`, `approve`, `reject`, `stop`, `resume` and `retry`. It reads `~/.config/vjr-herdr/workflows/*.json` and `~/.local/state/vjr-herdr/workflows/<run>/run.json`: the chosen workflow's last 20 runs and every other workflow's newest. It writes no file.

## Watch out

- The view learns its folders from `workflow paths`, since a mod reads no environment: `XDG_CONFIG_HOME` and `XDG_STATE_HOME` move them for the command, and the view follows.
- A popup's height is fixed when it opens: `runPopupHeight` counts the inputs and up to 6 spaces before `openOverlay`.
- A run's agents and runner are terminals labelled `nuoh.workflow=<run>` and `<run>:<step>`; the view tells a runner from an agent by the colon.
- The kit's `input` is one line: a long task is typed or pasted on one line.
- Approve and Reject go through the command, not `hc send` to the runner: `hc send` refuses a terminal that is `blocked`.
- The view needs `bun` where apply put it: after moving the clone or Bun, apply again.
- Not built: editing steps in the view, a schedule or other triggers, workflows kept in a repository, a worktree per run, steps side by side.

## Done when

- `bun run apply-layout` installs `nuoh-workflows`, the `workflows` view after `workspace` in `views`, and its tile on the rail with the next `ctrl-cmd-<n>`; `herdr-app status` lists no errors.
- With no file in the workflows folder, the view shows "No workflows yet", and `New workflow` opens a tab with an agent whose first message names `workflow format`.
- With `tests/fixtures/workflows/implement-review.json` in the folder, the list shows it with 6 steps and the timeline its six steps; `broken.json` shows its problems in red.
- `Run` on a workflow with a required input keeps `Run` dim until it is filled, then opens a new tab in the chosen space without leaving the view, and the run appears at the top of Runs.
- At a gate, the step reads "Needs you" with `Approve` and `Reject`; `Approve` moves the run on within seconds, and `Reject` stops it with "rejected at the gate".
- A run whose runner was closed reads Interrupted, and `Resume` starts it again in its tab.
