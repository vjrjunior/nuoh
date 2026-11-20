# Files

The side panel's Files, drawn with this repo's kit in place of Herdr's. It shows the repository of the focused pane as a tree, with each changed file's name in the color of its change and each folder in the color of the worst change below it, ignored files dimmed. A filter finds any file of the repository by name. A click on a Markdown file opens it formatted in the Markdown viewer beside the focused pane, a picture or a PDF opens in its own app, and any other file shows as read-only code in the panel. A right-click gives the file's or folder's actions, and a row dragged onto a terminal types its path there.

## What you see

A card filling the panel (368px wide by default) on `background`, a 1px `border` and `RADIUS.panel` (10px) corners, text at `TEXT.lg`:

- **Header**, 36px, a 1px `border` line below, 12px left and 6px right padding:
  - the repository's folder name in `foreground`, semibold, at most 180px, then the folder that holds it from `~` in `dim` at `TEXT.sm`;
  - on the right, two 22px icon buttons: `git-compare` (tooltip `Show changed files only`; while on, `accent` with an `input` border and the tooltip `Show all files`) and `chevrons-down-up` (tooltip `Collapse all`), both borderless in `muted`.
  - While a file shows as code: a borderless 22px `arrow-left` (tooltip `Back to files`), the file's name, semibold, at most 160px, its folder in the repository in `dim`, and an outline button on the right with an `external-link` icon in `muted` and the editor's name from the local config, or `Open`.
- **Filter**, under the header while the tree shows: the kit's `input` at `CONTROL.row` (28px) with the placeholder `Filter files…`, 8px from the sides and 6px from top and bottom, a 1px `border` line below. Its border is `accent` while it has the keyboard and `input` otherwise.
- **Tree**, scrolling, 4px from top and bottom. Rows are `CONTROL.regular` (24px), 4px in from the sides, 6px + 14px per level of left padding, 8px right, 6px gaps, `RADIUS.control` corners:
  - a 12px `chevron-right` or `chevron-down` in `dim` on folders, a 12px blank on files;
  - a 14px icon in `muted`: `folder`, `folder-open` (open folder), `file-text` (Markdown), `image` (pictures) or `file`; `dim` when ignored;
  - the name, cut with an ellipsis, in the change's color: `ansi2` added or untracked, `ansi3` modified, `ansi1` deleted, `ansi5` conflict; `dim` when ignored by git; `foreground` otherwise;
  - on files, a letter at `TEXT.sm` in the same color: `A`, `M`, `D` or `C`.
  - The last file clicked is on `selected`; the row under the pointer on `hover`.
