import { describe, expect, test } from "bun:test";
import { checkoutOf, parseWorktrees } from "../lib/checkouts.js";
import { CUT_TTL, REASONS, SCHEDULE_TTL, SETTLE, atShell, cutNotice, freshArgv, freshCommand, frontRunsSession, isClaude, isDraft, keepArgs, leaves, matchingFolder, movedNote, parseSchedule, projectFolder, promptBox, resumeArgv, runsSession, scheduleStep, spaceName, splitSteps, tabTree, targetsFor } from "../mods/move-tab/logic.js";

describe("move-tab logic", () => {
  test("keeps the allowed flags and their values", () => {
    expect(keepArgs(["claude", "--resume", "old", "--model", "opus", "--effort", "high", "--mcp-config", "a.json", "b.json", "--plugin-dir", "p", "--plugin-dir", "q", "--append-system-prompt", "x", "--strict-mcp-config"]))
      .toEqual(["--model", "opus", "--effort", "high", "--mcp-config", "a.json", "b.json", "--plugin-dir", "p", "--plugin-dir", "q", "--strict-mcp-config"]);
  });
  test("keeps the options that shape the session, with the Claude CLI's arity", () => {
    expect(keepArgs(["claude", "--fallback-model", "sonnet", "--setting-sources", "user,project", "--name", "my run", "--allowedTools", "Bash(git:*)", "Edit", "--disallowed-tools", "WebFetch", "--allow-dangerously-skip-permissions", "--chrome", "--no-chrome", "--ide", "--brief", "--debug", "--system-prompt", "x"]))
      .toEqual(["--fallback-model", "sonnet", "--setting-sources", "user,project", "--name", "my run", "--allowedTools", "Bash(git:*)", "Edit", "--disallowed-tools", "WebFetch", "--allow-dangerously-skip-permissions", "--chrome", "--no-chrome", "--ide", "--brief"]);
  });
  test("drops a flag whose value can't be typed", () => {
    expect(keepArgs(["claude", "--model", "it's"])).toEqual([]);
  });
  test("resolves kept paths against the old Claude's folder", () => {
    const cwd = "/r/main/api";
    expect(keepArgs(["claude", "--add-dir", "../shared", "./docs", "my dir", "/abs/x", "~/notes", "~"], cwd))
      .toEqual(["--add-dir", "/r/main/shared", "/r/main/api/docs", "/r/main/api/my dir", "/abs/x", "~/notes", "~"]);
    expect(keepArgs(["claude", "--plugin-dir=plugins/../tools/", "--plugin-dir", "/p"], cwd)).toEqual(["--plugin-dir", "/r/main/api/tools", "--plugin-dir", "/p"]);
    expect(keepArgs(["claude", "--mcp-config", "mcp.json", '{"mcpServers":{}}', "--settings", ' {"model": "opus"}'], cwd))
      .toEqual(["--mcp-config", "/r/main/api/mcp.json", '{"mcpServers":{}}', "--settings", ' {"model": "opus"}']);
    expect(keepArgs(["claude", "--settings=../s.json", "--model", "../opus"], cwd)).toEqual(["--settings", "/r/main/s.json", "--model", "../opus"]);
    expect(keepArgs(["claude", "--add-dir", "../../../x"], "/r")).toEqual(["--add-dir", "/x"]);
    expect(keepArgs(["claude", "--add-dir", "../shared"])).toEqual(["--add-dir", "../shared"]);
    expect(keepArgs(["claude", "--add-dir", "x"], "/r/it's")).toEqual([]);
  });
  test("resumes the session with the moved note last", () => {
    expect(resumeArgv({ session: "abc-1", args: ["--model", "opus"], note: "N" })).toEqual(["claude", "--resume", "abc-1", "--model", "opus", "--append-system-prompt", "N"]);
    expect(resumeArgv({ session: "../x", args: [], note: "N" })).toBeNull();
  });
  test("resumes without a note when there is none", () => {
    expect(resumeArgv({ session: "abc-1", args: ["--model", "opus"], note: null })).toEqual(["claude", "--resume", "abc-1", "--model", "opus"]);
    expect(resumeArgv({ session: "abc-1", args: [], note: "" })).toEqual(["claude", "--resume", "abc-1"]);
  });
  test("maps a folder into the other checkout", () => {
    expect(matchingFolder("/r/main/src/app", "/r/main", "/r/wt")).toBe("/r/wt/src/app");
    expect(matchingFolder("/r/main", "/r/main", "/r/wt")).toBe("/r/wt");
    expect(matchingFolder("/elsewhere", "/r/main", "/r/wt")).toBe("/r/wt");
    expect(matchingFolder("/r/main-old/x", "/r/main", "/r/wt")).toBe("/r/wt");
    expect(matchingFolder("/r/máin dir/a b", "/r/máin dir", "/r/wt ç")).toBe("/r/wt ç/a b");
  });
  test("finds the deepest checkout of a folder", () => {
    const checkouts = parseWorktrees("worktree /r/main\nbranch refs/heads/main\n\nworktree /r/main/.wt/x\nbranch refs/heads/feat/x\n");
    expect(checkoutOf("/r/main/.wt/x/src", checkouts)?.branch).toBe("feat/x");
    expect(checkoutOf("/r/main/src", checkouts)?.main).toBe(true);
    expect(checkoutOf("/other", checkouts)).toBeNull();
  });
  test("tells a Claude from an idle shell and a busy program", () => {
    const shell = { pid: 10, foreground: { pid: 10, argv: ["-zsh"] } };
    const claude = { pid: 10, foreground: { pid: 11, argv: ["claude", "--resume", "x"], name: "2.1.318" }, status: { app: "claude-code", state: "idle" } };
    const vite = { pid: 10, foreground: { pid: 12, argv: ["node", "vite"] } };
    expect([atShell(shell), isClaude(shell)]).toEqual([true, false]);
    expect([atShell(claude), isClaude(claude)]).toEqual([false, true]);
    expect([atShell(vite), isClaude(vite)]).toEqual([false, false]);
  });
  test("finds a live terminal that resumes a session", () => {
    const live = (over: Record<string, unknown>) => ({ address: "t9", state: "live", ...over });
    expect(runsSession(live({ argv: ["claude", "--resume", "abc-1", "--model", "opus"] }), "abc-1")).toBe(true);
    expect(runsSession(live({ argv: ["/bin/zsh", "-l"], foreground: { argv: ["claude", "--resume", "abc-1"] } }), "abc-1")).toBe(true);
    expect(runsSession(live({ argv: ["zsh", "-i", "-c", "claude --resume abc-1 --model opus"] }), "abc-1")).toBe(true);
    expect(runsSession(live({ argv: ["claude", "--resume", "abc-12"] }), "abc-1")).toBe(false);
    expect(runsSession(live({ argv: ["claude", "abc-1"] }), "abc-1")).toBe(false);
    expect(runsSession({ address: "t9", state: "exited", argv: ["claude", "--resume", "abc-1"] }, "abc-1")).toBe(false);
    expect(runsSession(live({}), "abc-1")).toBe(false);
    expect(runsSession(live({ argv: ["claude", "--resume", ".*"] }), ".*")).toBe(false);
  });
  test("tells a Claude running in front from the shell that launched it", () => {
    const launched = ["/bin/zsh", "-lic", '"$@"; exec "$0" -li', "/bin/zsh", "claude", "--resume", "abc-1"];
    const live = (front: string[]) => ({ address: "t9", state: "live", argv: launched, foreground: { argv: front } });
    expect(frontRunsSession(live(["claude", "--resume", "abc-1", "--model", "opus"]), "abc-1")).toBe(true);
    expect(frontRunsSession(live(["/bin/zsh", "-li"]), "abc-1")).toBe(false);
    expect(runsSession(live(["/bin/zsh", "-li"]), "abc-1")).toBe(true);
    expect(frontRunsSession(null, "abc-1")).toBe(false);
  });
  test("writes the moved note", () => {
    expect(movedNote({ from: "/r/main", fromBranch: "main", to: "/r/wt", toBranch: null }))
      .toBe("This session moved from /r/main (branch main) to /r/wt (detached HEAD). Work in /r/wt from now on; files under /r/main belong to another checkout.");
  });
  const block = (id: string) => ({ type: "block", id, content: { terminal: id } });
  test("splits a lone pane into one step", () => {
    expect(splitSteps({ type: "row", children: [block("a")] })).toEqual([{ leaf: 0, from: null, direction: null }]);
  });
  test("splits rows right and columns down, outer splits first", () => {
    const tree = { type: "row", children: [block("a"), { type: "column", children: [block("b"), block("c")] }, block("d")] };
    expect(leaves(tree).map((leaf) => leaf.id)).toEqual(["a", "b", "c", "d"]);
    expect(splitSteps(tree)).toEqual([
      { leaf: 0, from: null, direction: null },
      { leaf: 1, from: 0, direction: "right" },
      { leaf: 3, from: 1, direction: "right" },
      { leaf: 2, from: 1, direction: "down" },
    ]);
  });
  test("reads a tab's tree from doc.get", () => {
    const out = JSON.stringify({ id: 1, result: { value: { spaces: [{ id: "s1", tabs: [{ id: "tb1", root: { type: "row", children: [block("t1")] } }] }] } } });
    expect(leaves(tabTree(out, "tb1")!)[0].content).toEqual({ terminal: "t1" });
    expect(tabTree(out, "tb9")).toBeNull();
    expect(tabTree("not json", "tb1")).toBeNull();
  });
  test("lists open spaces first, then checkouts without one by branch", () => {
    const checkouts = parseWorktrees("worktree /r/main\nbranch refs/heads/main\n\nworktree /r/wt/zeta\nbranch refs/heads/zeta\n\nworktree /r/wt/alpha\nbranch refs/heads/alpha\n\nworktree /r/wt/live\nbranch refs/heads/feat/live\n");
    const spaces = [
      { id: "s1", name: "main", folder: "/r/main", tabs: [{ id: "tb1" }] },
      { id: "s2", name: "live", folder: "/r/wt/live", tabs: [{ id: "tb2" }] },
    ];
    const panes = [{ tab: "tb1", cwd: "/r/main/src" }, { tab: "tb2", cwd: "/r/wt/live" }];
    expect(targetsFor({ checkouts, spaces, panes, from: { space: "s1" } }).map((t) => [t.label, t.detail, t.space])).toEqual([
      ["live", "feat/live · open", "s2"],
      ["alpha", "alpha", null],
      ["zeta", "zeta", null],
    ]);
  });
  test("offers the main checkout when it has no space", () => {
    const checkouts = parseWorktrees("worktree /r/main\nbranch refs/heads/main\n\nworktree /r/wt/x\nbranch refs/heads/x\n");
    const spaces = [{ id: "s2", name: "x", folder: "/r/wt/x", tabs: [{ id: "tb2" }] }];
    expect(targetsFor({ checkouts, spaces, panes: [], from: { space: "s2" } }).map((t) => [t.label, t.detail, t.path])).toEqual([["main", "main checkout", "/r/main"]]);
  });

  test("names a space after its branch", () => {
    expect(spaceName("feat/ABC-4825--abc-5365-bulk-orders-cron")).toBe("ABC-5365 · bulk orders cron");
    expect(spaceName("feat/ABC-4825")).toBe("ABC-4825");
    expect(spaceName("feat/move-to-worktree")).toBe("move to worktree");
    expect(spaceName("fix/abc-6278-inbox-rail-item")).toBe("ABC-6278 · inbox rail item");
    expect(spaceName("main")).toBe("main");
    expect(spaceName("")).toBeNull();
    expect(spaceName(null)).toBeNull();
  });

  test("puts a prompt last, after the moved note", () => {
    expect(resumeArgv({ session: "s-1", args: ["--model", "opus"], note: "moved", prompt: "go on" })).toEqual(["claude", "--resume", "s-1", "--model", "opus", "--append-system-prompt", "moved", "go on"]);
    expect(resumeArgv({ session: "s-1", args: [], note: null, prompt: "go on" })).toEqual(["claude", "--resume", "s-1", "go on"]);
    expect(resumeArgv({ session: "s-1", args: [], note: null, prompt: "" })).toEqual(["claude", "--resume", "s-1"]);
    expect(resumeArgv({ session: "s-1", args: [], note: null })).toEqual(["claude", "--resume", "s-1"]);
  });

  test("reads a scheduled move from its label", () => {
    const label = (fields: Record<string, unknown>) => JSON.stringify({ v: 1, to: "/r/wt/", session: "abc-1", at: 5, ...fields });
    expect(parseSchedule(label({}))).toEqual({ to: "/r/wt", session: "abc-1", prompt: null, at: 5 });
    expect(parseSchedule(label({ prompt: "Implement the plan" }))).toEqual({ to: "/r/wt", session: "abc-1", prompt: "Implement the plan", at: 5 });
    expect(parseSchedule(label({ prompt: "" }))?.prompt).toBeNull();
    for (const bad of [label({ v: 2 }), label({ to: "r/wt" }), label({ session: "a b" }), label({ at: "5" }), label({ prompt: "--help" }), label({ prompt: 3 }), "{", "", null]) {
      expect(parseSchedule(bad)).toBeNull();
    }
  });

  test("a scheduled move waits for the turn to settle, then goes", () => {
    const schedule = { to: "/r/wt", session: "abc-1", prompt: null, at: 1000 };
    const at = (now: number, status: string | undefined, since: number | null) => scheduleStep({ schedule, status, since, now });
    expect(at(1000, "working", null)).toEqual({ wait: null });
    expect(at(1000, "blocked", null)).toEqual({ wait: null });
    expect(at(1000, undefined, null)).toEqual({ wait: null });
    expect(at(1000, "idle", null)).toEqual({ wait: SETTLE });
    expect(at(2000, "idle", 1000)).toEqual({ wait: SETTLE - 1000 });
    expect(at(3000, "idle", 1000)).toEqual({ go: true });
    expect(at(3000, "done", 1000)).toEqual({ go: true });
  });

  test("a scheduled move that can't be read or waited too long is dropped", () => {
    expect(scheduleStep({ schedule: null, status: "idle", since: 0, now: 0 })).toEqual({ drop: REASONS.unreadable() });
    const schedule = { to: "/r/wt", session: "abc-1", prompt: null, at: 0 };
    expect(scheduleStep({ schedule, status: "working", since: null, now: SCHEDULE_TTL + 1 })).toEqual({ drop: REASONS.stale() });
    expect(scheduleStep({ schedule, status: "working", since: null, now: SCHEDULE_TTL })).toEqual({ wait: null });
  });
});

