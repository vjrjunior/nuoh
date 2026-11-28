# recipes/

A recipe is `{ name, mods, apply }` (`recipe.ts`). `mods` names what it copies: `from: "mods"` or `from: "frame"` for Herdr's shipped mods and screens, `from: "repo"` for a folder of this repo's `mods/` (or an extra's). `apply(context)` edits the copies' files, the layout (a copy of Herdr's `layouts/main.json`), `replacements` and `keys`. `scripts/generate-layout.ts` reads each source once, runs the recipes in order, and installs every copy as `nuoh-<name>`; [`scripts/AGENTS.md`](../scripts/AGENTS.md) covers what apply does next.

## Order

`recipesWith` in `order.ts` runs `OWN`, `rail`, the extras, `rail-keys`, `nuoh-frame`, `nuoh-cards`. A new recipe goes in `OWN`. Each one gets the copies and the tree as the recipes before it left them:

- `OWN` sees Herdr's tree as shipped: `spaces`, `agents`, `tabs`, `main`, `panel-body`, `files`.
- `rail` moves the root's `children`, `divider`, `gap`, `padding` and `resizable` into `workspace`, the first child of the `views` stack, beside the `rail` block. Every id inside keeps its name.
- The extras find Herdr's blocks inside `workspace`. An extra adds a whole view by pushing a child onto `findNode(layout, "views").children` and `{ id, label, icon }` (a kit icon's name) onto `findNode(layout, "rail").content.props.views`; at the front of both, it becomes the first view.
- `rail-keys` gives each view `ctrl-cmd-<n>` in the rail's order, bound to `layout.select` on `views`. It fails on a view the stack doesn't have and on more than 9 views.
- `nuoh-frame` (`frame.ts`) removes `brand`, `sidebar-footer` and `status`, wraps `rail` in `rail-column` under a 46px band, opens the sidebar with `space-title`, moves `tabs` into `work-top` beside `machine`, and draws the pane frame's corners and lines. A missing id fails it.
- `nuoh-cards` (`cards.ts`) makes `spaces`, `agents` and every child of `work-body` but `main` a card, so a block an extra puts there becomes one too, swaps `agents` for `agent-list`, and gives panes their fill, veil and `pane-header`.

## Names

- Every copy is installed as `nuoh-<name>` (`PREFIX` and `LAYOUT` in `recipe.ts`). In the copies' code the generator rewrites `mod: "<name>"` and `{ name: "<name>" }`, in double quotes, when `<name>` has a copy; in the layout, every `mod` and `terminal_menu`. It refuses a copied mod's name that an `openOverlay` `mod:` or a `mod.open` `name:` writes in single quotes or backticks.
- Code that names a mod keeps the name in such a constant, so commands get the prefix too: `MARKDOWN = { name: "markdown" }` and `` run(`${MARKDOWN.name}.show`) `` in `lib/open-markdown.js` become `nuoh-markdown.show`.
- The prefix stays: without it the copies would take the names of Herdr's own `files`, `menu` and `tabs` in `mods/`, and `palette` in `frame/`.
- `sync` is added by the generator, not a recipe, with its floating block (`finishLayout`). `scripts/test-panel.ts` installs `tools/test-panel` as `nuoh-test-panel` outside apply. `mods/git-graph` is adopted code, copied as `nuoh-git-graph` with its `LICENSE` (the generator copies a repo mod's `LICENSE`); change it only through recipes, as `git-graph-panel` and `nuoh-cards` do.

## Patching a copy of Herdr's mods

- `exact(copy, from, to, expected = 1)` fails unless `from` appears exactly `expected` times across the copy's files; `pattern(copies, regex, to, minimum)` fails under `minimum` matches. A failure names the recipe and installs nothing, so an anchor that a Herdr update changes keeps the old build running.
- Recipes share copies: `tabs` goes through `git-graph-panel`, `move-tab`, the extras, `nuoh-frame` and `nuoh-cards`; `menu` through `spaces-tree`, `markdown` and `move-tab` (`grep -n 'copies\.' recipes/*.ts`). Anchor on Herdr's own text that no recipe before yours rewrites.
- A new anchor also goes in the fake copy in `tests/herdr-home.ts`. Each recipe that anchors on Herdr's text has a test in `tests/recipes.test.ts`, "a … that changed fails the recipe", that overrides the file and expects `recipe <name>:`; it must still fail on your recipe's own anchor.
- Only `from: "repo"` mods get the kit and `lib/`: the generator adds them while reading, before any recipe runs. A view that needs the kit is a mod of this repo, as `mods/agent-list` replaces Herdr's `agents`.

## Keys

The `layout:nuoh` section of `keys.json` is rebuilt on every apply, so a key edited there by hand comes back: change it in the recipe. For each `global` key whose action is in `replacements` (`replacements["app.palette"] = "palette"`), the section binds that key to `mod.open:nuoh-palette`. The recipes' `keys` go on top: a string is a mod to open (`keys["cmd-shift-o"] = "markdown"`), `{ mod, command }` a mod's own command, prefixed (`{ mod: "rail", command: "waiting" }` is `nuoh-rail.waiting`), and any other object an app command as written. A copy's `mod.json` `palette` entries that run its own `<name>.<command>` get the prefix too.

## The layout tree

- A worker that runs without showing (`sync`, `comeback`, the `move-tab` worker) is a floating block whose mod renders an empty `div()`. A `hidden: true` block never starts its mod.
- Layout nodes take a theme name or `#rrggbb[aa]`, and a theme name carries no alpha, so `frame.ts` holds the window's gradient and its lines in hex (`#181818`, `#0D0D0D`, `#FFFFFF12`, `#FFC799B3`, `#00000000`). It is the one place besides `lib/space-colors.js` and `mods/files/icons/` where hex is allowed.
- A node's `radius` rounds its own fill and line, not the mod inside: the mod keeps its rows inset from the corners.
- The pane frame in Herdr 0.1.18 has no inset field and draws no shadow (`shadow: "md"` on it does nothing), and its `radius` doesn't clip the terminal, which keeps its own corners.
- `nuoh-cards` opens the panel group after `+` and closes it at Herdr's `.when(w?.buttons,`, so whatever an extra adds between them lands in the group. `nuoh-frame` rewrites every `.bg(on ? t.selected : t.chrome)`, an extra's button included.

## Extras

What belongs to one person (their editor, a mod for their team's workflow) stays out of this repo, in `~/.config/vjr-herdr/config.json` (`VJR_HERDR_CONFIG` names another file), read by `scripts/config.ts` on every apply. Without the file the layout is this repo's.

- `editor`, `{ name, argv }`, reaches recipes as `context.editor`; `markdown` and `files` write it into their copies' `EDITOR`.
- `extras` lists folders, each a path or `{ path, options }` (`~` is the home folder). An extra has `recipes/index.ts` exporting `recipes`, its mods in `mods/<name>/` (`from: "repo"` reads them there), and maybe its own `lib/` ([`lib/AGENTS.md`](../lib/AGENTS.md)). Its recipes get its `options` as `context.options`.
- A recipe name already taken fails the build. An extra that doesn't load stops apply before it installs anything, and the message names the folder. `tests/fixtures/extra` is a minimal one.