- **Results**, while the filter has text: rows of `CONTROL.row` (28px), 8px sides, 8px gaps: the icon, the name (at most 180px, in its change's color) and its folder in the repository in `dim` at `TEXT.sm`. The row Enter opens is on `selected`.
- **Code**, in place of the tree and the filter: a read-only code editor at `TEXT.base` in the terminal font, colored from the theme (`ansi5` keywords, `ansi2` strings, `dim` comments, `ansi4` functions, `ansi3` types, `ansi1` numbers, `ansi6` constants).
- **Row menu**, a 240px pointer popup on `popover`, 5px padding: a 26px title with a 12px `file` or `folder` icon and the name in `dim` at `TEXT.sm`, then 28px `popupRow`s. For a file: `Open beside` (`file-text`, Markdown only), `Open in <editor>` or `Open with default app` (`external-link`), `Reveal in Finder` (`folder-open`), `Copy path` and `Copy relative path` (`copy`). For a folder: the editor, `New terminal here` (`terminal`), Reveal in Finder and the two copies. Its height fits its rows: 10 + 26 + 28 per row.
- **Notes** at `TEXT.base` in `dim`, 12px padding: `Loading files…`, `No files`, `No folder`, `No changes`, `Not a git repository` (changed only, outside a repository), `Searching…`, `No file names match`, `Files on <machine> isn't supported yet`, and `Showing the first 5,000 files` under a tree that hit the limit. A file that can't be shown says `This file is gone`, `Binary file · no text preview` or `Cannot preview this file`, with an outline `Open with default app` button.

## How it behaves

- **Agent status:** the panel shows none; it follows the focused pane whatever its agent is doing.
- **Following focus:** the panel shows the repository (`git rev-parse --show-toplevel`) of the focused pane's folder, or that folder outside a repository. With a mod pane focused, it takes the folder of the first terminal in the same tab. Moving to a pane in another repository switches the tree; coming back opens the same folders again. Opening a code file and moving away closes it.
- **Folders:** a click opens or closes one. Closing a folder closes the ones inside it. `Collapse all` closes every one.
- **Files:** a click on a `.md`, `.markdown` or `.mdx` file opens it in the Markdown viewer, split to the right of the focused pane, or in the viewer already showing in that tab. Pictures and documents (`pdf`, office files, archives, audio and video) run `open`. Anything else shows as code; a file with a NUL byte says it is binary, and one over 400,000 characters is cut with `… (file truncated)`.
- **Changed only:** the `git-compare` button lists only the changed files, each under its folders, all open, deleted ones included. The choice is kept per panel copy in `localStorage`.
- **Filter:** typing lists the repository's files whose path holds every word typed, in any case: names that start with the first word come first, then names that hold it, then the rest, shorter paths first, at most 200. ↑ and ↓ move the choice (wrapping) and scroll it into view, Enter opens it as a click would, Escape clears the filter.
- **Right-click:** opens the row menu at the pointer. ↑ ↓ Enter work in it, and Escape or a click elsewhere closes it. `Open in <editor>` runs the local config's editor with the path, or `open`; `Reveal in Finder` runs `open -R`; `New terminal here` opens a tab with a shell in that folder; the copies put the absolute path, or the path in the repository, on the clipboard.
- **Dragging** a row onto a terminal types its absolute path there, quoted, without Enter.
- **Live:** the panel watches the repository with `watchFolder` and lists the open folders and the git state again on every change, and every 10 seconds as a backstop.

## Built from

- `mods/files/main.js`: the panel, one `View`. Opened with `props.role === "menu"`, the same mod draws the row menu (`menu.js`) instead and starts nothing else.
- `mods/files/logic.js`: the pure parts. `LIST` (a `sh` loop that prints `d` or `f` and each name, NUL-separated, dot files included, `.git` left out), `GIT_STATE` (`git status --porcelain=v1 -z --no-renames --untracked-files=all` from the repository's top, then `:ignored:`, then `git ls-files --others --ignored --exclude-standard --directory -z`), `ALL_FILES` (`git ls-files --cached --others --exclude-standard`, or `find -maxdepth 6` outside a repository), and the functions that parse them, roll changes up to folders, build the tree's rows, rank the filter's results and list the menu's items.
- `mods/files/actions.js`: `EDITOR` (`null` here; the recipe writes the local config's editor in) and the commands the panel and its menu run.
- `mods/files/menu.js`: the row menu.
- `lib/open-markdown.js`: opens a Markdown file in the viewer (shared with the Markdown viewer's picker).
- `herdr` functions: `focused`, `panes`, `spaces`, `exec`, `readTextFile`, `watchFolder`, `openOverlay`, `closeOverlay`, `run` (`pane.split`, `terminal.open`), `setShared`, `theme`, `settings`, `home`, `checking`.
- gpui: `InputState` and `Input` (through the kit's `input`), `EditorState` and `Editor`, `ScrollHandle`, `.drag_paths`, `cx.write_to_clipboard`, `cx.focus_handle`.
- Programs: `sh`, `git`, `find`, `open`, and the local config's editor. It never reaches the network.
- Kit: `button`, `iconButton`, `icon`, `input`, `popupRow`, and the icons `folder`, `folder-open`, `file`, `file-text`, `image`, `chevron-right`, `chevron-down`, `chevrons-down-up`, `git-compare`, `arrow-left`, `external-link`, `terminal`, `copy`.

## Watch out

- The layout's `files` block keeps its id, so the tab bar's Files button and the panel's stack find it as before; only its `mod` changes.
- The menu copy finds its `role` in `props()`: the first argument of `init` can carry only part of the overlay's props, and without the role the popup draws the whole panel.
- A right-click also fires the row's `on_click` when the button comes up, and the click event doesn't say which button it was. A Markdown row would then open in the viewer and the menu would close. The right press notes its time, and a click within 600 ms of it does nothing.
- A popup's height is fixed when it opens, so the menu works out its rows before it opens.
- `EditorState.new` can't run in `render`: the code view is made when the file's text arrives, and released when the panel leaves it.
- `git status` runs with `--no-optional-locks` and `core.fsmonitor=false`, so reading the state writes nothing under `.git` and the folder watch doesn't fire on its own reads.
- A Markdown file opens in a viewer already in the tab only while that viewer is on screen: `<mod>.<command>` reaches shown copies only. With another pane of the tab zoomed, the click splits a new viewer instead.
- Remote spaces aren't read: the panel says so rather than listing this computer's folder of the same name.
- The tree draws every row it has, up to 5,000, with no virtual list.

## Done when

- `herdr-app check` passes on `vjr-files`.
- With the panel on Files, the focused terminal's repository shows as a tree, folders first; a file changed in a terminal turns `ansi3` with an `M` within a second, and its folders turn `ansi3` too.
- A click on a `.md` opens it formatted beside the focused pane; a click on a second `.md` shows it in the same viewer, and `Back` there returns to the first.
- A click on a `.ts` file shows its code in the panel; the arrow brings the tree back.
- Typing part of a file's name lists it; Enter opens it; Escape clears.
- `git-compare` lists only the changed files; pressing it again shows them all.
- Right-click › `Copy path` puts the absolute path on the clipboard; `Reveal in Finder` shows it in Finder.
- Dragging a row onto a terminal types its path.
- In both looks, the card's corners and the menu follow the look: round with Herdr's frame, or square with a 1px `border`.
