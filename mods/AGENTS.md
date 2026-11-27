# mods/

Each folder is one of this repo's mods, the source of a `nuoh-<name>` copy; the folders in `~/.config/herdr-app/mods/nuoh-*` are generated from it by `bun run apply-layout`. How a mod gets into the layout is in [`recipes/AGENTS.md`](../recipes/AGENTS.md), how it draws in [`kit/AGENTS.md`](../kit/AGENTS.md), shared code in [`lib/AGENTS.md`](../lib/AGENTS.md), its tests in [`tests/AGENTS.md`](../tests/AGENTS.md). Herdr's guide covers `cx`, timers, animation and the API; these are what it leaves out.

- Pure logic goes in `logic.js` (no `herdr` import), the view in `main.js`. Side effects a test must fake go through an object handed in, as `mods/move-tab/io.js` does for the mover.
- The generator installs a mod's `.js` and `.sh` files, `mod.json`, `LICENSE` and `icons/*.svg`, plus `kit.js` and the `lib/` modules it imports, nothing else.

## Props and checks

- `herdr-app check` loads a mod with `props()` null and `checking()` true: read `props() ?? {}` and return from `init` before starting work, as `mods/sync/main.js` does.
- `init`'s first argument can carry only part of an overlay's props. Read `{ ...(props() ?? {}), ...given }` before choosing a role, as Files, the Agents list and Move tab do; a popup that misses its role draws the whole mod.
- A mod that opens itself as a popup picks what to draw from a prop (`role`, `sortMenu`) and starts no timer, git read or command loop there.

## Herdr's API as it behaves

- `close(cx)` is Herdr's: it runs when the pane, block or overlay goes. Give your own method another name; a popup closes itself with `closeOverlay(props().overlay)`.
- `run()` returns `null` in a mod. To use what a command made (a space, a tab, a terminal), run `exec("herdr-app", ["do", name, JSON.stringify(args)])` and parse its output, as `mods/move-tab/io.js` does.
- `nextCommand()` gives only the command's name, and Herdr's `prompt` runs `run(command.name, { ...command.args, name })`. To hand a mod data, write a shared key first (`markdown.request`, then `nuoh-markdown.show`), or draw the input in the mod's own popup, as the Spaces tree's folder popups do.
- `<mod>.<command>` reaches shown copies only. A floating block that renders an empty `div()` counts as shown.
- `setShared` redraws every mod. Never call it from `render` or a hover: publish real changes, from an event or a timer.
- `exec` gives up after 30 s unless it gets a `timeout`; `nuoh-sync` gives the rebuild 120 s, and runs `bun` by the absolute path apply put in its props.
- `cx.spawn` calls its body at once, up to the first `await`: don't reach state that `init` hasn't built yet.
- `pane.split` takes no folder: focus the pane, then `terminal.open {place, folder}`.
- `space.new` without `folder` starts where the focused terminal is, so from a worktree it opens a second space on the same checkout. Pass `folder` (and the machine), and look for other spaces on a checkout before `git worktree remove`.
- `fs/promises` has `readdir`, `exists`, `readFile`, `writeFile`, `mkdir`, `unlink` and `rmdir`, but no `stat`; inside a `try`, a `stat` call looks like a missing file.
- The runtime has no `TextEncoder` (`encodeURIComponent` gives UTF-8 bytes), and `toLocaleDateString` ignores its options.
- Writing a mod's own `mod.json` reloads the mod.

## Drawing

- `.line_height(14)` multiplies the font size; pass `"14px"`.
- A popup's height is fixed when it opens, so work out its rows first. A popup at the top is as tall as what it draws, up to that height: a list in it gets its own height (the Markdown picker's 320px), not `flex_1()`.
- `ScrollHandle.scroll_to_item` reveals a direct child of the scroll area, so a card that holds several rows scrolls into view as one.
- Make an `EditorState` when its text arrives, not in `render`, and release it when the view leaves it, as Files' code view does.

## The pointer

- A right-click also fires `on_click`, whose event has no button. When the click would undo what the menu is for (opening a file), note the right press's time and ignore a click right after it (`RIGHT_CLICK_MS` in `mods/files/main.js`).
- A drag is `on_mouse_down` on the source and `on_mouse_move` and `on_mouse_up("left")` on each target. Reset it in the list's own `on_mouse_up`, which runs after the target's, and forget it in `on_mouse_down_out`, which runs in the capture phase, before or after a new press sets a drag; the Spaces tree keeps a 300 ms grace for that.
- From one block to another (the tab bar to the Spaces tree), the release reaches the row's `on_mouse_up("left")` and the row gets `on_hover` and `on_mouse_move` while the button is held. Light the row from those events, not from `.hover(...)`. A release over a terminal reaches neither block, so the Spaces tree drops such a drag after 30 s (`DRAG_TTL`).
- Register each event once per element: the kit doesn't promise that a second registration adds to the first. A cursor style applies over the mod's own elements only.

## Agents

- End a Claude with `kill -TERM <pid>`, as Move tab does, not with ctrl+c.
- `hc send` pastes and presses Enter, waiting for a draft the person is typing: in a shell that runs a command, inside Claude it is a message. Type only into a shell in front.
- Claude's input box is the last line starting with `❯` under a `─` rule (`promptBox` in `mods/move-tab/logic.js`). Its folder-trust prompt uses `❯` too, and a Claude resumed in a folder it hasn't trusted stops there.
- Work the person should watch (a clone, an install) runs in a terminal from `terminal.open`, not in a long `exec`.

## RECIPE.md

A mod's `RECIPE.md` follows Herdr's six parts, in order: `# Name` with one paragraph and `![Name](preview.png)` (the `preview.png` sits next to it), What you see, How it behaves, Built from, Watch out, Done when. It owns the mod's detail and its limits; the README gives the mod one line and links to it.