const RULE = "─".repeat(40);
const claudeScreen = (input: string[]) => ["❯ an earlier prompt", "⏺ Done.", RULE, ...input, RULE, "  [Opus 5.5] │ repo git:(main)", "  ⏵⏵ bypass permissions on"].join("\n");

describe("Claude's prompt box", () => {
  test("finds the box under a rule and reads what is typed in it", () => {
    expect(promptBox(claudeScreen(["❯\u00a0"]))).toEqual({ row: 3, column: 2, lines: 1, text: "", height: 7 });
    expect(promptBox(claudeScreen(["❯\u00a0fix the login"]))).toEqual({ row: 3, column: 2, lines: 1, text: "fix the login", height: 7 });
    expect(promptBox(claudeScreen(["❯\u00a0first line", "  second line"]))?.text).toBe("first line second line");
    expect(promptBox(claudeScreen(['❯\u00a0Try "edit main.js to..."']))?.text).toBe('Try "edit main.js to..."');
  });
  test("has none without a prompt under a rule", () => {
    expect(promptBox("❯ an earlier prompt\n$ ls")).toBeNull();
    expect(promptBox("")).toBeNull();
    expect(promptBox(null)).toBeNull();
  });
  test("calls text a draft only when the cursor is past the start of the input", () => {
    const typed = promptBox(claudeScreen(["❯\u00a0hi"]));
    const suggested = promptBox(claudeScreen(["❯\u00a0o CI passou?"]));
    const lines = promptBox(claudeScreen(["❯\u00a0first line", "  "]));
    expect(isDraft(typed, { row: 3, col: 4 })).toBe(true);
    expect(isDraft(suggested, { row: 3, col: 2 })).toBe(false);
    expect(isDraft(lines, { row: 4, col: 2 })).toBe(true);
    expect(isDraft(promptBox(claudeScreen(["❯\u00a0"])), { row: 3, col: 2 })).toBe(false);
    expect(isDraft(typed, null)).toBe(false);
    expect(isDraft(null, { row: 3, col: 4 })).toBe(false);
  });
  test("with history above the screen, reads the column alone", () => {
    expect(isDraft(promptBox(claudeScreen(["❯\u00a0o CI passou?"])), { row: 900, col: 2 })).toBe(false);
    expect(isDraft(promptBox(claudeScreen(["❯\u00a0hi"])), { row: 900, col: 4 })).toBe(true);
    expect(isDraft(promptBox(claudeScreen(["❯\u00a0first line", "  more"])), { row: 900, col: 2 })).toBe(true);
  });
  test("the refusal quotes the start of the draft", () => {
    expect(REASONS.draft("this tab", "fix the login")).toBe('There\'s unsent text in Claude\'s prompt in this tab: "fix the login". Send or clear it, then move.');
    expect(REASONS.draft("pane 2", "a".repeat(50))).toBe(`There's unsent text in Claude's prompt in pane 2: "${"a".repeat(40)}…". Send or clear it, then move.`);
  });
});

