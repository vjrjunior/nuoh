# TODOS

## Layouts

### Confirm comeback after a real reboot

**What:** After the next restart of the Mac, open the window and confirm that each Claude Code that was running comes back on its conversation, that the toast lists them, and that `~/.claude/sessions/` matches the resumed sessions.

**Why:** The resume was tested by writing a note from another boot by hand. Only a real restart proves the boot check and the wait for recovered shells.

**Context:** Claudes running before `comeback` was installed have no note and won't come back. Check with `hc get <t> --json` that each running Claude has a `comeback` label before restarting.

**Effort:** S
**Priority:** P1
**Depends on:** The next restart

### Draw Mermaid diagrams in the Markdown viewer

**What:** Draw ` ```mermaid ` blocks as diagrams in `mods/markdown/` instead of showing their source.

**Why:** Plans and specs use Mermaid for flows, and the pane shows them as code.

**Context:** `TextView.markdown` shows a ` ```mermaid ` block as code. Drawing it needs a renderer in the mod that turns the diagram into an SVG under `data/<copy>/`, the only place `image()` loads from, cached by the block's text.

**Effort:** M
**Priority:** P3
**Depends on:** The Markdown viewer

### Show a space on another machine in Files

**What:** List the folders and the git state of a space on another machine in `mods/files/`, and open its files, as Herdr's own Files does.

**Why:** Files says `Files on <machine> isn't supported yet` for such a space, where Herdr's Files showed it.

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

### Show a file's type icon in the Markdown viewer and its picker

**What:** Draw the file's type icon in the Markdown viewer's header and on the rows of `Open Markdown…`, as Files does.

**Why:** Files shows a colored icon for every file; the viewer and the picker still show the kit's grey `file-text`, so a `README.md`, a `TODOS.md` and a `CLAUDE.md` look the same there.

**Context:** The icons, their table and `iconFor` live in `mods/files/` because only Files draws them. A second mod using them moves them into the kit (`kit/`, installed once in `vjr-kit`), with `fileIcon` reading `mods/${KIT.name}/file-icons/<icon>.svg`, and `scripts/file-icons.ts` writing there.

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

**What:** Give a file the icon of the language VS Code would detect for it where the name alone picks another, as a workflow YAML in `.github/workflows` gets the GitHub Actions icon.

**Why:** Files picks icons by name and extension only, so those files show the plain language's icon.

**Context:** Material Icon Theme's `languageIds` table maps VS Code's language ids to icons; the ids come from VS Code's language rules (extensions, file names, first lines), which aren't in the package. A handful of path patterns would cover the common cases.

**Effort:** M
**Priority:** P3
**Depends on:** Nothing

### Color code blocks and show the source in the Markdown viewer

**What:** Draw each fenced code block of `mods/markdown/` as a read-only code view with the theme's colors and a Copy button, and add a Formatted · Source switch to the header.

**Why:** Plans and specs carry code, and `TextView.markdown` draws it as plain text with no way to copy one block.

**Context:** Split the text at fences and draw the parts in a column: `TextView.markdown` for prose, `EditorState` + `Editor` for code, sized by line count since an editor doesn't size itself. `EditorState.new` can't run in `render`. Text can't then be selected across a code block.

**Effort:** M
**Priority:** P3
**Depends on:** Nothing

### Open a Markdown path with Cmd-click

**What:** Make Cmd-click on a `.md` path in a terminal open it in the Markdown viewer beside it.

**Why:** Cmd-click is what people try first, and it goes to macOS's app for `.md`.

**Context:** Herdr gives a mod no event for a link clicked in a terminal. The only way today is a small app that becomes macOS's default for `.md` and sends the file to Herdr while Herdr is in front, which changes a system setting; `cmd-shift-o` and `Open Markdown…` cover the case without it.

**Effort:** M
**Priority:** P3
**Depends on:** A terminal link event in Herdr's mod API

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

**Context:** `INSTALL.md` already lets an agent install the repo from a prompt, by cloning it and running `apply-layout`; a package would add herdr.dev's listing and a `cp` install. The build must drop the local `repo` and `bun` props of `vjr-sync`, and leave out anything that comes from the local config. Herdr's code is Apache-2.0, so a package with copies of it needs a `NOTICE`. `preview.png` needs a window with no private data, such as an isolated demo home.

**Effort:** M
**Priority:** P3
**Depends on:** Nothing

### A toast for a move cut off by a layout switch or restart

