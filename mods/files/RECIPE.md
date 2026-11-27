# Files

The side panel's Files, in place of Herdr's. It shows the focused pane's repository as a tree, each file and folder with a colored icon of its type, each changed file's name in the color of its change and each folder in the color of the worst change below it, ignored files dimmed. A filter finds any file of the repository by name. A Markdown file opens formatted in the Markdown viewer beside the focused pane, a picture or a document in its own app, and any other file shows as read-only code in the panel. A right-click gives the row's actions, and a row dragged onto a terminal types its path there.

![Files](preview.png)

## What you see

A box filling the panel on `background`, with a 1px `border` and `RADIUS.panel` (10px) corners, text at `TEXT.lg` (12.5px):

- **Header,** 36px, a 1px `border` line under it, 12px in on the left and 6px on the right: the repository's folder name in semibold `foreground` (at most 180px), the folder that holds it from `~` in `dim` at `TEXT.sm`, and two borderless 22px icon buttons in `muted`: `git-compare` (`Show changed files only`; while on, `accent` with an `input` border and `Show all files`) and `chevrons-down-up` (`Collapse all`). While a file shows as code: a 22px `arrow-left` (`Back to files`), the file's type icon, its name, its folder in the repository in `dim`, and an outline button with `external-link` and the local config's editor name, or `Open`.
- **Filter,** under the header while the tree shows: the kit's `input` at 28px with `Filter files…`, 8px from the sides and 6px from top and bottom, its border `accent` while it has the keyboard.
- **Tree,** scrolling: 24px rows 4px in from the sides, 6px + 14px per level on the left, 6px gaps, `RADIUS.control` corners: a 12px `chevron-right` or `chevron-down` in `dim` on folders (a 12px blank on files), the 14px type icon (at 0.5 opacity when git ignores it), the name cut with an ellipsis, and on files a letter at `TEXT.sm`, all in the change's color: `ansi2` added or untracked (`A`), `ansi3` modified (`M`), `ansi1` deleted (`D`), `ansi5` conflict (`C`), `dim` ignored, `foreground` otherwise. The last file clicked is on `selected`.
- **Results,** while the filter has text: 28px rows with the type icon, the name in its change's color and its folder in the repository in `dim`; the row Enter opens is on `selected`.
- **Type icons,** full-color SVGs drawn with `image()`: `package.json` the green Node hexagon, `.ts` the blue TS square, `*.spec.ts` a test flask, `README.md` the readme icon, `src` a green folder, `.github` a folder with the GitHub mark, an open folder its open icon, and the plain grey `file` or `folder` for anything unknown. With a light appearance, the names that have a light icon use it.
- **Code,** in place of the tree: a read-only editor at `TEXT.base` in the terminal font, colored from the theme (`ansi5` keywords, `ansi2` strings, `dim` comments, `ansi4` functions, `ansi3` types, `ansi1` numbers, `ansi6` constants).
- **Row menu,** a 240px popup at the pointer on `popover`: a 26px title with the row's type icon and name in `dim`, then 28px `popupRow`s. A file has `Open beside` (`file-text`, Markdown only), `Open in <editor>` or `Open with default app` (`external-link`), `Reveal in Finder` (`folder-open`), `Copy path` and `Copy relative path` (`copy`); a folder has the editor, `New terminal here` (`terminal`), Reveal and the two copies.
- **Notes** in `dim`: `Loading files…`, `No files`, `No folder`, `No changes`, `Not a git repository`, `Searching…`, `No file names match`, `Files on <machine> isn't supported yet`, `Showing the first 5,000 files`, and for a file `This file is gone`, `Binary file · no text preview` or `Cannot preview this file` with an `Open with default app` button.

## How it behaves

