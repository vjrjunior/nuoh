import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repo } from "./helpers";

const { RANK, ago, arrange, crowdedTabs, kidStatus, machineOf, mostUrgent, needsYou, sortOf, subTree } = await import(
  "../mods/agent-list/logic.js"
);

type Agent = { address: string; status: string; pinned?: boolean; seq: number; tab?: string };

const agent = (address: string, status: string, over: Partial<Agent> = {}): Agent => ({ address, status, pinned: false, seq: 0, tab: "tab", ...over });
const kid = (address: string, parent: string, status = "working", over: Record<string, unknown> = {}) => ({ address, parent, status, state: "live", ...over });
const never = () => 0;
const addresses = (rows: Agent[]) => rows.map((row) => row.address);

describe("tabs", () => {
  test("tabs with more than one agent are crowded", () => {
    expect([...crowdedTabs([agent("a", "idle", { tab: "x" }), agent("b", "idle", { tab: "x" }), agent("c", "idle", { tab: "y" })])]).toEqual(["x"]);
  });
});

describe("where it runs", () => {
  test("an agent on another machine names it", () => {
    expect(machineOf("vps/t7")).toBe("vps");
    expect(machineOf("t7")).toBeNull();
  });
});

describe("time", () => {
  test("reads as now, minutes, hours or days", () => {
    expect(ago(30_000)).toBe("now");
    expect(ago(2 * 60_000)).toBe("2m");
    expect(ago(6 * 3_600_000)).toBe("6h");
    expect(ago(30 * 3_600_000)).toBe("1d");
  });
});

describe("sub-agents", () => {
  test("hang under their parent depth first, with the tree's lines", () => {
    const all = [kid("k1", "a"), kid("k2", "a"), kid("k3", "k1"), kid("gone", "a", "idle", { state: "exited" })];
    expect(subTree(all, "a").map((row: { terminal: { address: string }; lines: string[] }) => [row.terminal.address, row.lines])).toEqual([
      ["k1", ["├"]],
      ["k3", ["│", "└"]],
      ["k2", ["└"]],
    ]);
  });

  test("one without a pane counts an error as blocked and is never done, one with a pane keeps its own state", () => {
    const listed = new Map([["kept", "done"]]);
    expect(kidStatus({ address: "x", status: "error" }, listed)).toBe("blocked");
    expect(kidStatus({ address: "x", status: "done" }, listed)).toBe("idle");
    expect(kidStatus({ address: "kept", status: "working" }, listed)).toBe("done");
  });

  test("the most urgent state wins", () => {
    expect(mostUrgent(["idle", "working", "blocked", "done"])).toBe("blocked");
    expect(mostUrgent([])).toBeNull();
  });
});

describe("order", () => {
  test("by priority: most urgent first, then the latest change, then the newest", () => {
    const list = [agent("idle", "idle"), agent("old-work", "working", { seq: 1 }), agent("new-work", "working", { seq: 2 }), agent("blocked", "blocked"), agent("done", "done")];
    expect(addresses(arrange(list, [], { sort: "priority", since: never }).rows)).toEqual(["blocked", "done", "new-work", "old-work", "idle"]);
    const since = (a: Agent) => (a.address === "old-work" ? 5 : 1);
    expect(addresses(arrange(list, [], { sort: "priority", since }).rows)).toEqual(["blocked", "done", "old-work", "new-work", "idle"]);
  });

  test("a parent takes its most urgent sub-agent's place, and a helper's done doesn't pull it up", () => {
    const list = [agent("working", "working"), agent("parent", "idle")];
    expect(addresses(arrange(list, [kid("k", "parent", "error")], { sort: "priority", since: never }).rows)).toEqual(["parent", "working"]);
    expect(addresses(arrange(list, [kid("k", "parent", "done")], { sort: "priority", since: never }).rows)).toEqual(["working", "parent"]);
  });

  test("grouped by space keeps the app's order, which already keeps a space's agents together", () => {
    const list = [agent("a1", "idle"), agent("a2", "blocked"), agent("b1", "working")];
    expect(addresses(arrange(list, [], { sort: "grouped", since: never }).rows)).toEqual(["a1", "a2", "b1"]);
  });

  test("pinned agents come first in either order", () => {
    const list = [agent("blocked", "blocked"), agent("pinned", "idle", { pinned: true })];
    expect(addresses(arrange(list, [], { sort: "priority", since: never }).rows)).toEqual(["pinned", "blocked"]);
    expect(addresses(arrange(list, [], { sort: "grouped", since: never }).rows)).toEqual(["pinned", "blocked"]);
  });

  test("a kept sub-agent shows under its parent, not as a row of its own, unless pinned or the sidebar is folded", () => {
    const list = [agent("parent", "working"), agent("kept", "idle")];
    const all = [kid("kept", "parent", "idle")];
    expect(addresses(arrange(list, all, { sort: "grouped", since: never }).rows)).toEqual(["parent"]);
    expect(addresses(arrange([list[0], { ...list[1], pinned: true }], all, { sort: "grouped", since: never }).rows)).toEqual(["kept", "parent"]);
    expect(addresses(arrange(list, all, { sort: "grouped", since: never, narrow: true }).rows)).toEqual(["parent", "kept"]);
  });

  test("an unknown sort is priority", () => {
    expect(sortOf("grouped").id).toBe("grouped");
    expect(sortOf(undefined).id).toBe("priority");
    expect(sortOf("other").id).toBe("priority");
  });
});

describe("counts", () => {
  test("needs you counts the rows waiting on the person, their sub-agents included", () => {
    const list = [agent("a", "blocked"), agent("b", "working"), agent("c", "idle")];
    const { rows, urgency } = arrange(list, [kid("k", "b", "blocked")], { sort: "priority", since: never });
    expect(needsYou(rows, urgency)).toBe(2);
    expect(urgency.get("c")).toBe(RANK.idle);
  });
});

test("logic.js imports nothing from the app, only lib's pure modules", () => {
  const imports = [...readFileSync(join(repo, "mods/agent-list/logic.js"), "utf8").matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
  expect(imports).toEqual(["../../lib/agent-since.js"]);
});
