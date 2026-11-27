---
name: herdr-feature
description: Build a feature for this repo's herdr-app layout, nuoh - a mod, a panel, a button, a key, a recipe or a layout change, or an item from TODOS.md. Runs prior art and the plan, creates the feature's worktree and moves this session into it while the plan waits for approval, then builds it and closes with the repo's Done checks. Use for /herdr-feature, "nova feature no herdr", "criar um mod", "adicionar ao layout", "construir um item do TODOS".
---

# herdr-feature

The loop: **frame → prior art → plan → worktree and move → build → Done → land**. `AGENTS.md` holds the rules this skill orders, and each folder's `AGENTS.md` the rules for working there; where they differ from this file, they win. Steps 1 to 3 only read and write the plan. Prose for the user, the plan included, follows the user's language; code and commits stay English.

## 1. Frame

1. `MAIN` is the main checkout: `dirname "$(git rev-parse --path-format=absolute --git-common-dir)"`. Run `herdr-app --version`; Herdr's guide reaches the session through `CLAUDE.md`, so read it again, in one read, only when a reminder says it changed.
2. Say in a few lines what the person sees and does in `nuoh`, and where it lands: a new mod, one of this repo's in `mods/`, a recipe that patches a copy of a Herdr mod (as `recipes/move-tab.ts` patches `menu` and `tabs`), or the layout tree.

## 2. Prior art and questions

1. Read `TODOS.md`: an open item can change the scope.
2. Run `AGENTS.md` › Planning's prior-art steps. A candidate is a herdr-app mod or layout that does the same job for the person; Herdr TUI plugins (`herdr-plugin.toml`) and other apps are not. Clone each into the scratchpad, one folder per repo, and only read it: its `RECIPE.md`, and the code of the ones you would adopt or take from. For each, note the link, commit, license, what it does well, what doesn't fit (a frozen copy of Herdr's mods, hooks, one OS, network calls) and the verdict: adopt at a commit, build ours from its ideas, or skip. Before adopting, tell the user if it reaches the network, runs programs (`exec`, `hc`) or reads files outside its folder.
3. Ask what changes the code, with `AskUserQuestion`: at most three questions, the recommended answer first. Decide the rest and list it in the plan.

## 3. Plan

Name the branch (`feat/`, `fix/`, `chore/`, `docs/` or `refactor/` plus a topic) and write `$MAIN/docs/plans/<YYYY-MM-DD>-<topic>.md`: **Goal** (what the person sees and does), **Prior art** (the searches run, each candidate with its link, verdict and what we take; "nothing fits" counts), **Herdr's guide** (the sections the change relies on), **In nuoh** (how it looks there), **Decisions** (what you chose without asking, so the user can overturn it), **Changes** (the files, in the order they'll be touched), **Done → proof** (each behavior and its proof: a `tests/` case, a shot or a test-panel step), **Out of scope** and what goes to `TODOS.md`.

## 4. Worktree and move, in the approval turn

With the plan written, and before asking for approval:

1. Reuse what exists: check `git -C "$MAIN" worktree list` and `git branch --list '<branch>'` first.
2. Create the worktree as `AGENTS.md` › Worktrees shows.
3. Schedule the move. When this turn ends, Move tab resumes the conversation with `claude --resume` in a space of the worktree, or a new one named after the branch:

   ```bash
   WT=~/.herdr/worktrees/"$(basename "$MAIN")"/<branch, / as ->
   sh ~/.config/herdr-app/mods/nuoh-move-tab/schedule.sh --to "$WT"
   ```

   When it exits non-zero, its line says why the session stays: enter the worktree with `EnterWorktree` (`path: $WT`), or keep to absolute paths, and say which.
4. End the turn with the plan's summary, its path and the request to approve, as plain text. `AskUserQuestion` keeps the session busy, so the move would wait and the answer would land in the old pane.

The user answers in the worktree's space, from a new pane: read `$HC_TERMINAL_ID` again before using it. If they reject the plan, offer to remove the worktree and its branch.

## 5. Build

In the worktree, with the plan approved:

- Read the `AGENTS.md` of each folder you touch first: `mods/`, `recipes/`, `kit/`, `lib/`, `tests/`, `scripts/`.
- Start from the closest recipe: `recipes/markdown.ts` (a pane mod), `recipes/comeback.ts` (an invisible floating worker), `recipes/move-tab.ts` (patches Herdr's `menu` and `tabs` and binds a key).
- Try it with `bun run apply-layout` from the worktree, then `herdr-app status`. The window runs one build: the folder that ran it last.
- A bug outside the feature gets its own branch and worktree. To try the fix live, apply from its worktree, then apply from the feature's again before going on, and say which build is live. Or ask to land the fix first, then rebase the feature on `main`, so its build carries both.

## 6. Done

All of `AGENTS.md` › Done. The live checks go in one test-panel run, `$MAIN/docs/runs/<topic>.json`, written as `tests/AGENTS.md` › Test panel runs says, with `"report": "$HC_TERMINAL_ID"` so the summary comes back to this session.

## 7. Land

- Commit each change a person would name on its own, as `AGENTS.md` › Commits says; a feature is usually one commit. Run `bun test` right before each commit.
- Ask whether to open a PR or merge into `main`. Once it lands or is dropped, update the main checkout and run `bun run apply-layout` there. Remove the worktree last, from the main checkout, because this session runs inside it.
