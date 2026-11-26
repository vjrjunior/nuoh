import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { herdr, type Node, texts, walk } from "./app-mocks";

const { default: AgentList } = await import("../mods/agent-list/main.js");

type Agent = Record<string, unknown> & { address: string };

const store = new Map<string, string>();
const fakeStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};
const hadStorage = "localStorage" in globalThis;
const previous = (globalThis as Record<string, unknown>).localStorage;
(globalThis as Record<string, unknown>).localStorage = fakeStorage;
afterAll(() => {
  if (hadStorage) (globalThis as Record<string, unknown>).localStorage = previous;
  else delete (globalThis as Record<string, unknown>).localStorage;
});

const claude = { key: "claude", name: "Claude Code", icon: "icons/claude.svg", tint: true, tile: "t.tile", shell: false, agent: true };
const agent = (address: string, status: string, over: Partial<Agent> = {}): Agent => ({
  address,
  pane: `p-${address}`,
  space: "s1",
  space_name: "pp-stack",
  tab: `tab-${address}`,
  status,
  program: claude,
  title: "✳ lane status panel",
  pane_name: null,
  seq: 1,
  pinned: false,
  focused: false,
  ...over,
});

const app = {
  agents: [] as Agent[],
  terminals: [] as Record<string, unknown>[],
  shared: {} as Record<string, unknown>,
  runs: [] as [string, unknown][],
  overlays: [] as Record<string, any>[],
  closed: [] as unknown[],
  order: [] as string[][],
  props: null as Record<string, unknown> | null,
  sidebar: 268,
  timers: [] as number[],
};

beforeEach(() => {
  store.clear();
  Object.assign(app, { agents: [], terminals: [], shared: {}, runs: [], overlays: [], closed: [], order: [], props: null, sidebar: 268, timers: [] });
  Object.assign(herdr, {
    theme: () => new Proxy({}, { get: (_x, p) => (typeof p === "string" ? `t.${p}` : undefined) }),
    agents: () => app.agents,
    terminals: () => app.terminals,
    spaces: () => [{ id: "s1", name: "pp-stack", tabs: [{ id: "tab-a", name: "1", named: false }] }],
    shared: (key: string) => app.shared[key],
    setShared: (key: string, value: unknown) => {
      app.shared[key] = value;
      return null;
    },
    run: (name: string, args: unknown) => {
      app.runs.push([name, args]);
      return null;
    },
    openOverlay: (spec: Record<string, any>) => {
      app.overlays.push(spec);
      return "overlay";
    },
    closeOverlay: (id: unknown) => {
      app.closed.push(id);
      return null;
    },
    setAgentOrder: (list: string[]) => {
      app.order.push(list);
      return null;
    },
    props: () => app.props,
    layout: () => ({ id: "root", children: [{ id: "sidebar", size: { px: app.sidebar } }] }),
  });
});

const cx = { timer: { every: (ms: number) => app.timers.push(ms) }, notify() {}, stop_propagation() {} };

function start(given: Record<string, unknown> = {}) {
  const view = new AgentList();
  view.init(given, cx);
  return view;
}

const draw = (view: InstanceType<typeof AgentList>) => view.render() as Node;
const find = (node: Node, key: string) => walk(node).find((n) => n.key === key) as Node;
const own = (node: Node, name: string) => node.calls.filter(([c]) => c === name).map(([, args]) => args);
const all = (node: Node, name: string) => walk(node).flatMap((n) => own(n, name));
const svgs = (node: Node) => all(node, "svg").map(([path]) => path);
const rowKeys = (root: Node) => find(root, "ag-list").kids.filter((n) => n.key?.startsWith("ag-") || n.key?.startsWith("sub-")).map((n) => n.key);
const click = (node: Node) => node.handlers.click?.[0]?.({}, cx);

describe("the header", () => {
  test("names the card with the bot icon and counts the agents", () => {
    app.agents = [agent("a", "working"), agent("b", "idle")];
    const head = find(draw(start()), "agents-head");
    expect(own(head, "h")).toEqual([[40]]);
    expect(texts(head)).toEqual(["Agents", "2"]);
    expect(svgs(head)).toEqual(["mods/kit/icons/bot.svg", "mods/kit/icons/list-filter.svg"]);
  });

  test("says how many need the person in a red chip, and nothing when none does", () => {
    app.agents = [agent("a", "blocked"), agent("b", "blocked"), agent("c", "working")];
    const head = find(draw(start()), "agents-head");
    expect(texts(head)).toContain("2 needs you");
    expect(all(head, "bg")).toContainEqual(["t.blocked1F"]);
    app.agents = [agent("c", "working")];
    expect(texts(find(draw(start()), "agents-head"))).not.toContain("0 needs you");
  });

  test("its sort button opens the mod's own popup", () => {
    const view = start();
    click(find(draw(view), "ag-sort"));
    expect(app.overlays).toEqual([{ mod: "agent-list", kind: "popup", width: 200, height: 102, props: { sortMenu: true } }]);
  });

  test("the list paints no fill of its own: the card does", () => {
    app.agents = [agent("a", "working")];
    const root = draw(start());
    expect(own(root, "bg")).toEqual([]);
    expect(own(find(root, "ag-list"), "bg")).toEqual([]);
  });
});

