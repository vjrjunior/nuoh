# lib/

What more than one mod needs and no window shows. Every module is pure (no `herdr` import) except `open-markdown.js`, which runs commands.

| Module | Holds | Used by |
|---|---|---|
| `agent-since.js` | `track` (stamps when each agent's state began, `done` and `idle` as one, forgetting gone agents after `KEEP_DAYS`), `settled`, `readChanged` (the stamps kept in `localStorage`) | Agents list, rail |
| `agent-title.js` | `cleanTitle` (strips the marks an agent puts before its title), `tellingTitle` (turns away a path or `user@host`), `agentTitle` (a pane's name, a named tab, a telling live title, then the program) | Agents list, pane header |
| `checkouts.js` | `parseWorktrees` (`git worktree list --porcelain`, the main checkout first), `checkoutOf` (the checkout a folder is in), `placeOf` (where a space is now), `base` | Spaces tree, Move tab, Comeback |
| `claude.js` | a Claude Code session: `OPTIONS` worth keeping, `LOADS_CODE` (options that load code), `parseSession` (`~/.claude/sessions/<pid>.json`), `keepOptions`, `quote`, `resumeCommand`, `isShell` | Move tab, Comeback |
| `layout-tree.js` | `findNode`, `sidebarPx`, `isNarrow` (the sidebar under 160px) | Agents list, rail, Spaces tree, top bar |
| `open-markdown.js` | `openMarkdown(file, { pane })`: writes `markdown.request` and runs `nuoh-markdown.show` when the focused tab shows a viewer and no other pane of it is zoomed, else splits a viewer right of the pane | Files, Markdown viewer and picker |
| `paths.js` | `nameOf`, `folderOf`, `shortFolder`, `MARKDOWN_FILE` | Files, Markdown viewer |
| `space-colors.js` | the six avatar colors, `LETTER`, `paint`, `spaceColor`, `avatarLook` | Spaces tree, Agents list, top bar |
| `workflow.js` | a workflow graph: `checkWorkflow`, `parseWorkflow`, `warnings`, `resolveInputs`; `graphOf` (order, loops), `ancestors`, `reach`, `agentRoot`; `fill`, `evaluate`; typed answers (`readAnswer`, `agentMessage`, `retryMessage`); a run's `current`, `readyNodes`, `activeIn`, `loopsTaken`, `takeLoop`, `nodeInputs`, `staleNodes`, `reuseFor`, `scopeOf`, `runSummary` | the workflow runner (`scripts/workflow.ts`), the Workflows view |

`space-colors.js` is one of the three places allowed to hold hex colors ([`kit/AGENTS.md`](../kit/AGENTS.md)).

## Importing

- Herdr refuses an import from outside a mod's folder. A mod imports a module as `../../lib/<name>.js`; `installLib` in `scripts/generate-layout.ts` rewrites the import to `./<name>.js` and copies the module, and each module it imports as `./<name>.js`, next to the mod's own files.
- A module imports a sibling only as `./<name>.js`, and nothing from `../`.
- A mod can't have a file named like a module it takes from `lib/`: the generator refuses. A module found nowhere fails with the folders it looked in.
- Only this repo's mods and an extra's get `lib/`; copies of Herdr's mods can't.
- An extra can have its own `lib/`. Its mods take a module from there when it has one and from this repo's otherwise, siblings included; this repo's mods only ever take from this repo's `lib/`.

## Tests

`tests/lib.test.ts` (with `agent-since.js`), `tests/agent-title.test.ts`, `tests/open-markdown.test.ts` and `tests/workflow.test.ts` test these modules.
