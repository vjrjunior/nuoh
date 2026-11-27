# AGENTS.md

This repo is the VJR theme, built for herdr-app and Ghostty from one palette, and `nuoh`, a herdr-app layout, with its mods. Weigh every idea by what it does for herdr-app. `README.md` is for the people who use it; `RECIPE.md` is the layout's brief.

Asked only to install the layout on someone's machine? Follow [`INSTALL.md`](INSTALL.md) and skip the rest of this file: the rules below are for changing the repo.

## Where things are

| Read | Before you touch |
|---|---|
| [`recipes/AGENTS.md`](recipes/AGENTS.md) | a recipe, the order they run in, the `layout:nuoh` keys, the extras contract |
| [`mods/AGENTS.md`](mods/AGENTS.md) | a mod: its name, how it is installed and checked, the pitfalls Herdr's guide leaves out |
| [`lib/AGENTS.md`](lib/AGENTS.md) | a module that more than one mod imports |
| [`kit/AGENTS.md`](kit/AGENTS.md) | the UI kit: its components, icons and tokens, and how mods draw with it |
| [`tests/AGENTS.md`](tests/AGENTS.md) | a test, the fake Herdr home, or a test panel run |
| [`scripts/AGENTS.md`](scripts/AGENTS.md) | the palette build, the theme install, `apply-layout`, the local config |
| `mods/<mod>/RECIPE.md` | what that mod shows and does, and what it runs |

## Herdr's guide

`~/.config/herdr-app/AGENTS.md` is the contract for everything built here: the app's files, its commands, the mod API, and what is read-only. Herdr rewrites it on every start and update, so read it at the start of every session that plans or builds, all of it, in one read. Searching or skimming it has already cost a wrong plan (themes do not reload live) and an edit to a read-only shipped layout. Claude Code loads it through `CLAUDE.md`. `herdr.d.ts` and `gpui-kit.d.ts` next to it are the API, and `herdr-app --version` says which version it describes.

The guide speaks to someone editing the app's folder by hand. Here that folder is an output: change `recipes/` and `mods/`, then run `bun run apply-layout`, which builds `mods/nuoh-*`, `layouts/nuoh.json` and the `layout:nuoh` section of `keys.json` from the Herdr installed. Shipped layouts and mods, `frame/` and `layouts/.state/` stay untouched, even for a test.

## Planning

1. Read Herdr's guide, as above.
2. Look for prior art before designing a mod, a layout or a behavior: `gh search repos --topic herdr-mod --limit 100`, `gh search repos --topic herdr-layout --limit 100` and `gh search repos "herdr <idea>"`. Herdr's shipped mods in `~/.config/herdr-app/mods/` are prior art too.
3. For each candidate that fits, read its `RECIPE.md` and its code, not only the README: what it does well, what doesn't fit here (a frozen copy of Herdr's mods, hooks, a single OS, network calls) and its license. Then adopt it whole at a commit, as Git Graph is; build ours from its ideas; or skip it.
4. Write the plan in the main checkout's `docs/`. It is ready when it has a **Prior art** section (the searches run, each candidate with its link, verdict and what we take from it; "nothing fits" counts when the searches are listed), names the sections of Herdr's guide it relies on, and says how the feature looks in `nuoh`.

No file in the repo names or credits another repository, not even as the source of an idea. Other repos appear only in the Prior art section of a plan in `docs/`. Nothing is copied: ideas are written from scratch. Code adopted whole, as Git Graph is, keeps its own `LICENSE` in its folder, and that is all. Naming a package the repo uses, such as the icon sets the kit and Files install, is fine: the rule is about other people's layouts and mods. Before adopting a mod, tell the user if it reaches the network, runs programs (`exec`, `hc`) or reads files outside its folder.

## Worktrees

- Each feature or fix gets its own branch, with a conventional prefix (`feat/`, `fix/`, `chore/`, `docs/`, `refactor/`), in its own worktree where Herdr's New worktree puts them: `~/.herdr/worktrees/<repo folder's name>/<branch with / as ->`.

  ```sh
  MAIN=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
  git -C "$MAIN" worktree add -b feat/<topic> ~/.herdr/worktrees/"$(basename "$MAIN")"/feat-<topic> main
  ```

- A batch of small, related changes goes on one branch with a general name, one commit per change.
- The main checkout, the folder the repo was cloned into, stays on `main` and may hold another session's work: leave its branch, index and files as they are.
- Plans and specs live in the main checkout's `docs/`, by absolute path. `docs/` is git-ignored, removing a worktree deletes its ignored files, and planning files stay out of every commit, whatever a skill says.
- `bun run apply-layout` stores the folder it runs from in the layout, and `nuoh-sync` rebuilds from that folder on every Herdr update. Run it from a worktree to try a change in the window. When the branch lands or is dropped, update the main checkout and run it there before removing the worktree.

## Done

- `bun test` passes.
- For a mod or a recipe, `bun run apply-layout` passes (it runs `herdr-app check` on every changed mod and installs nothing if one fails) and `herdr-app status` shows no errors. Then a `herdr-app shot` shows the change in `nuoh`.
- A change people can see updates the recipe that owns its detail, the mod's `RECIPE.md` or `RECIPE.md` for the layout, in the order Herdr's guide gives, and gets at most one line in `README.md`.
- A check only a person in the window can make (a drag, a toast, a key) goes in one test panel run for the change, written in Brazilian Portuguese; [`tests/AGENTS.md`](tests/AGENTS.md) has the format. Never post steps in the chat and wait.
- Work left for later goes in `TODOS.md`, in its What, Why, Context, Effort, Priority and Depends on shape.

What belongs to one person (their editor, a mod for their own workflow) stays out of this repo: it goes in the local config and its extras, whose contract is in [`recipes/AGENTS.md`](recipes/AGENTS.md).

## Commits

The subject is a plain sentence about what changes for the person using it, as in `git log`: "Give a space's own row more room and its branch a line of its own". The prefix belongs to the branch name, not the subject. The body says what was wrong and why this is the fix. Commits and PRs carry only the user's authorship: no `Co-Authored-By` trailer for an AI and no "Generated with" footer.