describe("a row", () => {
  test("is 54 px with the space's avatar, the program's badge, the space's name, a chip and the agent's title", () => {
    app.shared["space.colors"] = { s1: "ansi3" };
    app.agents = [agent("a", "blocked")];
    const row = find(draw(start()), "ag-a");
    expect(own(row, "h")).toEqual([[54]]);
    expect(texts(row)).toEqual(["P", "pp-stack", "Needs you", "now", "lane status panel"]);
    expect(all(row, "bg")).toContainEqual(["#e3814f"]);
    expect(all(row, "bg")).toContainEqual(["t.canvas"]);
    expect(svgs(row)).toEqual(["icons/claude.svg"]);
    expect(all(row, "text_color")).toContainEqual(["t.unknown"]);
  });

  test("shows Working and Done chips, and none when idle", () => {
    app.agents = [agent("w", "working"), agent("d", "done"), agent("i", "idle")];
    const root = draw(start());
    expect(texts(find(root, "ag-w"))).toContain("Working");
    expect(texts(find(root, "ag-d"))).toContain("Done");
    expect(texts(find(root, "ag-i"))).toEqual(["P", "pp-stack", "now", "lane status panel"]);
  });

  test("the focused agent's row is selected", () => {
    app.agents = [agent("a", "working", { focused: true }), agent("b", "working")];
    const root = draw(start());
    expect(own(find(root, "ag-a"), "bg")).toEqual([["t.selected"]]);
    expect(own(find(root, "ag-b"), "bg")).toEqual([]);
  });

  test("an agent on another machine names it after the space", () => {
    app.agents = [agent("vps/t7", "working")];
    expect(texts(find(draw(start()), "ag-vps/t7"))).toEqual(["P", "pp-stack", "vps", "Working", "now", "lane status panel"]);
  });

  test("a program without an icon gets no badge", () => {
    app.agents = [agent("a", "working", { program: { ...claude, icon: null } })];
    const row = find(draw(start()), "ag-a");
    expect(svgs(row)).toEqual([]);
    expect(all(row, "bg")).not.toContainEqual(["t.canvas"]);
  });

  test("a click focuses the agent's pane", () => {
    app.agents = [agent("a", "working")];
    click(find(draw(start()), "ag-a"));
    expect(app.runs).toEqual([["pane.focus", { pane: "p-a" }]]);
  });

  test("hovered, the time gives way to the pin button, which pins without focusing", () => {
    app.agents = [agent("a", "working")];
    const view = start();
    find(draw(view), "ag-a").handlers.hover?.[0]?.(true, cx);
    const row = find(draw(view), "ag-a");
    expect(texts(row)).not.toContain("now");
    const pin = find(row, "pin-a");
    expect(svgs(pin)).toEqual(["mods/kit/icons/pin.svg"]);
    pin.handlers.click?.[0]?.({}, cx);
    expect(app.runs).toEqual([["terminal.pin", { terminal: "a", pinned: true }]]);
    expect(texts(find(draw(view), "ag-a"))).toContain("now");
  });

  test("a pinned row says so with a pin, and its hover button unpins", () => {
    app.agents = [agent("a", "working", { pinned: true })];
    const view = start();
    expect(svgs(find(draw(view), "ag-a"))).toContain("mods/kit/icons/pin.svg");
    view.hovered = "a";
    const pin = find(draw(view), "pin-a");
    expect(svgs(pin)).toEqual(["mods/kit/icons/pin-off.svg"]);
    pin.handlers.click?.[0]?.({}, cx);
    expect(app.runs).toEqual([["terminal.pin", { terminal: "a", pinned: false }]]);
  });

  test("the time is how long it has been in this state, kept across starts", () => {
    const minute = 60_000;
    store.set("changed", JSON.stringify({ a: { s: "working", at: Date.now() - 5 * minute } }));
    app.agents = [agent("a", "working")];
    expect(texts(find(draw(start()), "ag-a"))).toContain("5m");
    app.agents = [agent("a", "blocked")];
    const view = start();
    expect(texts(find(draw(view), "ag-a"))).toContain("now");
    expect(JSON.parse(store.get("changed") ?? "{}").a.s).toBe("blocked");
  });
});

