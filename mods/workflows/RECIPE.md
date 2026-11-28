# Workflows

A view on the rail for the workflows in `~/.config/vjr-herdr/workflows/`: graphs of agent, command, condition and approval steps that `bun run workflow` runs ([`scripts/AGENTS.md`](../../scripts/AGENTS.md#workflows-workflowts)). It draws one as a canvas of nodes and connections that you build and change by hand, paints where its chosen run is on the nodes, and starts, approves, stops, resumes and retries runs. An agent can still write a new workflow, or change one, in a new tab.

![Workflows](preview.png)

## What you see

The view fills the views area from the window's top: a 46px band over the canvas, 8px apart.

- **The band,** left to right:
  - the kit's `viewTile` with the `route` icon;
  - a `pill` with the `list` icon, "All workflows · 2" and a chevron, which opens the switcher;
  - the workflow's title in 17px semibold, `accent` on hover;
  - with a run shown, its `runPill`: the status chip (Starting, Running, Needs you, Failed, Done, Stopped, Interrupted), "#3", where it is ("Waiting at ship", the step it runs, "at implement" when it failed, "cut off at implement", "in 2m" when done) and `Stop`, `Resume` or `Retry`; then a `terminal` icon button to the run's tab while its runner lives, and an `x` that hides the run;
  - at the right, `Edit with an agent` (ghost, `bot`; `Fix with an agent` for a file that can't be drawn), `Runs` (ghost, `tinted` while the drawer is open) and `Run workflow` (primary, dim while the file has problems). With no workflows, a `New workflow` pill instead.
- **The canvas,** a `viewCard` (`surface`, 14px corners, a `foreground` border at 7%) with a dot grid in `foreground` at 11%, 24px apart at 100% and never closer than 20px on screen.
- **Nodes,** 300px wide at 100%, everything in them scaled by the zoom:
  - a 16px label row over the card: the kind's icon (`play` start, `bot` agent and same agent, `terminal` command, `git-fork` condition, `flag` approval), the step's name in 11px medium `muted`, and at the right what the chosen run did there ("2s", "46s · 2×", "Needs you", "skipped", "stopped" where a stopped run ended, "cut off");
  - the card, `raised` with 10px corners and padding: a 1px `foreground` border at 8%, `accent` at 40% when selected, `working` with a spinning ring while it runs, `blocked` when it failed or waits for you, a `done` check in the label when done, the whole node at 50% when skipped;
  - **Start:** one line per input ("Task · required: Olá") and a primary `Run workflow`;
  - **Agent** and **Same agent:** the task in a three-row text field, the agent picker (the program's icon, its name or "Claude Code · implement" for a same-agent step, a chevron) with a 104px model field after it ("default" when empty), the answer's field names at the right, and `Run step`, or `Show agent` while its agent runs;
  - **Command:** the command in a one-line mono field, the "Goes on when it fails" check and `Run step`;
  - **Condition:** the expression in mono, then a Yes and a No row; once decided, the taken one is mint and reads "Yes · taken", the other at 50%;
  - **Approval:** the question and, when set, what to show; `Approve` (primary) and `Reject` (danger) while the run waits there;
  - under them, the result: RESULT (or ANSWER for typed fields, one row each) and its first three lines in `muted`, the error in `blocked`, "Working" or "Running the command" in `working` while it runs.
- **Ports,** 10px dots on the card's edges, 24px under its top: an input on the left (none on start) and an output on the right; a condition has a yes output and a no output on their rows. A connected port is `muted`; an unconnected one shows only while the pointer is on its node or the node is selected. While a connection is pulled, every input turns `accent`, the one under the pointer grows to 14px with a halo, and a refused one is a red ring.
- **Connections,** curves leaving and entering level, bending at least 48px: `dim` and dashed with no run; `done` at 60% once their source is done; `working`, dashed and pulsing, into a node that runs or waits; dim at 50% on the branch not taken; `accent` 2px when selected; `blocked` 2px while the pointer is on a node's Delete. A loop runs 56px under the lowest step it repeats and back up into its target, with a badge on it: "up to 3×", or "back 1 of 3" in a run.
- **The node toolbar,** 34px, centred 44px above the selected node: Answer fields (agent kinds only), Duplicate and Delete, red under the pointer.
- **The canvas bar,** centred at the bottom: Select (`V`), Hand (`H`), Search (`⌘F`) and a primary `Add node`.
- **The zoom bar,** bottom left: `−`, the percentage, `+`, Fit, Tidy and Minimap; the 200×128 minimap sits above it when on, the nodes as blocks in their state's color and the view as an `accent` frame.
- **Notices,** top left, up to 560px: the file's first problem in `blocked` ("(+2 more)"), a warning per risky agent flag or stranded step in `working`, "The file changed outside while you were editing." with `Keep mine` and `Take the file's`, and a failed save.
- **The Runs drawer,** 300px over the canvas's right side: the workflow's last 20 runs, newest first, as `taskRow`s with a ring in the status's color, "#4 · Needs you", the space and "5m ago · 2m"; the shown run is lit. Empty: "No runs yet".
- **Menus on the canvas:** Add node (a search field, then Steps: Agent, Same agent, Command, and Flow: Condition, Approval), the agent list (installed agents first, "not installed" on the others; for a same-agent step, the agent steps it can continue), Answer fields (a 320px popover with one mono line, "verdict: approve|changes, notes: text?", and Save), Find (a search field and up to eight matching steps), and a node's right-click menu (Run step, Run from here, Rename, Duplicate ⌘D, Delete ⌫; Run workflow on start).
- **No workflows:** an `emptyState` with "No workflows yet", `New workflow` (primary) and `Write one with an agent`. A file that isn't a graph (invalid JSON, the first format): "<name>.json can't be drawn", its first problem and `Fix with an agent`.
- **The switcher,** a 340px popup: one `menuItem` per workflow (the `route` icon, or `exclamation` for a file with problems; the last run's status dot; the title; "8 steps · Needs you"), then `New workflow` ("a blank canvas with a start") and `Write one with an agent`.
- **The run popup,** a 440px dialog: "Run <title>", "Run <title> from <step>" or "Run <step> alone", "Opens a new tab in the space you pick, without leaving this one.", an `input` per input under its label, "SPACE" over this machine's spaces (up to 6 rows, then it scrolls), the reason in `blocked` when the run can't start, and `Cancel` and `Run`.

## How it behaves

- **Moving around:** drag the empty canvas, scroll with two fingers, or drag anywhere with Hand to pan. Cmd-scroll (Ctrl-scroll), a pinch, `⌘=` and `⌘-` zoom around the pointer, from 25% to 200%. The first view of a workflow fits it (at most 100%, 64px margins); Fit, a click on the percentage and `⇧1` fit again. A click on the minimap centres the view there. Each workflow keeps its own view while the window is open.
- **Selecting and moving:** a click selects a node, and a click on a connection (within 14px) selects it. A drag moves a node once the pointer has gone 4px, and the drop snaps it to 8px. Tidy (`⇧T`) lays the graph out in columns by the longest path from start, 96px apart, with 48px between nodes, ordered to cross less, and fits it.
- **Building:** `Add node` adds the kind picked where nothing is, nearest the middle; a double-click on the empty canvas opens the same menu there. Pull from an output: onto an input or a card, it connects; into the open, it opens Add node there and connects the new node. Refused, with the reason by the pointer: "A node cannot connect to itself", "Already connected", "Nothing connects into start", "Pick yes or no". A connection back to a step before it is a loop: it gets "max": 3 and stays selected, and the badge's `−` and `+` change it from 1 to 20. A new node is selected with its first field focused. A same-agent step continues the nearest agent above it; a condition starts as `{{<source>.output}} set`.
- **Changing:** typing in a node's fields changes the step: the command splits like a shell line (quotes keep spaces), the model becomes `--model <x>` in the agent's argv, the check adds or drops `allowFail`. The agent picker sets the program; Answer fields checks each "name: type" (text, number, boolean or a|b|c, `?` when optional) and says what's wrong. A double-click on a node, or Rename, edits its name in place; Enter or leaving the field renames the step, its connections, the steps that continue it and the templates that name it. Delete and Backspace remove the selected node and its connections, or the selected connection; `⌘D` and the toolbar duplicate a node 32px down and right with a new name; start can't be deleted or duplicated.
- **Undo:** `⌘Z` and `⇧⌘Z` (or `⌘Y`) go through the last 100 changes; typing in one field is one change until another change comes. The canvas's keys work while the canvas has the keyboard, which a click on it gives; while a field has it, they are left to the field. Esc leaves the field, closes a menu, cancels a pull or clears the selection. Enter focuses the selected node's first field.
- **Saving:** 400ms after the last change, the file is written with `writeTextFile` and the text it had, keeping the format's key order and each `at` on one line. A file without places gets tidied ones, saved with the first change. A change from outside (an agent editing the file) is taken when nothing is pending, as a change you can undo; with something pending, the notice asks which to keep. A file with problems is still drawn and saved, but can't run.
- **Running:** `Run workflow` (band or start) opens the run popup; `Run` there runs `workflow run <name> --input k=v … --space <id> --json`, shows that workflow's new run and closes. `Run step` and `Run from here` save first, then run `workflow run <name> --only <step> --json` or `--from <step>`, reusing the last run's inputs and space; before any run they open the popup for them. `Approve` and `Reject` run `workflow approve|reject <run> --node <step>`; Stop, Resume and Retry run theirs. A button spins until the command answers; a failure posts an error toast with its message.
- **Which run shows:** the newest, until a row in the drawer picks another; a new run of the shown workflow becomes the shown one; the band's `x` hides the run until the next one. The band's "Waiting at ship" centres the canvas on that step. `Show agent` and the band's terminal button focus that pane, which brings the Workspace back, as the rail does.
- **Statuses:** a run reads its `run.json` status, except that one not over whose runner isn't among the live terminals reads Interrupted, and a run still `starting` after 30 s too; its running nodes then read "cut off". A run at a gate is also an agent for Herdr: its sound, toast and the rail's dot come from the runner.
- **Updates:** the view reads the files again when `watchFolder` reports a change in the workflows or runs folder, waiting 5 s before watching again when a watch fails; "5m ago" lines redraw every 30 s while the window is visible. `pane.go` can give the canvas the keyboard.

## Built from

- **`recipes/workflows.ts`,** `workflows-view`, in `VIEWS` in `recipes/order.ts`: after `rail`, before the extras. It puts `workflows`, a `column` with `gap: 8` and `resizable: false`, after `workspace` in the `views` stack: `workflows-bar`, a 46px `window_drag` block, and `workflows-body`, both `{ mod: "workflows", props: { role, repo, bun } }` with `role` `bar` and `body`. It puts `{ id: "workflows", label: "Workflows", icon: "route" }` after the Workspace in the rail's views, and binds `cmd-d` to `duplicate`, `cmd-=` and `cmd-+` to `zoom-in` and `cmd--` to `zoom-out` in `modKeys`, the `mod:nuoh-workflows` section of `keys.json`. `repo` and `bun` come from the recipe context: the clone's folder and `process.execPath`. `mod.json` is `{ "place": "none", "focusable": true }`.
- **`mods/workflows/`:**
  - `main.js`, the four roles: `bar` (the band), `body` (the canvas: the open workflow, its fields, the pointer, the keys, saving), `run` and `switcher`, the dialog and popup it opens on itself with `openOverlay({ mod: "workflows" })`;
  - `board.js`, the canvas's layers in order: grid, connections and loop badges (`window.paint_path` with a `PathBuilder` per look, built each render), nodes, ports, the node toolbar, notices, the bars and minimap, the drawer, the menus;
  - `canvas.js`, the geometry, pure: world and screen, zoom around a point, node heights, ports, curves, loop routes, hits on connections, fit, tidy, a free spot, the grid, the minimap;
  - `editor.js`, the edits, pure: add, move, connect with its refusals and loops, remove, duplicate, rename, fields, answer fields, history, the file's text;
  - `logic.js`, the statuses, each node's state and result, the pill, heights with results, the popups' heights, the run's arguments and the agents' first messages;
  - `lib/workflow.js` checks the graph, finds loops and the agent a step continues.
- **Kit:** `viewTile`, `pill`, `runPill`, `iconButton`, `button`, `input`, `viewCard`, `emptyState`, `menuItem`, `heading`, `taskRow`, `toneColor`, `icon`, and the canvas parts `nodeShell`, `nodeField`, `textareaField`, `nodeResult`, `nodeButton`, `nodeCheck`, `branchRow`, `agentPicker`, `port`, `edgeLook`, `edgeBadge`, `refusal`, `nodeToolbar`, `canvasBar`, `zoomBar`, `minimap`, `addNodeMenu`.
- **`herdr`:** `exec` (the workflow command, 30 s), `readTextFile`, `writeTextFile`, `watchFolder`, `fs/promises` `readdir`, `terminals`, `spaces`, `focused`, `knownAgents`, `run` (`tab.new`, `pane.focus`), `openOverlay`, `closeOverlay`, `notify`, `theme`, `settings` (the zoom), `shared` and `setShared` (`workflows.view`: the workflow, the run, the drawer, the step to centre), `nextCommand`, `window`, `checking`, `props`, and `localStorage` for the minimap's switch.
- **It runs** `<bun> <repo>/scripts/workflow.ts` with `paths` (once, at start), `run`, `approve`, `reject`, `stop`, `resume` and `retry`. It reads and writes `~/.config/vjr-herdr/workflows/*.json`, and reads `~/.local/state/vjr-herdr/workflows/<run>/run.json`: the shown workflow's last 20 runs and every other workflow's newest.

## Watch out

- `child(null)` throws in Herdr: a layer that draws nothing returns `null`, and the canvas filters them out. `structuredClone` doesn't exist there; copies go through JSON.
- Pointer, wheel and size come in window pixels: divide by `settings().zoom` before they meet the canvas's own units. The canvas's origin comes from the `bounds` of its own pointer events.
- Text states are made when a workflow opens or changes, in events and tasks, never in `render`, one per field, and released when their node goes; a field that echoes the value it was set to changes nothing.
- One view draws the whole canvas: a render of 30 nodes takes about 3 ms, so a drag redraws everything at pointer speed without help from subviews.
- The band and the canvas are two copies of the mod. They share what's shown through `workflows.view`; the band renames the title by writing the file itself, and the canvas takes that change like any other from outside.
- Herdr binds `cmd-d` (split right), `cmd-=`, `cmd-+` and `cmd--` (the app's zoom) globally, and a global key never reaches a mod's `on_key_down`: the canvas gets them as its own commands from the `mod:nuoh-workflows` section, which wins only while the canvas has the keyboard.
- Approve and Reject go through the command, not `hc send` to the runner: `hc send` refuses a terminal that is `blocked`.
- A popup's height is fixed when it opens: the run popup counts the inputs and up to 6 spaces, the switcher up to 8 workflows.
- The view learns its folders from `workflow paths`, since a mod reads no environment. It needs `bun` where apply put it: after moving the clone or Bun, apply again.
- Not built: triggers and outputs, selecting several nodes, groups, alignment guides, animated camera moves, a history of results, `{{field}}` chips in text, notes and shapes, templates and versions, typed ports ([`TODOS.md`](../../TODOS.md#workflows)).

## Done when

- `bun run apply-layout` installs `nuoh-workflows`, the `workflows` view after `workspace` in `views`, and its tile on the rail; `herdr-app status` lists no errors.
- With no file in the workflows folder, the canvas shows "No workflows yet"; `New workflow` writes `new-workflow.json` with a start node and shows it.
- `tests/fixtures/workflows/implement-review.json` draws eight nodes and eight connections, with the loop from fix to test under the steps it repeats and "up to 3×" on it.
- Pulling from an output into the open and picking Agent adds a connected agent node; pulling it onto itself reads "A node cannot connect to itself" and adds nothing; the file changes within half a second, and `⌘Z` undoes it.
- A run with two independent agents runs both at once, and their nodes ring `working` together.
- At a gate, the node reads "Needs you" with `Approve` and `Reject`; `Approve` moves the run on within seconds.
- A run whose runner was closed reads Interrupted, and `Resume` in the band starts it again.
