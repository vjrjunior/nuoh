# Comeback

When the machine restarts, Herdr brings every terminal back as a bare shell in its last folder, and the Claude Code conversations that ran there are gone. Comeback brings them back by itself: as soon as the window opens, each terminal that lost its Claude gets it again, on the same conversation and with the same safe options, and a toast says what came back. It needs no hooks and edits no files outside Herdr's: it runs `hc`, `ps` (once through `env`), `sysctl` and `test`, reads `~/.claude/sessions/*.json` (and `/proc/sys/kernel/random/boot_id` on Linux) and lists `~/.claude/projects/`, writes nothing but a `comeback` label on terminals, and types into a terminal only to resume a lost conversation.

![Comeback](preview.png)

## What you see

- Nothing while you work: the mod is a floating block that draws an empty `div()`.
- After a restart, each terminal that gets its Claude back shows the typed command, `cd '<folder>' && claude --resume <id> <options>` (the folder quoted only when it needs it), and Claude opens on its old conversation.
- Then a toast, its body the terminals' `where` labels (`space / tab`): `Resumed 2 Claude conversations` (success, 5 s); `Resumed 1 of 2 Claude conversations` or `Couldn't resume 1 Claude conversation` with `Not resumed: web / 2: its folder is gone; …` (warning, 8 s); and, only from the command, `No Claude conversation to resume` with `No terminal lost its Claude.` (info, 3 s). An automatic pass with nothing to do shows nothing.

## How it behaves

- **Noting.** Every 10 s it reads `agents()`. For each local `claude-code` agent whose `seq` changed (every one on the first check and each 20th), it runs `hc get <t> --json`; when Claude is in front (`foreground.argv[0]` is `claude`, or the agent reports `claude-code` and its shell isn't in front), it reads `~/.claude/sessions/<foreground pid>.json` and sets the terminal's `comeback` label to `{"v":1,"agent":"claude","session":"<id>","cwd":"<folder>","args":[…],"boot":"<boot>","shell":{"pid":<pid>,"start":"<lstart>"},"at":<ms>}`. `boot` is `kern.boottime`'s `sec` on macOS or `/proc/sys/kernel/random/boot_id` on Linux; `shell` is the terminal's process and its start (`ps -o lstart=`), so a new shell with a reused pid isn't the old one. The label changes only when the session, folder, options, boot or shell do; `/clear`, `/resume` and compaction change the session in the same process, and the note follows.
- **Options.** The ones in `OPTIONS` of `lib/claude.js` come back (`--dangerously-skip-permissions`, `--permission-mode`, `--model`, `--add-dir`, `--agent`, `--effort`, `--allowedTools` and the rest, also as `--opt=value`). Prompts, `--resume`, `--continue`, `--session-id`, `-p`, `--worktree`, unknown options and a value holding a single quote, a backslash or a control character are dropped, and the code-loading `--settings`, `--mcp-config` and `--plugin-dir` never come back. A label read back is filtered again.
- **Each terminal's verdict.** Its own shell back in front on the same boot and shell process means the person quit Claude: the label is removed. A note from another boot or another shell process, with a shell (`zsh`, `bash`, `fish`, `sh`, `dash`, `ksh`) in front, means Claude was lost; with something else in front, the terminal is busy.
- **A pass.** When the block starts it waits up to 12 s, every 0.5 s, while noted terminals have nothing in front yet, then runs an automatic pass; a check that finds a terminal it would take runs one too. The automatic pass takes a lost terminal whose shell is younger than 120 s (`ps -o etime=`) and only marks a busy one. Newest note first, it skips, with the reason, `something else is running there`, `its folder can't be typed`, `its folder is gone` (`test -d`), `no saved conversation` (no `~/.claude/projects/*/<id>.jsonl`), `open in another terminal` (a sessions file for that conversation whose pid is alive with a matching `procStart`, from `TZ=UTC ps -o lstart=`) and `already resumed in this pass`. For each one left it notes the screen's last line, waits until the shell has run 1.5 s, reads the terminal again, skips it as `the shell was in use` if that line changed, then writes `tried` and `hc send`s the command. 5 s after the last send, Claude in front is resumed; its shell in front again is `exited right away: <the last line above the prompt>` (`hc read <t> --json --lines 20`).
- **One try per loss.** Before typing, the label gets `"tried": {boot, shell}` for the current shell, and nothing is typed when it can't be written. It lives on the terminal, so reopening the window, switching layouts or reloading the mod never tries again; a skipped terminal gets `tried` with its reason, so its toast isn't repeated. A lease in shared `comeback.pass`, renewed before each send, lets one copy run a pass at a time.
- **Again, by hand.** `herdr-app do nuoh-comeback.resume` runs a pass that also takes terminals with `tried` and older shells.

## Built from

- `recipes/comeback.ts` copies `mods/comeback/` (`"place": "none"`) and adds a floating block to the root, `{ "id": "comeback", "content": { "mod": "comeback" }, "edge": "left", "align": "end" }`. Outside this repo, put that block in a layout of your own and copy `lib/claude.js` and `lib/checkouts.js` next to the mod with the `../../lib/` imports changed to `./`; `bun run apply-layout` does both here.
- `main.js` holds the view: the 10 s check, the start-up pass, the pass itself, the lease and the command loop. Waits use `cx.sleep` inside a spawned task. `logic.js` holds the note's encoding, the boot and `ps` parsing, each terminal's verdict, the plan of a pass and the toast. `lib/claude.js` (sessions, shells, quoting, the option lists, the resume command) and `lib/checkouts.js` are shared with Move tab.

## Watch out

- **The note is a label, and any program that reaches `hc` can write one.** What a label says runs unattended after a reboot, so options that load code are never taken from it, even when the Claude started with them. Move tab keeps them, since it reads the live process: `lib/claude.js` keeps `OPTIONS` and `LOADS_CODE` apart for that.
- `turn` in `hc get` survives a recovery, so it can't tell a fresh shell from a used one; the shell's age can.
- Only a shell in front is typed into, but a line someone half-typed into a fresh shell before the first read would get the command appended; the 120 s window and the screen check make that unlikely, not impossible.
- A conversation resumed in a folder Claude hasn't trusted stops at the trust prompt, with Claude in front, which counts as resumed.
- Known limit: quit Claude while the window is closed, then restart the machine before opening it, and that conversation comes back. Only local terminals (addresses without `machine/`) are noted.

## Done when

- `herdr-app check` passes on `nuoh-comeback`.
- With Claude running in a terminal, `hc get <t> --json` shows a `comeback` label with its session within 10 s, and quitting that Claude removes it within 10 s.
- Writing the label back with `"boot":"1700000000"` on a shell younger than 2 minutes and switching layouts brings the conversation back, with the toast `Resumed 1 Claude conversation`.
- With `tried` set for the current shell, the automatic pass leaves it alone, and `herdr-app do nuoh-comeback.resume` brings it back.