describe("the list", () => {
  test("publishes its order for agent.next, pinned first, by priority", () => {
    app.agents = [agent("idle", "idle"), agent("blocked", "blocked"), agent("pinned", "working", { pinned: true })];
    const root = draw(start());
    expect(rowKeys(root)).toEqual(["ag-pinned", "ag-blocked", "ag-idle"]);
    expect(app.order.at(-1)).toEqual(["pinned", "blocked", "idle"]);
  });

  test("grouped by space keeps the app's order", () => {
    app.shared["agents.sort"] = "grouped";
    app.agents = [agent("idle", "idle"), agent("blocked", "blocked")];
    draw(start());
    expect(app.order.at(-1)).toEqual(["idle", "blocked"]);
  });

  test("sub-agents hang under their parent, a click peeks at one without a pane, and the chevron folds them", () => {
    app.agents = [agent("a", "working")];
    app.terminals = [{ address: "k", parent: "a", status: "working", state: "live", name: "helper", program: claude }];
    const view = start();
    const root = draw(view);
    expect(rowKeys(root)).toEqual(["ag-a", "sub-k"]);
    expect(own(find(root, "sub-k"), "h")).toEqual([[26]]);
    click(find(root, "sub-k"));
    expect(app.runs).toEqual([["terminal.peek", { terminal: "k" }]]);
    click(find(root, "fold-a"));
    const folded = draw(view);
    expect(rowKeys(folded)).toEqual(["ag-a"]);
    expect(texts(find(folded, "fold-a"))).toEqual(["1"]);
    expect(own(find(folded, "fold-a"), "text_color")).toEqual([["t.working"]]);
  });

  test("a kept sub-agent's row focuses its pane", () => {
    app.agents = [agent("a", "working"), agent("k", "idle")];
    app.terminals = [{ address: "k", parent: "a", status: "idle", state: "live", program: claude }];
    const root = draw(start());
    expect(rowKeys(root)).toEqual(["ag-a", "sub-k"]);
    click(find(root, "sub-k"));
    expect(app.runs).toEqual([["pane.focus", { terminal: "k" }]]);
  });

  test("with no agents says so", () => {
    expect(texts(draw(start()))).toContain("No agent status yet. Agents show up here when they report their status.");
  });

  test("redraws every 30 seconds so the times move", () => {
    start();
    expect(app.timers).toEqual([30000]);
  });
});

describe("the folded sidebar", () => {
  test("shows only the avatars, centered, with a status dot on the ones that aren't idle", () => {
    app.sidebar = 44;
    app.agents = [agent("a", "blocked", { focused: true }), agent("b", "idle")];
    const root = draw(start());
    expect(find(root, "agents-head")).toBeUndefined();
    expect(rowKeys(root)).toEqual(["ag-a", "ag-b"]);
    const a = find(root, "ag-a");
    expect(own(a, "justify_center")).toEqual([[]]);
    expect(own(a, "bg")).toEqual([["t.selected"]]);
    expect(own(a, "tooltip")).toEqual([["pp-stack"]]);
    expect(all(a, "bg")).toContainEqual(["t.blocked"]);
    expect(all(a, "border_color")).toEqual([["t.surface"]]);
    expect(all(find(root, "ag-b"), "border_color")).toEqual([]);
    click(a);
    expect(app.runs).toEqual([["pane.focus", { pane: "p-a" }]]);
    expect(app.order.at(-1)).toEqual(["a", "b"]);
  });
});

describe("the sort popup", () => {
  test("offers both orders with a check on the current one, saves the choice and closes", () => {
    app.props = { sortMenu: true, overlay: "o1" };
    const view = start({ sortMenu: true });
    const root = draw(view);
    expect(texts(root)).toEqual(["Sort agents", "Priority", "Grouped by space"]);
    expect(svgs(find(root, "sort-priority"))).toContain("mods/kit/icons/check.svg");
    expect(svgs(find(root, "sort-grouped"))).not.toContain("mods/kit/icons/check.svg");
    click(find(root, "sort-grouped"));
    expect(app.shared["agents.sort"]).toBe("grouped");
    expect(app.closed).toEqual(["o1"]);
    expect(app.timers).toEqual([]);
  });

  test("is chosen from the props even when init only gets part of them", () => {
    app.props = { sortMenu: true, overlay: "o1" };
    expect(walk(draw(start({}))).some((n) => n.key === "sort-menu")).toBe(true);
  });
});