**What:** When a layout switch or an app restart cancels a Move tab in the middle, show a toast that gives the Claude's resume command.

**Why:** The worker's task is cancelled with the move, and the session id is lost with it, so a Claude that already ended gets no notice and no way back besides `/resume`.

**Context:** `mods/move-tab/move.js` keeps the ended Claudes in `run.ended`, in memory only. Writing each one to shared state or a terminal label before ending it would let the next copy of the worker find it and post the toast.

**Effort:** S
**Priority:** P2
**Depends on:** Nothing

### Scroll the selected row into view in the Move to popup

**What:** Make the arrow keys in the `Move to…` popup scroll the selected row into view when the list is longer than the popup.

**Why:** The selection moves past the bottom edge and the person can't see which row Enter will pick.

**Context:** `mods/move-tab/main.js` keeps the selection in `this.at` and draws the rows in an `overflow_y_scrollbar()` list. `ScrollHandle` from `gpui-base` does it: `ScrollHandle.new()` in `init`, `.track_scroll(handle)` on the list and `handle.scroll_to_item(this.at)` when the selection moves.

**Effort:** S
**Priority:** P3
**Depends on:** Nothing

### Check that a moved Claude runs before saying it moved

**What:** After a move builds the new tab, wait a moment for `terminals()` to show a live terminal whose argv or foreground argv holds `--resume <id>`, and only then post the success toast. When it doesn't show up, post an error toast with the resume command and a click action that resumes it, as a failed move does.

**Why:** The success toast is posted as soon as `herdr-app do` returns. If the resumed Claude then fails to start (a bad option, a missing `claude`), the old tab is already closed, the toast said it moved, and nothing on screen holds the session id: only Claude's `/resume` in the old folder finds the conversation.

**Context:** `mods/move-tab/move.js` posts the notice at the end of `move`. `runsSession` in `mods/move-tab/logic.js` already tells whether a terminal resumes a session, and `resumed` in `move.js` uses it when a launch throws. The wait should be short and bounded, like `PANE_WAIT`, and use `io.sleep` so the fake clock tests it.

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

### Move Move tab's popup onto the kit's popupRow

**What:** Draw the rows of Move tab's popup with `popupRow` from `kit/kit.js`, and drop its own row code.

**Why:** AGENTS.md puts a component in the kit as soon as a second mod draws the same thing. The Spaces folders popups brought `popupRow` into the kit; Move tab's popup still draws the same row by hand.

**Context:** `row` in `mods/move-tab/main.js` uses the kit's tokens (`CONTROL.large`, `RADIUS.control`, `TEXT.sm`) and marks the selected row with `selected`, which is `popupRow`'s `selected`. The popup has view tests that look the rows up by id.

**Effort:** S
**Priority:** P3
**Depends on:** Nothing

### Copy a step's text from the test panel

**What:** Give each line of a test panel step a way to copy it, so a command or a message the step asks to paste into a terminal can be taken from the panel itself.

**Why:** The panel's text can't be selected. The scheduled-move run asked the person to paste three messages into a Claude, and they had to come through the chat instead, which is what the panel exists to avoid.