describe("a Claude with no conversation yet", () => {
  test("its project folder is the cwd with every other character a dash", () => {
    expect(projectFolder("/Users/me/code/my-app")).toBe("-Users-me-code-my-app");
    expect(projectFolder("/w/My App/a.b_c")).toBe("-w-My-App-a-b-c");
    expect(projectFolder(null)).toBeNull();
    expect(projectFolder("")).toBeNull();
  });
  test("starts with its options, and a prompt goes first so no option takes it", () => {
    expect(freshArgv({ args: ["--model", "opus"], prompt: null })).toEqual(["claude", "--model", "opus"]);
    expect(freshArgv({ args: ["--allowedTools", "Bash", "Edit"], prompt: "Say pwd" })).toEqual(["claude", "Say pwd", "--allowedTools", "Bash", "Edit"]);
    expect(freshArgv({ args: [], prompt: "" })).toEqual(["claude"]);
  });
  test("its command by hand starts it in its folder", () => {
    expect(freshCommand({ cwd: "/r/main", args: ["--model", "opus"] })).toBe("cd /r/main && claude --model opus");
    expect(freshCommand({ cwd: "/r/My App", args: [] })).toBe("cd '/r/My App' && claude");
    expect(freshCommand({ cwd: "/r/it's", args: [] })).toBeNull();
  });
});

