# TODOS

## Markdown

### Open a Markdown path with Cmd-click

**What:** Make Cmd-click on a `.md` path in a terminal open it in the Markdown viewer beside that terminal.

**Why:** Cmd-click is what people try first, and it goes to macOS's app for `.md`.

**Context:** Herdr 0.1.18 has terminal link handlers (guide › Mods › Terminal link handlers): `link_handlers` in `mods/markdown/mod.json` with a file rule such as `(?i)\\.(md|markdown)$`, and a `link.js` that exports `handleLink({ link, source })`, opens `link.path` with `openMarkdown` from `lib/open-markdown.js` beside `source.pane`, and returns `"handled"`, or `"pass"` when `link.path` is null (a remote or unresolved path). Herdr adds a mod with link rules to a personal layout's root `link_handlers` the first time it sees it, and the next `apply-layout` would drop that edit, so the `markdown` recipe sets the list itself. The generator already copies every `.js` of a repo mod, but `rewireLayout` in `scripts/generate-layout.ts` prefixes only `mod` and `terminal_menu`, so it has to prefix the names in `link_handlers` too. `herdr-app check` verifies that `link.js` exports `handleLink`. `link.line` could later scroll the viewer to the line.

**Effort:** S
**Priority:** P2
**Depends on:** Nothing

### Review a plan in the Markdown viewer and hand back the diff

**What:** First, a Source mode in `mods/markdown/` that saves with `writeTextFile(path, text, expected)` and shows a conflict bar (`Keep mine`, `Take the file's`) when the file changed on disk. Then a script an agent runs in the background: it opens a file in the viewer with a **Done** button and, on the click, prints the `diff -u` of what the person changed, which the agent reads as comments.

**Why:** Plans wait in `docs/` and are approved in the chat. Editing the plan where it shows and handing the diff back keeps the review on the file.

**Context:** The viewer reads with `readTextFile` and watches the folder with `watchFolder`; `EditorState` with `language: "markdown"` is the editor (guide › UI). The script reaches the window with `herdr-app do`. Editing block by block and tables as a grid come later.

**Effort:** M, then L
**Priority:** P3
**Depends on:** Nothing

### Color code blocks and show the source in the Markdown viewer

**What:** Draw each fenced code block of `mods/markdown/` as a read-only code view with the theme's colors and a Copy button, and add a Formatted · Source switch to the header.

**Why:** Plans and specs carry code, and `TextView.markdown` draws it as plain text with no way to copy one block.

**Context:** Split the text at fences and draw the parts in a column: `TextView.markdown` for prose, `EditorState` + `Editor` for code, sized by line count since an editor doesn't size itself. `EditorState.new` can't run in `render`. Text can't then be selected across a code block.

**Effort:** M
**Priority:** P3
**Depends on:** Nothing

### Draw Mermaid diagrams in the Markdown viewer

**What:** Draw ` ```mermaid ` blocks as diagrams in `mods/markdown/` instead of showing their source.

**Why:** Plans and specs use Mermaid for flows, and the pane shows them as code.

**Context:** `TextView.markdown` shows a ` ```mermaid ` block as code. Drawing it needs a renderer in the mod that turns the diagram into an SVG under `data/<copy>/`, the only place `image()` loads from, cached by the block's text.

**Effort:** M
**Priority:** P3
**Depends on:** Nothing

### Show a file's type icon in the Markdown viewer and its picker

**What:** Draw the file's type icon in the Markdown viewer's header and on the rows of `Open Markdown…`, as Files does.

**Why:** Files shows a colored icon for every file; the picker still shows the kit's grey `file-text`, so a `README.md`, a `TODOS.md` and a `CLAUDE.md` look the same there.

**Context:** The icons, their table and `iconFor` live in `mods/files/` because only Files draws them. A second mod using them moves them into the kit (`kit/`, installed once in `nuoh-kit`), with `fileIcon` reading `mods/${KIT.name}/file-icons/<icon>.svg`, and `scripts/file-icons.ts` writing there.

**Effort:** S
**Priority:** P3
**Depends on:** Nothing

## Files

### Show a space on another machine in Files

**What:** List the folders and the git state of a space on another machine in `mods/files/`, and open its files, as Herdr's own Files does.