**Context:** `tools/test-panel/main.js` draws each `step.do` line as plain text in an `h_flex`. A small copy icon button at the end of each line (the kit's `iconButton` with a copy icon in `kit/icons/`) could write it with `cx.write_to_clipboard(text)`, which the click handler's `cx` has. A run could also mark only the lines meant to be pasted, for example with a `"paste"` field next to `"do"`.

**Effort:** S
**Priority:** P2
**Depends on:** Nothing

### Group the Spaces tree's spaces by machine

**What:** Give the Spaces tree a header per machine once a space lives on another one, as Herdr's `spaces` has: the machine's name and state, its `+`, the `hc machine login <name>` line with Copy for one that needs a login, and Connect for one that was rebuilt.

**Why:** The tree lists a space on another machine as a loose row with nothing saying where it runs, and it reads no git for it. Someone who adds a machine loses what Herdr's own sidebar shows them.

**Context:** `current()` in `mods/spaces-tree/main.js` skips spaces whose `machine` is set, so they get no repository and no worktrees. Herdr's `mods/spaces/main.js` is the prior art: it reads `hc machine ls --json`, runs git with `exec(..., { on })`, groups rows by machine and keeps the folded machines in `localStorage`. Folders hold repositories by their git common dir, which is only unique per machine. It was left out of the audit follow-ups because no machine was set up to see it in the window.

**Effort:** L
**Priority:** P3
**Depends on:** A second machine in `hc machine ls` to check it against

### See the Spaces tree scroll to the active space in the window

**What:** With more spaces than the sidebar fits, switch to one below the fold by its key and watch the list bring it into view, with round and with square corners, wide and as the narrow rail.

**Why:** The scroll is covered by tests against a fake `ScrollHandle`. What `scroll_to_item` does with a folder card taller than the list was not seen: it could show the card's top while the active row sits below.

**Context:** `bringActive` in `mods/spaces-tree/main.js` reveals a direct child of the list, and a folder card is one child. The window had fewer spaces than the sidebar fits when this was built, so nothing scrolled. A test panel run with enough spaces open is the check.

**Effort:** S
**Priority:** P2
**Depends on:** Nothing

### Show Square corners in the Settings that Herdr's own mods open

**What:** Make every way into Settings open the layout's copy, which has the Square corners toggle, including the entries Herdr's mods open by themselves.

**Why:** A Herdr mod that calls `run("app.settings", { section })` directly, the machine login note in `spaces` for example, opens Herdr's own Settings. It has no toggle, so the person sees two Settings that differ.

**Context:** `recipes/look.ts` redirects the sidebar's gear in `workspace-chrome`, the palette's Settings entry and the key `global` binds to `app.settings` to `mod.open:vjr-settings`. `mod.open` takes no `section`, so a redirect of the other calls would also need a way to open the copy on a given section.

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

### Draw nuoh's panes and panels as cards

**What:** In `nuoh`, finish the Workspace view's look from the approved sketch: the sketch's pane header (42px, the program's tile, the title, the status chip, the folder, and the split and zoom buttons), a `surface` fill on the pane frame with a `veil` on the panes without focus, the side panels (Files, Changes, Graph and any an extra adds) as cards, and the panel buttons in one bordered group with `+` right after the tabs.

**Why:** The frame and the sidebar's Spaces and Agents cards are in; the panes and the panels are still `vjr-desk`'s.

**Context:** `recipes/cards.ts` (`nuoh-cards`) runs last in `nuoh` and draws the sidebar's cards; the panes and panels go there too. A node's `radius` doesn't clip its mod, so each card's mod paints no fill of its own and keeps its rows inset. Herdr 0.1.18's pane frame has only `header`, `background`, `shadow`, `border`, `focus`, `veil`, `radius`, `gap` and `lone`, and ignores any other field without an error: no field gives the terminal a well with an inset. A button an extra adds to the tab bar keeps its own look until the extra changes it.

**Effort:** L
**Priority:** P2
**Depends on:** nuoh's sidebar cards (part 2b) landing

### Show a waiting update on nuoh's Settings tile

**What:** Put the accent dot Herdr's sidebar footer draws on Settings when an app update is ready (`updates().app.ready`) on the rail's Settings tile.

**Why:** `nuoh` dropped the sidebar's footer, and with it the only sign in the window that an update waits for a restart.

**Context:** `mods/rail/main.js` draws the tiles; the Workspace badge shows how a dot sits on a tile. `updates` has to join the mocked `herdr` functions in `tests/app-mocks.ts`.

**Effort:** S
**Priority:** P3
**Depends on:** nothing

## Completed

### Reorder the Spaces folders by dragging

**Completed:** 2026-11-18. A folder's band drags onto another's: after it moving down, before it moving up, with the card faded and a 2px `accent` line on the card it lands next to. `moveFolder` in `mods/spaces-tree/folders.js` keeps a folder on its side of the pinned line, since folders and repositories can now be pinned too.

### Share Comeback's and Move tab's Claude helpers in one module

**Completed:** 2026-11-16. `lib/claude.js` and `lib/checkouts.js` hold the helpers, and `installLib` in `scripts/generate-layout.ts` copies each module a mod imports into the installed mod. Comeback's option list is the shared base; Move tab adds `--settings`, `--mcp-config` and `--plugin-dir`.

### Confirm the first real Herdr update

**Completed:** 2026-11-02, Herdr 0.1.11 to 0.1.12. `vjr-sync` rebuilt both layouts by itself in 3.4 s (`0.1.12 applied 3420ms` in `layout.log`). `built` and all 21 copies moved to 0.1.12, `herdr-app status` showed no errors, and the open window showed the new copies, Spaces tree included, with no further restart. The update changed `agents`, `files`, `new-menu`, `picker`, `spaces`, `workspace-chrome` and `frame/settings`, and every recipe still fit.
