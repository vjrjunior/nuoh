# Markdown viewer

A pane that shows one Markdown file formatted, beside the terminal that mentioned it. Cmd-click a `.md` path in a terminal and it opens there. Press `cmd-shift-o` in a terminal, or right-click it and pick `Open Markdown…`, and a popup lists the `.md` files on that terminal's screen and in its repository; pick one and it opens to the right of the terminal, or in the viewer the tab already shows, with `Back` to the one before. Files opens its Markdown files here too, and a script opens one with `pane.split`. The viewer follows edits to the file, opens links to other Markdown files in place, and never reaches the network.

![Markdown viewer](preview.png)

## What you see

- **The viewer,** on `background`: a 32px header on `chrome` with a 1px `border` line under it, 12px in on the left and 6px on the right, 8px gaps. In it, `Back` (the kit's outline `button` with `arrow-left`) while there is a file to go back to, the file's name in 12px semibold `foreground`, its folder from `~` in 11px `dim` cut at the start, and on the right Open (an outline button with `external-link` in `muted`, labelled `Open` or the local config's editor name) and Reload (the kit's 26px bordered `iconButton` with `rotate-cw` and the tooltip `Reload`).
- **The body:** the rendered file in a column at most 760px wide, centered, with 24px by 16px of padding, at 14px, scrollable and selectable, front matter hidden. Without a file it says `No file to show`, while reading `Loading…`, and for a file that is gone `<name> is gone`, in 12px `dim`.
- **The menu item:** `Open Markdown…` with Herdr's `file-text` icon and the key on its right, just above `Close pane` in a terminal's right-click menu.
- **The picker,** a 560 x 420 popup on `popover` with 6px of padding and gap: the kit's `input` (`Filter, or type a path…`), a 320px list and a 22px footer in `dim` at `TEXT.sm` (`↵ open beside`, `↑↓ choose`, `esc close`). The list has an `ON THIS SCREEN` heading over the files the terminal shows, then `IN THIS REPOSITORY` over the repository's; each row is a `popupRow` with `file-text`, the file's name and, on the right, its folder in the repository (else from `~`), cut to 36 characters as `…/docs/plans`. Its notes: `Reading the terminal…`, `No Markdown on this terminal's screen. Type a path.` (or `No terminal to read. Type a path.`), `No match. Enter opens it as a path.` and `No file at <path>`.

## How it behaves

- **Cmd-click:** a Cmd-click on a path ending in `.md`, `.markdown` or `.mdx` (any case) in a terminal opens it as the picker does, beside the clicked terminal's pane or in the tab's viewer. A path Herdr can't resolve here (on another machine, or not found) goes to the next handler, and from there to the system's app.
- **Opening the picker:** `cmd-shift-o` opens it at the top of the window, 40px down, for the focused terminal, or the first terminal of the focused tab; the menu item opens it at the pointer for the terminal and pane that were right-clicked.
- **On this screen:** the picker reads the terminal's screen and last 400 lines (`hc read <t> --json --lines 400`) from the bottom up and takes every path ending in `.md`, `.markdown` or `.mdx`, at most 200: a line's last word is joined to the next line's first, so a path cut across two lines comes back whole; `:12` or `#L4` after the name stays out; web links are skipped, `file://` ones kept, and a leading `@` dropped. One `sh` keeps the paths that exist, read from the terminal's folder with `~/` as the home folder, and up to 12 bare names that don't are looked up in the repository (`git ls-files`, two hits per name). The lowest on screen comes first.
- **In this repository:** the repository's Markdown files (`git ls-files … | xargs ls -t`), the most recently changed first, at most 200 shown, leaving out those already on screen.
- **Choosing:** typing filters both lists by the path in the repository (else from `~`), and the repository's list puts names that hold the text first. ↑ and ↓ move the choice, wrapping, and scroll it into view; Enter opens the chosen row, or the typed path when nothing matches; Escape closes.
- **Where it opens** (`lib/open-markdown.js`, which Files uses too): when the focused tab already shows a viewer and no other pane of it is zoomed, the file goes there, through the shared key `markdown.request` (`{ file, tab, at }`) and the command `nuoh-markdown.show`, and `Back` returns to the one before. Otherwise `pane.split` opens a new viewer right of the terminal's pane. From a script: `herdr-app do pane.split --direction right --mod nuoh-markdown --props '{"file":"/path/to/NOTES.md"}'`.
- **The viewer** reads the file with `readTextFile`, watches its folder with `watchFolder` and reads it again when the change names the file, keeping only the newest read; a file that is gone says so until it comes back, and Reload reads it again. A link to another `.md` or `.markdown`, relative to the file, opens in the same pane with `Back`; web links (`http`, `https`, `mailto`) and other files run `open`. Open runs `open` on the file, or the local config's editor with the file as its last argument.

## Built from

- `recipes/markdown.ts` copies `mods/markdown/` and Herdr's `menu` (`nuoh-menu`, the copy the Spaces tree and Move tab patch too). It adds `["Open Markdown…", "markdown-picker", { terminal, pane }]` to the menu's pane case before `Close pane` when the target is a terminal, makes choosing it `openOverlay({ mod: "markdown", kind: "popup", width: 560, height: 420, props })`, gives it `mods/workspace-chrome/file-text.svg` and the key bound to `mod.open:nuoh-markdown`, sets the layout's `terminal_menu` to that copy, binds `cmd-shift-o` to `mod.open:nuoh-markdown` in `layout:nuoh`, and writes the local config's `editor` over `EDITOR` in `main.js`.
- `mod.json`'s `link_handlers` (`{ "kind": "file", "pattern": "(?i)\\.(md|markdown|mdx)$" }`, the extensions of `MARKDOWN_FILE`) and the recipe's `link_handlers: ["markdown"]` on the layout's root send a Cmd-click there; the generator prefixes the name to `nuoh-markdown`. `link.js` exports `handleLink({ link, source })`: it returns `"pass"` when `link.path` is null and otherwise calls `openMarkdown(link.path, { pane: source.pane })` and returns `"handled"`.
- `mod.json`'s `overlay` (`"kind": "popup", "at": "top", "offset": 40`, 560 x 420) is how `mod.open` opens the picker.
- `main.js` is the viewer when its props carry a `file`, and the picker (`picker.js`) when it opens as an overlay without one. The viewer waits on `nextCommand()` for `show` and takes each `markdown.request` once, by its `at`. `logic.js` holds the front matter, the link targets, the paths found in terminal text, the three shell scripts (paths that exist, bare names, the repository's list), the folder labels and the picker's rows. `lib/paths.js` gives the path helpers.
- It runs `hc read`, `sh`, `git`, `ls`, `xargs` and `open` or the editor, and reads only the file it shows and the files it links to.

## Watch out

- The picker's list is a fixed 320px: a popup at the top is as tall as what it draws, and a `flex_1()` list there collapses.
- Herdr adds a mod with link rules to a personal layout's `link_handlers` the first time it sees it, and the next apply would drop that edit: the recipe writes the list. A line in the path (`NOTES.md:12`) is ignored; the viewer opens at the top.
- A Cmd-click on a terminal outside a tab (a layout terminal block, a peek) has no pane in `panes()`, so the viewer splits the focused pane.
- `nuoh-markdown.show` reaches only viewers on screen, so `lib/open-markdown.js` sends it only while the focused tab's viewer is visible and splits a new viewer when another pane of the tab is zoomed. Every viewer on screen takes the request: two viewers in one tab both show the file.
- The viewer's own link pattern leaves `.mdx` out on purpose: a link to an `.mdx` opens in its own app, though the picker and Files list `.mdx` files (`MARKDOWN_FILE` in `lib/paths.js`).

## Done when

- `herdr-app check` passes on `nuoh-markdown`.
- `cmd-shift-o` in a terminal that printed a `.md` path lists it first under `ON THIS SCREEN`; Enter opens it beside the terminal, and the same key on a second path shows it in that viewer with `Back`.
- Right-click › `Open Markdown…` does the same for the clicked terminal.
- Cmd-click on a `.md` path a terminal printed opens it beside that terminal, or in the tab's viewer.
- The header shows the name, the folder, Open and Reload; saving the file from a terminal redraws it; a link to another `.md` opens in the pane with `Back`.
- The `pane.split` command above opens the file in a new viewer.