**Why:** Files says `Files on <machine> isn't supported yet` for such a space, where Herdr's Files shows it.

**Context:** `exec`, `readTextFile` and `hc` take `{ on: space.machine }`. `watchFolder` is local only, so a remote tree needs the 10-second timer alone. A Markdown file there needs the viewer to read with `on` too (`props.on`). No machine is set up here to check it against.

**Effort:** M
**Priority:** P3
**Depends on:** A second machine in `hc machine ls`

### Change files from Files

**What:** New file, New folder, Rename, Duplicate and Move to Trash in the Files row menu, and dragging a row onto a folder to move it.

**Why:** Files only reads; changing a file means a terminal or another app.

**Context:** `mods/files/menu.js` lists the items from `menuItems` in `logic.js`. A name needs a field in the mod's own popup (Herdr's `prompt` can't hand text back to a mod). Moving to the Trash on macOS is `osascript`, or `trash` where installed.

**Effort:** M
**Priority:** P3
**Depends on:** Nothing

### Search inside files from Files

**What:** A second mode for the Files filter that lists the lines holding the text, under each file, and opens a Markdown file or the code view at that line.

**Why:** The filter finds names only.

**Context:** `git grep -n -I --untracked` in a repository, bounded like the name list (`MATCHES`). The code view has no way to scroll to a line from a mod yet; the row could open the file and show the line number.

**Effort:** M
**Priority:** P3
**Depends on:** Nothing

### Move through the Files tree with the keyboard

**What:** ↑ ↓ to move a selection in the tree, → and ← to open and close folders, Enter to open a file, with `"focusable": true` so `pane.go` reaches the panel.

**Why:** The tree only takes clicks; only the filter's results take keys.

**Context:** `mods/files/main.js` keeps `selected` for the last clicked row. The guide's `focusable` mods get `"focus"` from `nextCommand()`; scrolling the selection into view needs a `ScrollHandle` on the tree.

**Effort:** S
**Priority:** P3
**Depends on:** Nothing

### Hide system clutter in the Files tree

**What:** Leave `.DS_Store` and similar files the system writes out of the Files tree and its filter.

**Why:** They show up in every folder Finder has opened, with no use in the panel.