describe("a move cut off in the middle", () => {
  const NOW = 1_800_000_000_000;
  const claude = { session: "abc-1", cwd: "/r/main", args: ["--model", "opus"], fresh: false };
  const cut = (claudes: unknown[] = [claude], at = NOW - 1000) => ({ id: "r1", at, home: "s1", place: "feat/x", claudes });

  test("gives back each Claude that ended and runs nowhere", () => {
    expect(cutNotice(cut(), [], NOW)).toEqual({
      title: "A move was cut off",
      body: "The move to feat/x stopped after Claude ended. To resume Claude by hand: cd /r/main && claude --resume abc-1 --model opus",
      level: "error",
      action: { name: "tab.new", args: { space: "s1", folder: "/r/main", argv: ["claude", "--resume", "abc-1", "--model", "opus"] } },
    });
  });

  test("a Claude with no conversation yet is started again, not resumed", () => {
    const notice = cutNotice(cut([{ ...claude, session: "new-1", fresh: true }]), [], NOW);
    expect(notice?.body).toBe("The move to feat/x stopped after Claude ended. To start Claude again by hand: cd /r/main && claude --model opus");
    expect(notice?.action.args.argv).toEqual(["claude", "--model", "opus"]);
  });

  test("skips a Claude a terminal already resumes", () => {
    const running = { address: "t9", state: "live", argv: ["/bin/zsh", "-l"], foreground: { argv: ["claude", "--resume", "abc-1"] } };
    expect(cutNotice(cut(), [running], NOW)).toBeNull();
    const other = { ...claude, session: "abc-2", cwd: "/r/main/api", args: [] };
    expect(cutNotice(cut([claude, other]), [running], NOW)?.body).toBe("The move to feat/x stopped after Claude ended. To resume Claude by hand: cd /r/main/api && claude --resume abc-2");
  });

  test("drops a record that is a day old or that can't be read", () => {
    expect(cutNotice(cut([claude], NOW - CUT_TTL - 1), [], NOW)).toBeNull();
    expect(cutNotice(null, [], NOW)).toBeNull();
    expect(cutNotice({ at: NOW }, [], NOW)).toBeNull();
    expect(cutNotice(cut([{ ...claude, session: "../x" }]), [], NOW)).toBeNull();
    expect(cutNotice(cut([]), [], NOW)).toBeNull();
  });
});
