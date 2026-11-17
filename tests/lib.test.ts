import { describe, expect, test } from "bun:test";
import { checkoutOf, parseWorktrees, placeOf } from "../lib/checkouts.js";
import { isShell, parseSession, quote, resumeCommand } from "../lib/claude.js";

const SESSION_ID = "152ba1e2-45b7-4fc9-83c9-33b8dfdadf6e";
const space = (id: string, over = {}) => ({ id, tabs: [], folder: "", ...over });

describe("parseWorktrees", () => {
  const list = [
    "worktree /r/app",
    "HEAD 111",
    "branch refs/heads/main",
    "",
    "worktree /w/app/one",
    "HEAD 222",
    "branch refs/heads/feature/one",
    "",
    "worktree /w/app/gone",
    "HEAD 333",
    "branch refs/heads/gone",
    "prunable gitdir file points to non-existent location",
    "",
    "worktree /w/My Projects/ação",
    "HEAD 444",
    "detached",
    "",
  ].join("\n");

  test("the main checkout comes first", () => {
    expect(parseWorktrees(list)[0]).toEqual({ path: "/r/app", branch: "main", main: true });
  });

  test("strips refs/heads/ and keeps slashes in branch names", () => {
    expect(parseWorktrees(list)[1]).toEqual({ path: "/w/app/one", branch: "feature/one", main: false });
  });

  test("skips prunable and bare entries", () => {
    expect(parseWorktrees(list).map((c) => c.path)).not.toContain("/w/app/gone");
    expect(parseWorktrees("worktree /r/bare.git\nbare\n\nworktree /w/one\nHEAD 1\nbranch refs/heads/one\n")).toEqual([
      { path: "/w/one", branch: "one", main: true },
    ]);
  });

  test("keeps spaces and accents, and a detached head has no branch", () => {
    expect(parseWorktrees(list).at(-1)).toEqual({ path: "/w/My Projects/ação", branch: null, main: false });
  });
});

describe("checkoutOf", () => {
  const checkouts = [
    { path: "/a/b", branch: "x", main: true },
    { path: "/a/b/nested", branch: "y", main: false },
  ];

  test("picks the deepest checkout", () => {
    expect(checkoutOf("/a/b/nested/src", checkouts)?.branch).toBe("y");
  });

  test("does not match a path that only shares a prefix", () => {
    expect(checkoutOf("/a/bc", checkouts)).toBeNull();
  });
});

describe("placeOf", () => {
  test("follows the first pane with a folder", () => {
    const panes = [
      { tab: "t", cwd: null },
      { tab: "t", cwd: "/live" },
    ];
    expect(placeOf(space("s", { folder: "/old", tabs: [{ id: "t" }] }) as never, panes as never)).toBe("/live");
  });

  test("falls back to the space's folder", () => {
    expect(placeOf(space("s", { folder: "/old" }) as never, [])).toBe("/old");
  });
});

describe("parseSession", () => {
  test("reads the conversation and folder of a running Claude", () => {
    expect(parseSession('{"pid":5770,"sessionId":"abc-1","cwd":"/w/app","status":"busy"}')).toEqual({ session: "abc-1", cwd: "/w/app" });
    expect(parseSession('{"pid":5770,"sessionId":"abc-1","cwd":"/w/app","procStart":"Mon Nov  2 13:36:12 2026"}')?.procStart).toBe("Mon Nov  2 13:36:12 2026");
  });

  test("gives nothing for a missing or broken file", () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession("{")).toBeNull();
    expect(parseSession('{"cwd":"/w/app"}')).toBeNull();
  });
});

describe("shells", () => {
  test("knows login shells by name or path", () => {
    expect(isShell("/bin/zsh")).toBe(true);
    expect(isShell("-zsh")).toBe(true);
    expect(isShell("fish")).toBe(true);
    expect(isShell("claude")).toBe(false);
    expect(isShell("vim")).toBe(false);
  });
});

describe("the command", () => {
  test("quotes only what needs it", () => {
    expect(quote("/w/app")).toBe("/w/app");
    expect(quote("/w/My App/ação")).toBe("'/w/My App/ação'");
    expect(quote("/w/it's")).toBeNull();
    expect(quote("/w/a\\b")).toBeNull();
    expect(quote("/w/a\nb")).toBeNull();
  });

  test("goes to the folder and resumes with the kept options", () => {
    expect(resumeCommand({ session: SESSION_ID, args: ["--dangerously-skip-permissions"], cwd: "/w/My App" })).toBe("cd '/w/My App' && claude --resume 152ba1e2-45b7-4fc9-83c9-33b8dfdadf6e --dangerously-skip-permissions");
  });

  test("refuses a folder it can't type", () => {
    expect(resumeCommand({ session: SESSION_ID, args: ["--dangerously-skip-permissions"], cwd: "/w/it's" })).toBeNull();
  });
});
