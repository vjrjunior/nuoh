import { describe, expect, test } from "bun:test";
import { agentTitle, cleanTitle, tellingTitle } from "../lib/agent-title.js";

describe("cleanTitle", () => {
  test("drops the status glyph and the separator an agent puts before its title", () => {
    expect(cleanTitle("✳ Fix login")).toBe("Fix login");
    expect(cleanTitle("⠋ - Thinking")).toBe("Thinking");
    expect(cleanTitle("[ ! ] Review the diff")).toBe("Review the diff");
    expect(cleanTitle("✋ Waiting for you")).toBe("Waiting for you");
    expect(cleanTitle("⏳ Building")).toBe("Building");
  });

  test("keeps a title that opens with a bracket, an emoji or a path", () => {
    expect(cleanTitle("[web] login")).toBe("[web] login");
    expect(cleanTitle("🔴 login")).toBe("🔴 login");
    expect(cleanTitle("~/code/app")).toBe("~/code/app");
    expect(cleanTitle("#42 checkout")).toBe("#42 checkout");
    expect(cleanTitle(null)).toBe("");
  });
});

describe("tellingTitle", () => {
  test("a title that says what runs tells", () => {
    expect(tellingTitle("Fix login")).toBe(true);
    expect(tellingTitle("vim README.md")).toBe(true);
  });

  test("a shell's place, a path or user@host, tells nothing", () => {
    expect(tellingTitle("~/code/app")).toBe(false);
    expect(tellingTitle("/private/tmp/app")).toBe(false);
    expect(tellingTitle("C:\\Users\\me")).toBe(false);
    expect(tellingTitle("me@laptop:~/code/app")).toBe(false);
    expect(tellingTitle("")).toBe(false);
  });
});

describe("agentTitle", () => {
  const claude = { name: "Claude Code", key: "claude" };

  test("is the pane's name, then the tab's name when someone named it, then the agent's own title, then the program", () => {
    const base = { address: "t1", title: "✳ Fix login", program: claude };
    expect(agentTitle({ ...base, pane_name: "reviewer" }, { name: "auth", named: true })).toBe("reviewer");
    expect(agentTitle(base, { name: "auth", named: true })).toBe("auth");
    expect(agentTitle(base, { name: "2", named: false })).toBe("Fix login");
    expect(agentTitle({ ...base, title: "✳ Claude Code" }, { name: "2", named: false })).toBe("Claude Code");
  });

  test("a tab with several agents gives each its own title", () => {
    expect(agentTitle({ address: "t1", title: "✳ Fix login", program: claude }, { name: "auth", named: true }, true)).toBe("Fix login");
  });

  test("a title that only names the program, a folder, a host or the terminal says nothing", () => {
    const quiet = ["claude", "Claude Code", "~/code/app", "me@mac: ~", "t1", "T1"];
    for (const title of quiet) expect(agentTitle({ address: "t1", title, program: claude }, null)).toBe("Claude Code");
  });

  test("without a tab or a program it falls back to the agent's tab name, then its address", () => {
    expect(agentTitle({ address: "t1", title: "~/code", tab_name: "auth" })).toBe("auth");
    expect(agentTitle({ address: "t1", title: "" })).toBe("t1");
  });
});