**Context:** `LIST` in `mods/files/logic.js` prints every entry but `.git`; a short list of names to skip there (and in `ALL_FILES`' `find` outside a repository) is enough. A repository's `.gitignore` usually ignores them already, so they show dimmed.

**Effort:** S
**Priority:** P3
**Depends on:** Nothing

### Pick Files' icon by the language of a file

**What:** Give a file the icon of the language an editor would detect for it where the name alone picks another, as a workflow YAML in `.github/workflows` gets the GitHub Actions icon.

**Why:** Files picks icons by name and extension only, so those files show the plain language's icon.

**Context:** The icon package's `languageIds` table maps language ids to icons; the ids come from an editor's language rules (extensions, file names, first lines), which aren't in the package. A handful of path patterns would cover the common cases.

**Effort:** M
**Priority:** P3
**Depends on:** Nothing

## Move tab

### Check that a moved Claude runs before saying it moved

**What:** After a move builds the new tab, wait a moment for `terminals()` to show a live terminal whose argv or foreground argv holds `--resume <id>`, and only then post the success toast. When it doesn't show up, post an error toast with the resume command and a click action that resumes it, as a failed move does.

**Why:** The success toast is posted as soon as `herdr-app do` returns. If the resumed Claude then fails to start (a bad option, a missing `claude`), the old tab is already closed, the toast said it moved, and nothing on screen holds the session id: only Claude's `/resume` in the old folder finds the conversation.

**Context:** `mods/move-tab/move.js` posts the notice at the end of `move`. `runsSession` in `mods/move-tab/logic.js` already tells whether a terminal resumes a session, and `resumed` in `move.js` uses it when a launch throws. The wait should be short and bounded, like `PANE_WAIT`, and use `io.sleep` so the fake clock tests it.

**Effort:** S
**Priority:** P2
**Depends on:** Nothing

### A toast for a move cut off by a layout switch or restart

**What:** When a layout switch or an app restart cancels a Move tab in the middle, show a toast that gives the Claude's resume command.

**Why:** The worker's task is cancelled with the move, and the session id is lost with it, so a Claude that already ended gets no notice and no way back besides `/resume`.

**Context:** `mods/move-tab/move.js` keeps the ended Claudes in `run.ended`, in memory only. Writing each one to shared state or a terminal label before ending it would let the next copy of the worker find it and post the toast.

**Effort:** S
**Priority:** P2
**Depends on:** Nothing

### Clean up the space a failed move opened

**What:** When a move opened a space with `space.new` and the build then fails, close that space (or say in the error toast that it was left behind).

**Why:** `space.new` runs only after every Claude has ended. A failure after it leaves a new space holding Herdr's first shell tab, which the person didn't ask for and has to close by hand.

**Context:** `mods/move-tab/move.js` keeps the new space in `into` and its first tab in `extra`, and closes `extra` only after the build. Closing the space in the failure path must not touch a space the move didn't open, nor one where a Claude was started or may have started (`run.started`, `run.unsure`), since closing it would end that Claude.

**Effort:** S
**Priority:** P3
**Depends on:** Nothing

### Scroll the selected row into view in the Move to popup

**What:** Make the arrow keys in the `Move to…` popup scroll the selected row into view when the list is longer than the popup.

**Why:** The selection moves past the bottom edge and the person can't see which row Enter will pick.

**Context:** `mods/move-tab/main.js` keeps the selection in `this.at` and draws the rows in an `overflow_y_scrollbar()` list. `ScrollHandle` from `gpui-base` does it: `ScrollHandle.new()` in `init`, `.track_scroll(handle)` on the list and `handle.scroll_to_item(this.at)` when the selection moves.

**Effort:** S
**Priority:** P3
**Depends on:** Nothing

### Move Move tab's popup onto the kit's popupRow

**What:** Draw the rows of Move tab's popup with `popupRow` from `kit/kit.js`, and drop its own row code.

**Why:** A component goes in the kit as soon as a second mod draws the same thing. The Spaces folders popups brought `popupRow` into the kit; Move tab's popup still draws the same row by hand.

**Context:** `row` in `mods/move-tab/main.js` uses the kit's tokens (`CONTROL.large`, `RADIUS.control`, `TEXT.sm`) and marks the selected row with `selected`, which is `popupRow`'s `selected`. The popup has view tests that look the rows up by id.

**Effort:** S
**Priority:** P3
**Depends on:** Nothing

### Share what Comeback and Move tab both work out about a Claude

**What:** Move into `lib/claude.js` the two things both mods compute by themselves: whether Claude is the program in front of a terminal, and where a session's file and transcript are.

**Why:** A fix to one copy can miss the other, as the option list and the session parser could before they moved to `lib/`.

**Context:** `judge` in `mods/comeback/logic.js` and `atShell`/`isClaude` in `mods/move-tab/logic.js` answer the first, with different inputs (`terminal.app` against `info.status.app`) and a different answer when no program is in front, so the shared function has to take both shapes and keep each caller's behaviour. `mods/comeback/main.js` and `mods/move-tab/io.js` each build the session path and look the transcript up. The shared keys `move-tab.drag` and `move-tab.request` are also written out in `mods/spaces-tree/actions.js`, `mods/move-tab/main.js` and `recipes/move-tab.ts`.

**Effort:** S
**Priority:** P3
**Depends on:** Nothing

## Spaces

### Mark merged and local-only worktrees, and clean up the merged ones

**What:** In the Spaces tree, mark the worktrees already merged, squash merges included (`git merge-tree` against the default branch), and the local-only ones (no upstream, with commits of their own). A `Clean up merged` entry in a repository's menu removes only what loses nothing, confirmed by a second click.

**Why:** Worktrees pile up and are removed one at a time, with nothing saying which are safe to drop.

**Context:** `mods/spaces-tree/tree.js` already reads ahead and behind from `git for-each-ref`. Removing a worktree that another space still shows deletes the folder under both, so look for other spaces on the checkout first. The second-click button goes in the kit, since `Delete folder` would use it too. Runs `git merge-tree`, `git rev-list` and `git worktree remove`.

**Effort:** M
**Priority:** P3
**Depends on:** Nothing

### Link the main checkout's ignored folders into a new worktree

**What:** After a worktree is made, link `node_modules` and each folder listed in the main checkout's `.worktreelinks` into it, only when the folder exists, the path is free and git ignores the path as a file; remove the links before Remove worktree. For Herdr's New worktree (a recipe over a copy of `worktree`) and the worktree step of `/herdr-feature`.

**Why:** A new worktree starts without the main checkout's ignored folders: `docs/` exists only there, which is why plans are read by absolute path.

**Context:** `.gitignore` has `docs/`, which doesn't ignore a symlink (git sees it as a file), so it would become `/docs`. If this lands, the rule in `AGENTS.md` › Worktrees about `docs/` by absolute path changes with it. Runs `ln -s` and `git check-ignore`.

**Effort:** M
**Priority:** P3
**Depends on:** Nothing

### Group the Spaces tree's spaces by machine

**What:** Give the Spaces tree a header per machine once a space lives on another one, as Herdr's `spaces` has: the machine's name and state, its `+`, the `hc machine login <name>` line with Copy for one that needs a login, and Connect for one that was rebuilt.

**Why:** The tree lists a space on another machine as a loose row with nothing saying where it runs, and it reads no git for it. Someone who adds a machine loses what Herdr's own sidebar shows them.

**Context:** `current()` in `mods/spaces-tree/main.js` skips spaces whose `machine` is set, so they get no repository and no worktrees. Herdr's `mods/spaces/main.js` is the prior art: it reads `hc machine ls --json`, runs git with `exec(..., { on })`, groups rows by machine and keeps the folded machines in `localStorage`. Folders hold repositories by their git common dir, which is only unique per machine.

**Effort:** L
**Priority:** P3
**Depends on:** A second machine in `hc machine ls` to check it against

## Agents

### A key for the next agent that waits on you

**What:** A key in `layout:nuoh` that focuses the next agent waiting on the person, in any space: blocked ones first, then done ones nobody has seen, the oldest first. With nobody waiting, a toast says `Nobody is waiting`.

**Why:** `agent.next` follows the Agents list's order, not urgency, so reaching the agent that waits means reading the list.

**Context:** `mods/agent-list/` already ranks by urgency and stamps when each state began (`arrange`, `since`, `needsYou`). A `<mod>.<command>` key reaches shown copies only, and the Agents list is hidden while another view shows, so the command belongs in the rail, which always shows; `pane.focus {pane}` moves the focus, and the rail then brings the Workspace back by itself.

**Effort:** S
**Priority:** P2
**Depends on:** Nothing

### Show what each agent is doing, and mark one that is stuck

**What:** Show in each Agents row what the agent is doing now (the tool it runs), and mark one stuck on the same step: its time in `dim` after 3 minutes, in `blocked` after 15.

**Why:** A row says an agent works, not on what, and a stuck agent looks like a busy one.

**Context:** `mods/agent-list/main.js` already stamps each change of state (`since`, kept in `localStorage`) and draws the time with `ago`; the second line is `agentTitle` from `lib/agent-title.js`. The top-10 review in the main checkout's `docs/archive/research/herdr-top10.md` says Claude Code puts the running tool in its OSC 7501 report. On 0.1.18, `hc get <t> --json` shows `status` and `records` (`app`, `state`, `title`) and no such message, so check what `terminals()` gives in `report` before building.

**Effort:** M
**Priority:** P2
**Depends on:** A status report that says what the agent runs

### Offer to continue a Claude stopped by its usage limit or a provider error

**What:** When a Claude turns idle or done, read its screen once. On a usage-limit message, mark the agent as out of quota until the time it gives and offer `Continue at <time>` in a toast; on `Overloaded` or `API Error`, the same offer as a provider error. With the click, or a label the person put on the terminal, the mod types `continue` at that time. Nothing is sent otherwise.

**Why:** A Claude that hit its limit at night sits idle until someone looks, and none of this repo's mods notice.

**Context:** `hc read <t>` only on the change of state, and `hc send --if idle` to type at the time (`hc --help`). The messages' exact text needs a recorded screen for the tests. The reason could fill the second line of the item above.

**Effort:** M
**Priority:** P2
**Depends on:** A recorded screen of each message

### Copy a Claude's session, or fork it, from the terminal menu

**What:** In a Claude's right-click menu, `Copy session ID`, `Copy resume command` (`cd <folder> && claude --resume <id>` with its options) and `Fork into new tab` (`--fork-session` in a new tab, in the same folder).

**Why:** Getting a conversation's id, or resuming it elsewhere, means finding it in `~/.claude/sessions/` by hand.

**Context:** The copy of `menu` is already patched by `spaces-tree`, `markdown` and `move-tab`. `lib/claude.js` holds `parseSession`, `keepOptions` and `resumeCommand`, shared by Comeback and Move tab, and both already read `~/.claude/sessions/<pid>.json`.

**Effort:** S
**Priority:** P3
**Depends on:** Nothing

### Review a worktree with another agent

**What:** `Review with…` in a tab's menu opens a tab in the same worktree that runs another agent from `knownAgents()`, its first message written: `Review the diff of <branch> against <base>`.

**Why:** Asking a second agent for a review means opening a tab, starting it and typing the request by hand.

**Context:** `tab.new {space, folder, argv: agent.run, task}` starts it (guide › Commands). The copy of `menu`'s tab case already holds `Move to…`. The rounds of review stay with the person.

**Effort:** S
**Priority:** P3
**Depends on:** Nothing

## Ports

### List the ports that listen, with the pane that runs each

**What:** A panel that lists who listens on a TCP port, with its folder, its age and the pane that runs it (found through the shell's process tree), an orphan as `No pane runs it`, and Stop: SIGTERM on a second click, SIGKILL after.

**Why:** A dev server left running holds its port, and finding which pane started it means `lsof` and `ps` by hand.

**Context:** Runs `lsof`, `ps` and `kill`, polling only while the panel shows. A panel goes in `panel-body` with a button in the tab bar, as `git-graph-panel` adds Graph.

**Effort:** M
**Priority:** P3
**Depends on:** Nothing

## nuoh frame

### Inset nuoh's terminal well

**What:** Draw the sketch's terminal well in `nuoh`'s panes: the terminal 6px inside the card under the header, with 10px corners and a `#FFFFFF0A` line, faded to 0.6 without focus.

**Why:** Herdr 0.1.18's pane frame has no inset, so the terminal runs from the header to the card's line, square at the bottom where the card is round.

**Context:** `recipes/cards.ts` (`nuoh-cards`) sets the pane frame; `mods/pane-header/RECIPE.md` › Watch out says what the frame can't do. The guide's frame has `gap`, `radius`, `background`, `border`, `focus`, `veil`, `header` and `lone`; it ignores any other field without an error, and doesn't clip the terminal to its `radius`. Check each Herdr release's guide for an inset or padding on the pane frame.

**Effort:** S
**Priority:** P3
**Depends on:** A pane frame field in Herdr that insets the terminal

### Show a waiting update on nuoh's Settings tile

**What:** Put the accent dot Herdr's sidebar footer draws on Settings when an app update is ready (`updates().app.ready`) on the rail's Settings tile.

**Why:** `nuoh` dropped the sidebar's footer, and with it the only sign in the window that an update waits for a restart.

**Context:** `mods/rail/main.js` draws the tiles; the Workspace badge shows how a dot sits on a tile. `updates` is already among the mocked `herdr` functions in `tests/app-mocks.ts`.

**Effort:** S
**Priority:** P3
**Depends on:** Nothing

## Performance

### Give the idle window a budget of programs run

**What:** A test that counts the `exec` and `notify` calls the Spaces tree and Comeback make while nothing changes, against a budget each must stay under. Then, if Git Graph turns out to cost, mount it only while its panel shows, from a recipe, without changing Git Graph.

**Why:** Several items here add reads (agents' screens, merged worktrees, ports), and without a budget nobody sees the cost add up.

**Context:** `tests/app-mocks.ts` mocks `exec` and `notify`. The Spaces tree ticks every 250 ms (`mods/spaces-tree/main.js`), and Git Graph refreshes and warms its repositories every 15 s even with its panel closed (the `cx.timer.every(15000, …)` in `mods/git-graph/graph.js`).

**Effort:** S, then M
**Priority:** P2
**Depends on:** Nothing

## Test panel

### Copy a step's text from the test panel

**What:** Give each line of a test panel step a way to copy it, so a command or a message the step asks to paste into a terminal can be taken from the panel itself.

**Why:** The panel's text can't be selected. The scheduled-move run asked the person to paste three messages into a Claude, and they had to come through the chat instead, which is what the panel exists to avoid.

**Context:** `tools/test-panel/main.js` draws each `step.do` line as plain text in an `h_flex`. A small copy icon button at the end of each line (the kit's `iconButton` with `copy` from `kit/icons/`) could write it with `cx.write_to_clipboard(text)`, which the click handler's `cx` has. A run could also mark only the lines meant to be pasted, for example with a `"paste"` field next to `"do"`.

**Effort:** S
**Priority:** P2
**Depends on:** Nothing

## Verify

### Confirm comeback after a real reboot

**What:** Ready to check: the Mac restarted on 2026-11-26. Confirm that each Claude Code that was running came back on its conversation, that the toast listed them, and that `~/.claude/sessions/` matches the resumed sessions.

**Why:** The resume was tested by writing a note from another boot by hand. Only a real restart proves the boot check and the wait for recovered shells.

**Context:** Claudes running before `comeback` was installed have no note and won't come back. `hc get <t> --json` shows each terminal's `comeback` label, whose `boot` should now be the new boot's.

**Effort:** S
**Priority:** P1
**Depends on:** Nothing

### See the Spaces tree scroll to the active space in the window

**What:** With more spaces than the sidebar fits, switch to one below the fold by its key and watch the list bring it into view, wide and as the narrow rail.

**Why:** The scroll is covered by tests against a fake `ScrollHandle`. What `scroll_to_item` does with a folder card taller than the list was not seen: it could show the card's top while the active row sits below.

**Context:** `bringActive` in `mods/spaces-tree/main.js` reveals a direct child of the list, and a folder card is one child. The window had fewer spaces than the sidebar fits when this was built, so nothing scrolled. A test panel run with enough spaces open is the check.

**Effort:** S
**Priority:** P2
**Depends on:** Nothing

## Previews

### A preview template, then a preview.png for each mod

**What:** Design one preview frame in the OpenPencil sketch, with the app's name and a fixed size, and take each mod's `preview.png` in it.

**Why:** Every `mods/<mod>/RECIPE.md` opens with `![Name](preview.png)`, as Herdr's format asks, but no mod has the image yet, so the link is broken in all nine.

**Context:** The sketch is `docs/sketches/herdr-ui.fig` in the main checkout, with a "Design system" page. A `herdr-app shot` captures the whole window, so each preview needs a crop or a window that shows only that mod, without private data. `.gitignore` already lets `preview.png` in.

**Effort:** M
**Priority:** P2
**Depends on:** Nothing

## Publish

### Publish comeback on herdr.dev

**What:** Publish `mods/comeback/` as a community mod: a public repo or folder in Herdr's format with `mods/comeback/`, its `RECIPE.md` and a `preview.png`, and the `herdr-mod` topic.

**Why:** The other resume mods need hooks or only run on Linux; this one is a folder and two helper files.

**Context:** `RECIPE.md` is written. The mod imports `lib/claude.js` and `lib/checkouts.js`, so the package needs them copied in and the imports changed to `./`, as `apply-layout` does. Missing: `preview.png` (a window with a resumed conversation and the toast, no private data) and the package folder. The install step asks people to add a floating block to a cloned layout.

**Effort:** S
**Priority:** P3
**Depends on:** Nothing

### Publish on herdr.dev

**What:** Add a command that writes one build into a package folder in Herdr's format, and publish it with the `herdr-layout` topic.

**Why:** The repo follows the community's conventions, but its mods are generated on the machine, so it can't be installed with `cp`.

**Context:** `INSTALL.md` already lets an agent install the repo from a prompt, by cloning it and running `apply-layout`; a package would add herdr.dev's listing and a `cp` install. The build must drop the local `repo` and `bun` props of `nuoh-sync`, and leave out anything that comes from the local config. Herdr's code is Apache-2.0, so a package with copies of it needs a `NOTICE`. `preview.png` needs a window with no private data, such as an isolated demo home.

**Effort:** M
**Priority:** P3
**Depends on:** Nothing
