# tests/

`bun test` runs every file here, and passes before every commit.

- A test never touches the real app folder. `tempDir()` makes a `nuoh-test-` folder that `removeTempDirs()`, in `afterEach`, deletes; a script run gets its own `HOME`, `XDG_CONFIG_HOME`, `XDG_STATE_HOME` and `HERDR_APP_HOME` from `makeHomes()`.
- Logic and view go in separate files: `<name>.test.ts` tests the pure module (`mods/<name>/logic.js`, a `lib/` module), `<name>-view.test.ts` the view through `app-mocks.ts`.
- Code that waits takes its clock from outside: Move tab's mover gets an `io`, and `fakeIo` in `move-tab-move.test.ts` makes its `sleep` add to a counter that its `now` returns.

## Helpers

- `app-mocks.ts` stands in for `gpui-kit`, `gpui-base`, `herdr` and `fs/promises`; import it before the mod. Elements are `Node`s that record every builder call (`calls`), their text, children and handlers; `svg()` and `image()` record their path. `herdr` is an object a test fills with the functions the mod calls (`herdr.spaces = () => [...]`); the mocked module forwards to it. `FakeInput` stands in for `InputState`. To read a view: `walk`, `find`, `byKey` (throws when no element has that id), `texts`, `own` and `calls` (one node's calls to a builder), `svgs`. To drive it: `click(node, cx)`, `makeCx(overrides)` (a `cx` that counts `notify`, `spawn`, `focus` and `stop_propagation`, keeps timer callbacks in `ticks` and `afters`, and records the clipboard) and `flush()`, which lets spawned work settle.
- `helpers.ts`: `repo`, `tempDir`, `removeTempDirs`, `copyRepo()` (the repo's build inputs, without `mods/files/icons/`, so install tests stay fast), `editFile`, `makeHomes()`, `run(root, script, args, env)` (a script under Bun) and `modsIn` (every `mod` a layout names).
- `herdr-home.ts`: `makeHerdrHome(home, overrides)` writes a fake Herdr home: `layouts/main.json` with the ids the recipes look for, the shipped mods and frame screens with the text the recipes anchor on, their `mod.json` and the files the app writes, `themes/vjr.json`, a `keys.json` with `global` keys, and `installed.json`. `overrides` replaces files; that is how a "… that changed fails the recipe" test breaks an anchor. A recipe's new anchor goes in here too.
- `recipes.test.ts` builds the plain layout once and shares it; a test that changes the home builds its own.
- `spaces-tree-harness.ts`: the Spaces tree's fake app, shared by its view tests.
- `fixtures/extra/`: a minimal extra (one recipe, one mod, one kit icon) for `extras.test.ts`.
- `fixtures/fake-herdr-app/herdr-app`: a shell stand-in that the apply tests put first on `PATH`. It logs each call to `$FAKE_HERDR_LOG` and answers `--version` (`FAKE_HERDR_VERSION`), `check` (failing for a folder that ends in `FAKE_HERDR_CHECK_FAIL`) and `status` (only with `FAKE_HERDR_WINDOW`, the layout shown, reporting an error when a `nuoh-*` mod that layout names is missing; other `FAKE_HERDR_STATUS_*` variables make it hang, fail or print other text).
- The apply tests set `NUOH_RELOAD_MS=0`: the fake answers at once, so apply needn't wait for a reload.

## Test panel runs

A check only a person in the window can make (a drag, a toast, a key) goes in one test panel run, all the checks together, never as steps in the chat. The panel shows one step at a time with what to do, what to expect, a note, `Passed` and `Failed`.

```sh
bun run test-panel <run.json>   # installs nuoh-test-panel (nuoh must be applied) and opens it in each of the run's layouts
bun run test-panel --results    # every verdict, note and shot, then the events by step
bun run test-panel --close      # closes the panel in every layout
```

```json
{
  "title": "Mover aba",
  "layouts": ["nuoh"],
  "watch": ["move-tab.drag"],
  "shotOn": ["move-tab.request"],
  "report": "t17",
  "steps": [{ "title": "Arrastar uma aba até uma worktree", "run": [{ "command": "space.select", "args": { "id": "sp..." } }], "do": ["Arraste a aba até feat/x e solte."], "expect": "A linha acende, depois a aba se move." }]
}
```

- The run is written in Brazilian Portuguese: its `title` (and `intro`, shown before the first step) and each step's `title`, `do` and `expect`. What the window names (a tooltip, `Settings › Look`) stays as the window writes it.
- A step's `run` commands execute when it opens, so a step can switch the space, the tab or the zoom for the person.
- `layouts` lists where the panel opens, the one shown by default. Spaces and tabs opened, closed, moved and reordered, a tab's pane count and the layout are logged on their own; `watch` adds shared keys.
- Each answer takes a `herdr-app shot`, and so does each change of a key in `shotOn`; shots go to `~/.local/state/vjr-herdr/test-panel/<id>/` unless `shots` names a folder.
- `report` is a terminal address, usually `$HC_TERMINAL_ID`: after the last answer the panel sends it a one-line summary with `hc send`.
- The run acts on the person's real window: what it changes, it does to spaces and tabs it creates, or its last step puts back. Read `--results` and match each `passed` with its events; a pass whose events don't show the change is a finding.