- **Following focus:** the panel shows the repository (`git rev-parse --show-toplevel`) of the focused pane's folder, or that folder outside a repository; with a mod pane focused, the folder of the first terminal in its tab. Another repository's pane switches the tree, closing a file shown as code, and coming back opens the same folders.
- **Which icon:** from the row's path in lower case, a rule for its last two parts (`.github/workflows`) beats its name, its name beats its extensions, and the longest extension wins (`app.spec.ts` before `app.ts`). A folder also matches a known name without one leading `.`, `_` or `-`, or without `__…__`. A light appearance (`settings().dark === false`) looks in the light tables first.
- **Clicks:** a folder opens or closes, closing the ones inside it. A `.md`, `.markdown` or `.mdx` file opens in the Markdown viewer through `lib/open-markdown.js` ([`mods/markdown/RECIPE.md`](../markdown/RECIPE.md)); pictures and documents (PDF, office files, archives, audio, video) run `open`; anything else shows as code, cut at 400,000 characters, and a file with a NUL byte says it is binary.
- **Changed only** lists the changed files under their folders, all open, deleted ones included; the choice is kept in `localStorage`.
- **Filter:** typing loads the repository's file list once and shows the paths that hold every word, in any case: names starting with the first word first, then names holding it, then the rest, shorter paths first, at most 200. ↑ and ↓ move the choice and scroll it into view, Enter opens it, Escape clears the filter.
- **Right-click** opens the row menu (↑ ↓ Enter, Escape). `Open in <editor>` runs the local config's editor with the path, or `open`; `Reveal in Finder` runs `open -R`; `New terminal here` runs `terminal.open` with `place: "tab"`; the copies put the absolute or the relative path on the clipboard.
- **Dragging** a row onto a terminal types its absolute path there, quoted, without Enter (`drag_paths`).
- **Live:** it watches the repository with `watchFolder` and reads the open folders and the git state again on every change, and every 10 seconds as a backstop.

## Built from

- `recipes/files.ts` points the `files` block of `panel-body` at `files` (installed as `nuoh-files`) and writes the local config's `editor` over `const EDITOR = null;` in `actions.js`.
- `mods/files/main.js` is the panel; opened with `props.role === "menu"`, the same mod draws the row menu from `menu.js` and starts nothing else. `logic.js` holds the shell scripts it runs (a `sh` loop listing one folder, `git status --porcelain=v1 -z` plus the ignored list, `git ls-files` or `find -maxdepth 6` for the filter) and the pure parsing, roll-up, rows, ranking and menu items. `actions.js` holds what the panel and the menu run. `lib/paths.js` gives the path helpers and the Markdown pattern.
- `icon-rules.js` picks an icon from the table in `file-icons.js`, which names the SVGs in `icons/`; `logic.js` draws them from `mods/${PACK.name}/icons/`, a name the generator prefixes. `bun run file-icons` (`scripts/file-icons.ts`) writes the table and `icons/` from the pinned release of the npm icon package it names (`npm pack --ignore-scripts` and `tar` in a temporary folder), reading only its `package.json`, manifest, SVGs and license (`icons/LICENSE-material-icon-theme`) and running none of its code.
- It runs `sh`, `git`, `find`, `open` or the editor on this computer, reads the files it shows, and never reaches the network.

## Watch out

- A click within 600 ms of a right press does nothing (`RIGHT_CLICK_MS`), or a Markdown row would open and close its own menu. The menu's height is counted before it opens: 10 + 26 + 28 per row.
- `git` runs with `--no-optional-locks` and `core.fsmonitor=false`, so reading the state writes nothing under `.git` and the watch doesn't fire on its own reads.
- Remote spaces aren't read: the panel says so rather than listing this computer's folder of the same name. The tree draws every row it has, up to 500 per folder and 5,000 in all, with no virtual list.
- The type icons are drawn with `image()`, which keeps their colors (`svg()` would tint them grey); they are the one place this mod draws colors that aren't `theme()`'s. They are picked by path only, never by the file's contents, so a YAML file in `.github/workflows` shows the YAML icon.
- Don't edit `icons/` or `file-icons.js` by hand: change `VERSION` in `scripts/file-icons.ts` and run `bun run file-icons`. The tests check that the table and the folder agree.

## Done when

- `herdr-app check` passes on `nuoh-files`.
- `package.json` shows the Node icon, `*.ts` the TypeScript one, `*.spec.ts` the test one and an unknown `x.foo` the plain file; `src` shows its green folder and its open icon once opened; `node_modules` has its icon faded.
- With the panel on Files, the focused terminal's repository shows as a tree, folders first; a file changed in a terminal turns `ansi3` with an `M` within a second, and its folders turn `ansi3` too.
- A click on a `.md` opens it formatted beside the focused pane, and a second `.md` shows in the same viewer with `Back`; a `.ts` file shows as code, and the arrow brings the tree back.
- The filter lists a file by part of its name, Enter opens it and Escape clears; `git-compare` lists only the changed files; `Copy path` puts the absolute path on the clipboard; dragging a row onto a terminal types its path.
